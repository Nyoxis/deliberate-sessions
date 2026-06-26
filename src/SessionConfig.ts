import type Store from './stores/Store.ts'
import type { CookieStoreOption } from './stores/CookieStore.ts'

/*
 * Getter used with CookieType
 */
export interface GetCookieFn<CookieType, OptionsType = object> {
  (
    cookies: CookieType,
    name: string,
    options?: OptionsType,
  ): string | undefined | Promise<string | undefined>
}

/*
 * Setter used with CookieType, maxAge option must be specified for CookieStoreOption for cookie deletion to work
 */
export interface SetCookieFn<
  CookieType,
  OptionsType extends { maxAge?: number } = object,
> {
  (
    cookies: CookieType,
    name: string,
    value: string,
    options?: OptionsType,
  ): void | Promise<void>
}

interface SessionConfig<
  CookieType = null,
  CookieOptionsType extends { maxAge?: number } = object,
  CookieGetOptionsType = CookieOptionsType,
  CookieSetOptionsType extends { maxAge?: number } = CookieOptionsType
> {
  store: Store | CookieStoreOption
  encryptionKey?: string | (() => string)
  expireAfterSeconds?: number
  cookieOptions?: CookieOptionsType
  sessionCookieName?: string
  autoExtendExpiration?: boolean
  cookieGetOptions?: CookieGetOptionsType
  cookieSetOptions?: CookieSetOptionsType
  getCookie: GetCookieFn<CookieType, CookieOptionsType & CookieGetOptionsType>
  setCookie: SetCookieFn<
    CookieType,
    CookieOptionsType & CookieSetOptionsType & { maxAge?: number }
  >
}

export default SessionConfig
