import { getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { Context, Env, MiddlewareHandler } from 'hono'

import type Session from '../Session.ts'
import type SessionConfig from '../SessionConfig.ts'
import initSessionsHandlers from '../Handlers.ts'

import type { CookieOptions as HonoCookieOptions } from 'hono/utils/cookie'

export interface SessionMiddlewareConfig<
  E extends Env = any,
  P extends string = any,
> extends
  Omit<
    SessionConfig<Context<E, P>, HonoCookieOptions>,
    'getCookie' | 'setCookie'
  > {}
/**
 * Hono session middleware. Conforms to the deliberate sessions model by only loading existing sessions.
 */
function initSessionMiddleware<
  T = any,
  E extends Env = any,
  P extends string = any,
>(
  options: SessionMiddlewareConfig<E, P>,
): {
  sessionMiddleware: MiddlewareHandler<E, P>
  createSession: (c: Context<E, P>) => Promise<Session<T>>
} {
  const { fetchSession, storeState, createSession } = initSessionsHandlers<
    T,
    Context<E, P>
  >({
    ...options,
    getCookie: (c, name) => getCookie(c, name, options.cookieOptions?.prefix),
    setCookie: (c, name, value, opts) => setCookie(c, name, value, opts),
  })

  const sessionMiddleware = createMiddleware(async (c, next) => {
    const session = await fetchSession(c)
    if (session) {
      c.set('session', session)
    }

    await next()

    const rotate = c.get('session_key_rotation') === true
    await storeState(c.get('session') || null, c, rotate)
  })

  return { sessionMiddleware, createSession }
}

export default initSessionMiddleware
