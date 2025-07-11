import { encryptCryptoJSAES, decryptCryptoJSAES } from '../crypto.ts';
import type { CookiesGetOptions, CookiesSetDeleteOptions, Cookies } from '../../deps.ts'
import type { SessionData } from '../Session.ts'

interface CookieStoreOptions {
  cookieGetOptions?: CookiesGetOptions;
  cookieSetDeleteOptions?: CookiesSetDeleteOptions;
  sessionDataCookieName?: string
}

export default class CookieStore {
  encryptionKey: string

  cookieGetOptions: CookiesGetOptions;
  cookieSetDeleteOptions: CookiesSetDeleteOptions;
  sessionDataCookieName: string;

  constructor(encryptionKey : string, options? : CookieStoreOptions) {
    this.encryptionKey = encryptionKey

    this.cookieGetOptions = options?.cookieGetOptions ?? {}
    this.cookieSetDeleteOptions = options?.cookieSetDeleteOptions ?? {}
    this.sessionDataCookieName = options?.sessionDataCookieName ?? 'session_data'
  }

  async getSessionFromCookie(cookies : Cookies) : Promise<SessionData | null> {
    const sessionDataString : string | undefined = await cookies.get(this.sessionDataCookieName, this.cookieGetOptions)

    if (!sessionDataString) return null;

    try {
      const decryptedCookie = await decryptCryptoJSAES(sessionDataString, this.encryptionKey)
      return JSON.parse(decryptedCookie)
    } catch {
      return null
    }

  }

  async createSession(cookies : Cookies, initialData : SessionData) {
    const dataString = JSON.stringify(initialData)

    const encryptedCookie = await encryptCryptoJSAES(dataString, this.encryptionKey)
    await cookies.set(this.sessionDataCookieName, encryptedCookie, this.cookieSetDeleteOptions)
  }

  deleteSession(cookies : Cookies) {
    cookies.delete(this.sessionDataCookieName, this.cookieSetDeleteOptions)
  }

  async persistSessionData(cookies : Cookies, data : SessionData) {
    const dataString = JSON.stringify(data)

    const encryptedCookie = await encryptCryptoJSAES(dataString, this.encryptionKey)
    await cookies.set(this.sessionDataCookieName, encryptedCookie, this.cookieSetDeleteOptions)
  }
}
