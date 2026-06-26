import { decrypt, encrypt } from '../Crypto.ts'
import type { SessionData } from '../Session.ts'
import type { GetCookieFn, SetCookieFn } from '../SessionConfig.ts'

interface CookieStoreConfig<
  CookieType,
  CookieOptionsType extends { maxAge?: number } = object,
  GetCookieOptionsType = object,
  SetCookieOptionsType extends { maxAge?: number } = object,
> {
  encryptionKey: string
  cookieOptions?: CookieOptionsType
  cookieGetOptions?: GetCookieOptionsType
  cookieSetOptions?: SetCookieOptionsType
  sessionCookieName?: string
  getCookie: GetCookieFn<CookieType, GetCookieOptionsType & CookieOptionsType>
  setCookie: SetCookieFn<
    CookieType,
    SetCookieOptionsType & CookieOptionsType & { maxAge?: number }
  >
}

/**
 * Empty class.
 *
 * All Cookie options are acquired from SessionConfig.
 */
export class CookieStoreOption {}

/**
 * Cookie storage driver class
 */
class CookieStore<
  CookieType,
  CookieOptionsType extends { maxAge?: number } = object,
  GetCookieOptionsType = object,
  SetCookieOptionsType extends { maxAge?: number } = object,
> {
  public encryptionKey: string
  public cookieGetOptions: GetCookieOptionsType & CookieOptionsType
  public cookieSetOptions: SetCookieOptionsType & CookieOptionsType
  public sessionCookieName: string
  public getCookie: GetCookieFn<
    CookieType,
    GetCookieOptionsType & CookieOptionsType
  >
  public setCookie: SetCookieFn<
    CookieType,
    SetCookieOptionsType & CookieOptionsType & { maxAge?: number }
  >

  constructor(
    config: CookieStoreConfig<
      CookieType,
      CookieOptionsType,
      GetCookieOptionsType,
      SetCookieOptionsType
    >,
  ) {
    this.encryptionKey = config.encryptionKey
    this.cookieGetOptions = {
      ...(config.cookieGetOptions || {}),
      ...(config.cookieOptions || {}),
    } as GetCookieOptionsType & CookieOptionsType
    this.cookieSetOptions = {
      ...(config.cookieSetOptions || {}),
      ...(config.cookieOptions || {}),
    } as SetCookieOptionsType & CookieOptionsType & { maxAge?: number }
    this.sessionCookieName = config.sessionCookieName || 'session'
    this.getCookie = config.getCookie
    this.setCookie = config.setCookie
  }

  async getSession(c: CookieType): Promise<SessionData | null> {
    let session_data_raw: string

    const sessionCookie = await this.getCookie(
      c,
      this.sessionCookieName,
      this.cookieGetOptions,
    )

    if (this.encryptionKey && sessionCookie) {
      // Decrypt cookie string. If decryption fails, return null
      try {
        session_data_raw =
          (await decrypt(this.encryptionKey, sessionCookie)) as string
      } catch {
        return null
      }

      // Parse session object from cookie string and return result. If fails, return null
      try {
        const session_data = JSON.parse(session_data_raw) as SessionData
        return session_data
      } catch {
        return null
      }
    } else {
      return null
    }
  }

  async createSession(c: CookieType, initial_data: SessionData): Promise<void> {
    const stringified_data = JSON.stringify(initial_data)
    await this.setCookie(
      c,
      this.sessionCookieName,
      this.encryptionKey
        ? await encrypt(this.encryptionKey, stringified_data)
        : stringified_data,
      this.cookieSetOptions,
    )
  }

  async deleteSession(c: CookieType): Promise<void> {
    await this.setCookie(c, this.sessionCookieName, '', {
      ...this.cookieSetOptions,
      maxAge: 0,
    })
  }

  async persistSessionData(
    c: CookieType,
    session_data: SessionData,
  ): Promise<void> {
    const stringified_data = JSON.stringify(session_data)
    await this.setCookie(
      c,
      this.sessionCookieName,
      this.encryptionKey
        ? await encrypt(this.encryptionKey, stringified_data)
        : stringified_data,
      this.cookieSetOptions,
    )
  }
}

export default CookieStore
