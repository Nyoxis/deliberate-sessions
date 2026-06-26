import CookieStore, { CookieStoreOption } from './stores/CookieStore.ts'
import type Store from './stores/Store.ts'
import { decrypt, encrypt } from './Crypto.ts'
import Session, { type SessionData } from './Session.ts'
import type SessionConfig from './SessionConfig.ts'

/**
 * Interface defining the deliberate session handlers returned by `initSessionsHandlers`.
 */
export interface SessionHandlers<T, CookieType> {
  /**
   * Fetch and reconstruct the Session instance from the HTTP cookies.
   * Returns `null` if no valid session exists (e.g. for anonymous visitors).
   *
   * @param cookies The generic cookies object.
   * @returns A promise resolving to the Session instance, or null if no session is active.
   */
  fetchSession: (cookies: CookieType) => Promise<Session<T> | null>

  /**
   * Persist the session changes, handle key rotation, or execute session deletion.
   * This should be called at the end of the request-response lifecycle.
   *
   * @param session The current Session instance (or null if anonymous).
   * @param cookies The generic cookies object.
   * @param rotate_session_key Set to true if the session key needs to be rotated.
   */
  storeState: (
    session: Session<T> | null,
    cookies: CookieType,
    rotate_session_key?: boolean,
  ) => Promise<void>

  /**
   * Deliberately construct and initialize a new Session (e.g. upon user login).
   *
   * @param cookies The generic cookies object.
   * @returns A promise resolving to the newly created Session instance.
   */
  createSession: (cookies: CookieType) => Promise<Session<T>>
}

/**
 * Initialize session handlers for fetch, store, and create.
 * This conforms to the "deliberate sessions" lifecycle structure.
 *
 * @param config A SessionConfig configuration object
 * @returns An object containing the lifecycle handlers: `fetchSession`, `storeState`, and `createSession`.
 */
function initSessionsHandlers<
  T,
  CookieType,
  CookieOptionsType extends { maxAge?: number } = object,
  CookieGetOptionsType = object,
  CookieSetOptionsType extends { maxAge?: number } = object,
>(
  config: SessionConfig<
    CookieType,
    CookieOptionsType,
    CookieGetOptionsType,
    CookieSetOptionsType
  >,
): SessionHandlers<T, CookieType> {
  let encryptionKey: string | undefined
  const expireAfterSeconds = config.expireAfterSeconds
  const cookieSetOptions = {
    ...(config.cookieSetOptions || {}),
    ...(config.cookieOptions || {}),
  } as CookieOptionsType & CookieSetOptionsType & { maxAge?: number }
  const cookieGetOptions = {
    ...(config.cookieGetOptions || {}),
    ...(config.cookieOptions || {}),
  } as CookieOptionsType & CookieGetOptionsType
  const sessionCookieName = config.sessionCookieName || 'session'
  const autoExtendExpiration = config.autoExtendExpiration ?? true
  const getCookieFn = config.getCookie
  const setCookieFn = config.setCookie

  if (config.encryptionKey !== undefined) {
    if (typeof config.encryptionKey === 'function') {
      encryptionKey = config.encryptionKey()
    } else {
      encryptionKey = config.encryptionKey
    }
  } else {
    encryptionKey = undefined
  }

  let store
  if (config.store instanceof CookieStoreOption) {
    if (!encryptionKey) {
      throw new Error(
        'encryptionKey is required while using CookieStore. encryptionKey must be at least 32 characters long.',
      )
    }
    store = new CookieStore<
      CookieType,
      CookieOptionsType,
      CookieGetOptionsType,
      CookieSetOptionsType
    >({
      sessionCookieName: sessionCookieName,
      getCookie: config.getCookie,
      setCookie: config.setCookie,
      encryptionKey,
      cookieGetOptions,
      cookieSetOptions,
    })
  } else {
    store = config.store
  }

  const fetchSession = async (
    cookies: CookieType,
  ): Promise<Session<T> | null> => {
    const session = new Session<T>(expireAfterSeconds)
    let sid = ''
    let session_data: SessionData | null | undefined
    let createNewSession = false

    const sessionCookie = await getCookieFn(
      cookies,
      sessionCookieName,
      cookieGetOptions,
    )

    if (sessionCookie) {
      if (store instanceof CookieStore) {
        session_data = await store.getSession(cookies)
      } else {
        try {
          sid = (encryptionKey
            ? await decrypt(encryptionKey, sessionCookie)
            : sessionCookie) as string
          session_data = await store.getSessionById(sid)

          if (session_data) {
            session_data._id = sid
          }
        } catch {
          createNewSession = true
        }
      }

      if (session_data) {
        session.setCache(session_data)

        if (session.sessionValid()) {
          if (autoExtendExpiration) {
            session.reupSession()
          }
        } else {
          if (store instanceof CookieStore) {
            await store.deleteSession(cookies)
          } else {
            await store.deleteSession(sid)
          }
          createNewSession = true
        }
      } else {
        createNewSession = true
      }
    } else {
      createNewSession = true
    }

    if (createNewSession) {
      return null
    }

    if (autoExtendExpiration) {
      session.updateAccess()
    }

    return session
  }

  const createSession = async (cookies: CookieType): Promise<Session<T>> => {
    const session = new Session<T>(expireAfterSeconds)
    let sid = ''

    const defaultData: SessionData = {
      _data: {},
      _expire: null,
      _delete: false,
      _accessed: null,
    }

    if (store instanceof CookieStore) {
      await store.createSession(cookies, defaultData)
    } else {
      sid = globalThis.crypto.randomUUID()
      defaultData._id = sid
      await store.createSession(sid, defaultData)
    }

    session.setCache(defaultData, true)

    if (!(store instanceof CookieStore)) {
      await setCookieFn(
        cookies,
        sessionCookieName,
        encryptionKey ? await encrypt(encryptionKey, sid) : sid,
        cookieSetOptions,
      )
    }

    if (autoExtendExpiration) {
      session.updateAccess()
    }

    return session
  }

  const storeState = async (
    session: Session<T> | null,
    cookies: CookieType,
    rotate_session_key?: boolean,
  ): Promise<void> => {
    if (!session) return

    if (session.isStale()) {
      session.touch()
    }

    const shouldDelete = session.getCache()._delete
    const shouldRotateSessionKey = rotate_session_key === true
    const storeIsCookieStore = store instanceof CookieStore
    let sid = session.getCache()._id || ''

    if (shouldDelete) {
      if (store instanceof CookieStore) {
        await store.deleteSession(cookies)
      } else {
        await store.deleteSession(sid)
        await setCookieFn(cookies, sessionCookieName, '', {
          ...cookieSetOptions,
          maxAge: 0,
        })
      }
      return
    }

    const shouldRecreateSessionForNonCookieStore = !shouldDelete &&
      !storeIsCookieStore &&
      shouldRotateSessionKey

    if (shouldRecreateSessionForNonCookieStore) {
      const dbStore = store as Store
      await dbStore.deleteSession(sid)
      sid = globalThis.crypto.randomUUID()
      session.getCache()._id = sid
      await dbStore.createSession(sid, session.getCache())

      await setCookieFn(
        cookies,
        sessionCookieName,
        encryptionKey ? await encrypt(encryptionKey, sid) : sid,
        cookieSetOptions,
      )
    }

    const shouldPersistSession = !shouldDelete &&
      (!shouldRotateSessionKey || storeIsCookieStore) &&
      session.isStale()

    if (shouldPersistSession) {
      if (store instanceof CookieStore) {
        await store.persistSessionData(cookies, session.getCache())
      } else {
        await store.persistSessionData(sid, session.getCache())
      }
    }
  }

  return { fetchSession, storeState, createSession }
}

export default initSessionsHandlers
