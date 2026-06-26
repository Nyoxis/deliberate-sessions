import type { Context, Middleware, Next } from 'koa'
import type { GetOption, SetOption } from 'cookies'

import type Session from '../Session.ts'
import type SessionConfig from '../SessionConfig.ts'
import initSessionsHandlers from '../Handlers.ts'

export interface SessionMiddlewareConfig extends Omit<
  SessionConfig<
    Context['cookies'],
    GetOption & SetOption,
    GetOption,
    SetOption
  >,
  'getCookie' | 'setCookie'
> {}

/**
 * Koa session middleware. Conforms to the deliberate sessions model by only loading existing sessions.
 */
function initSessionMiddleware<T = any>(
  options: SessionMiddlewareConfig,
): {
  sessionMiddleware: Middleware
  createSession: (cookies: Context['cookies']) => Promise<Session<T>>
} {
  const { fetchSession, storeState, createSession } = initSessionsHandlers<
    T,
    Context['cookies'],
    GetOption & SetOption,
    GetOption,
    SetOption
  >({
    ...options,
    getCookie: (cookies, name, opts) => cookies.get(name, opts),
    setCookie: (cookies, name, value, opts) => {
      cookies.set(name, value, opts)
    },
  })

  const sessionMiddleware: Middleware = async (
    ctx: Context,
    next: Next,
  ): Promise<void> => {
    const session = await fetchSession(ctx.cookies)
    if (session) {
      ctx.state.session = session
    }

    await next()

    const rotate = ctx.state.session_key_rotation === true
    await storeState(ctx.state.session, ctx.cookies, rotate)
  }

  return { sessionMiddleware, createSession }
}

export default initSessionMiddleware
