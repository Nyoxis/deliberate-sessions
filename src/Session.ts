import { nanoid } from 'https://deno.land/x/nanoid@v3.0.0/async.ts'
import MemoryStore from './stores/MemoryStore.ts'
import CookieStore from './stores/CookieStore.ts'
import type Store from './stores/Store.ts'
import type { Cookies, CookiesGetOptions, CookiesSetDeleteOptions } from '../deps.ts'


interface SessionOptions {
  expireAfterSeconds?: number | null
  cookieGetOptions?: CookiesGetOptions
  cookieSetOptions?: CookiesSetDeleteOptions
  sessionCookieName?: string
}

export interface SessionData {
  _flash: Record<string, unknown>
  _accessed: string | null
  _expire: string | null
  _delete: boolean
  [key: string]: unknown
}

export default class Session {

  sid: string
  // user should interact with data using `get(), set(), flash(), has()`
  private data: SessionData

  // construct a Session with no data and id
  // private: force user to create session in initMiddleware()
  private constructor (sid : string, data : SessionData) {

    this.sid = sid
    this.data = data
  }

  static initSessionsHandlers(store: Store | CookieStore = new MemoryStore(), {
    expireAfterSeconds = null,
    cookieGetOptions = {},
    cookieSetOptions = {},
    sessionCookieName = 'session'
  }: SessionOptions = {}) {

    const fetchSession: (cookies: Cookies) => Promise<Session | null> = async (cookies) => {
      let session: Session;
      if (store instanceof CookieStore) {
        // load session data from store
        const sessionData = await store.getSessionFromCookie(cookies)
        if (!sessionData) return null
        // load success, check if it's valid (not expired)
        if (this.sessionValid(sessionData)) {
          session = new Session("", sessionData)
          session.reupSession(expireAfterSeconds)
        } else {
          // invalid session
          store.deleteSession(cookies)
          session = await this.createSession(store, expireAfterSeconds)
        }
      } else {
        // get sessionId from cookie
        const sid = await cookies.get(sessionCookieName, cookieGetOptions)

        if (!sid) return null
        // load session data from store
        const sessionData = await store.getSessionById(sid)
        if (!sessionData) return null
        // load success, check if it's valid (not expired)
        if (this.sessionValid(sessionData)) {
          session = new Session(sid, sessionData)
          session.reupSession(expireAfterSeconds)
        } else {
          // invalid session
          await store.deleteSession(sid)
          session = await this.createSession(store, expireAfterSeconds)
        }
      }


      // update _access time
      session.set('_accessed', new Date().toISOString())
      await cookies.set(sessionCookieName, session.sid, cookieSetOptions)
      // return session to ctx.state so user can interact (set, get) with it
      return session
    }
    /// should be called after session usage
    const storeState = async (session: Session | null, cookies: Cookies, rotate_session_key?: boolean) => {
      if (!session) return
      if (rotate_session_key && !(store instanceof CookieStore)) {
        await store.deleteSession(session.sid)
        session = await this.createSession(store, expireAfterSeconds, session.data)
        await cookies.set(sessionCookieName, session.sid, cookieSetOptions)
      }
      // request done, push session data to store
      await session.persistSessionData(store, cookies)

      if (session.data._delete) {
        if (store instanceof CookieStore) {
          store.deleteSession(cookies)
        } else {
          await store.deleteSession(session.sid)
          await cookies.delete(sessionCookieName, cookieSetOptions)
        }
      }
    }
    /// should be called when session sid setting in cookies deliberately
    const createSession: ( cookies: Cookies ) => Promise<Session> = async (cookies) => {
      const session = await this.createSession(store, expireAfterSeconds)
      // update _access time
      session.set('_accessed', new Date().toISOString())
      if (!(store instanceof CookieStore)) {
        await cookies.set(sessionCookieName, session.sid, cookieSetOptions)
      }
      return session
    }
    
    return { fetchSession, storeState, createSession }
  }

  // should only be called in `initMiddleware()` when validating session data
  private static sessionValid(sessionData: SessionData) {
    return sessionData._expire == null || Date.now() < new Date(sessionData._expire).getTime();
  }

  // should only be called in `initMiddleware()`
  private reupSession(expiration : number | null | undefined) {
    // expiration in seconds
    this.data._expire = expiration ? new Date(Date.now() + expiration * 1000).toISOString() : null
  }

  // should only be called in `initMiddleware()` when creating a new session
  private static async createSession(
    store : Store | CookieStore, 
    expiration : number | null | undefined, 
    defaultData?: SessionData
  ) : Promise<Session> {
    const sessionData = defaultData ? defaultData : {
      '_flash': {},
      '_accessed': new Date().toISOString(),
      '_expire': expiration ? new Date(Date.now() + expiration * 1000).toISOString() : null,
      '_delete': false
    }

    let newID = ""
    if (!(store instanceof CookieStore)) {
      newID = await nanoid(21)
      await store.createSession(newID, sessionData)
    }

    return new Session(newID, sessionData)
  }

  // set _delete to true, will be deleted in middleware
  // should be called by user using `ctx.state.session.deleteSession()`
  // we might be able to remove async here, but that might be a breaking change?
  // deno-lint-ignore require-await
  async deleteSession() : Promise<void> {
    this.data._delete = true
  }

  // push current session data to Session.store
  // ctx is needed for CookieStore
  private async persistSessionData(store : Store | CookieStore, cookies: Cookies): Promise<void> {
    return store instanceof CookieStore ? await store.persistSessionData(cookies, this.data) : await store.persistSessionData(this.sid, this.data)
  }

  // Methods exposed for users to manipulate session data

  get(key : string) {
    if (key in this.data) {
      return this.data[key]
    } else {
      const value = this.data['_flash'][key]
      delete this.data['_flash'][key]
      return value
    }
  }

  set(key : string, value : unknown) {
    if(value === null || value === undefined) {
      delete this.data[key]
    } else {
      this.data[key] = value
    }
  }

  flash(key : string, value : unknown) {
    this.data['_flash'][key] = value
  }

  has(key : string) {
    return key in this.data || key in this.data['_flash'];
  }
}
