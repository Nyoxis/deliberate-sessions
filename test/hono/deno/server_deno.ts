import { Hono } from 'hono'
import { html } from 'hono/html'
import initSessionMiddleware from '@nyoxis/deliberate-sessions/hono'
import type { Session } from '@nyoxis/deliberate-sessions'
import MakeDenoStore from './MakeStore.ts'
import 'https://deno.land/std@0.198.0/dotenv/load.ts'

const app = new Hono()
const store = await MakeDenoStore(Deno.env.get('STORE'))

type SessionDataTypes = {
  'email': string
  'failed-login-attempts': number | null
  'message': string
  'error': string
}

const session_routes = new Hono<{
  Variables: {
    session?: Session<SessionDataTypes>
    session_key_rotation?: boolean
  }
}>()

const { sessionMiddleware: honoSession, createSession } = initSessionMiddleware(
  {
    store,
    encryptionKey: Deno.env.get('ENCRYPTION_KEY') ||
      'mandatory-encryption-passphrase-32-chars-long',
    expireAfterSeconds: 30,
    cookieOptions: {
      sameSite: 'Lax',
      path: '/',
      httpOnly: true,
    },
  },
)

session_routes.use('*', honoSession)

session_routes.post('/login', async (c) => {
  let session = c.get('session')

  const { email, password } = await c.req.parseBody()

  if (password === 'correct') {
    if (!session) {
      session = await createSession(c)
      c.set('session', session)
    }
    c.set('session_key_rotation', true)
    session.set('email', email as string)
    session.forget('failed-login-attempts')
    session.flash('message', 'Login Successful')
  } else {
    if (!session) {
      session = await createSession(c)
      c.set('session', session)
    }
    const failedLoginAttempts =
      (session.get('failed-login-attempts') || 0) as number
    session.set('failed-login-attempts', failedLoginAttempts + 1)
    session.flash('error', 'Incorrect username or password')
  }

  return c.redirect('/')
})

session_routes.post('/logout', async (c) => {
  await c.get('session')?.deleteSession()
  return c.redirect('/')
})

session_routes.get('/', (c) => {
  const session = c.get('session')

  const message = session?.get('message') || ''
  const error = session?.get('error') || ''
  const failedLoginAttempts = session?.get('failed-login-attempts')
  const email = session?.get('email')

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hono Sessions</title>
      </head>
      <body>
        ${message && html`
          <p id="message">${message}</p>
        `} ${error && html`
          <p id="error">${error}</p>
        `} ${failedLoginAttempts && html`
          <p id="failed-login-attempts">Failed login attempts: ${failedLoginAttempts}</p>
        `} ${email
          ? html`
            <form id="logout" action="/logout" method="post">
              <button name="logout" id="logout-button" type="submit">
                Log out ${email}
              </button>
            </form>
          `
          : html`
            <form id="login" action="/login" method="post">
              <p>
                <input id="email" name="email" type="text" placeholder="you@email.com">
              </p>
              <p>
                <input id="password" name="password" type="password" placeholder="password">
              </p>
              <button id="login-button" name="login" type="submit">Log in</button>
            </form>
          `}
      </body>
    </html>
  `)
})

app.route('/', session_routes)

Deno.serve(app.fetch)
