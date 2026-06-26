import { Application, Router } from 'oak'
import initSessionMiddleware from '@nyoxis/deliberate-sessions/oak'
import makeStore from './makeStore.ts'
import type { Session } from '@nyoxis/deliberate-sessions'

type AppState = {
  session: Session
}
const app = new Application<AppState>()

app.addEventListener('error', (evt) => {
  console.log(evt.error)
})

const router = new Router<AppState>()

// Instantiate session
const store = await makeStore()

// Use the packaged oakSession middleware
const { sessionMiddleware, createSession } = initSessionMiddleware({
  store,
  cookieOptions: {
    sameSite: 'lax',
  },
  encryptionKey: 'mandatory-encryption-passphrase-32-chars',
})
app.use(sessionMiddleware)

router.post('/login', async (ctx) => {
  const form = await ctx.request.body.form()
  const email = form.get('email')
  const password = form.get('password')

  if (password === 'correct') {
    if (!ctx.state.session) {
      ctx.state.session = await createSession(ctx.cookies)
    }
    ctx.state.session.set('email', email)
    ctx.state.session.forget('failed-login-attempts')
    ctx.state.session.flash('message', 'Login successful')
  } else {
    if (!ctx.state.session) {
      ctx.state.session = await createSession(ctx.cookies)
    }
    const failedAttempts =
      (await ctx.state.session.get('failed-login-attempts') || 0) as number
    ctx.state.session.set('failed-login-attempts', failedAttempts + 1)
    ctx.state.session.flash('error', 'Incorrect username or password')
  }
  ctx.response.redirect('/')
})

router.post('/logout', async (ctx) => {
  // Clear all session data
  await ctx.state.session?.deleteSession()
  ctx.response.redirect('/')
})

router.get('/', async (ctx) => {
  const message = await ctx.state.session?.get('message') || ''
  const error = await ctx.state.session?.get('error') || ''
  const failedLoginAttempts = await ctx.state.session?.get(
    'failed-login-attempts',
  )
  const email = await ctx.state.session?.get('email')
  ctx.response.body = `<!DOCTYPE html>
    <body>
        <p id="message">
            ${message}
        </p>
        <p id="error">
            ${error}
        </p>
        ${
    failedLoginAttempts
      ? `<p id="failed-login-attempts">Failed login attempts: ${failedLoginAttempts}</p>`
      : ''
  }

        ${
    email
      ? `<form id="logout" action="/logout" method="post">
            <button name="logout" type="submit" id="logout-button">Log out ${email}</button>
        </form>`
      : `<form id="login" action="/login" method="post">
            <p>
                <input id="email" name="email" type="text" placeholder="you@email.com">
            </p>
            <p>
                <input id="password" name="password" type="password" placeholder="password">
            </p>
            <button name="login" id="login-button" type="submit">Log in</button>
        </form>`
  }
    </body>`
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen({ port: 8002 })
console.log('test server running')
