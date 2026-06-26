import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from '@koa/bodyparser'
import initSessionMiddleware from '@nyoxis/deliberate-sessions/koa'
import makeStore from './makeStore.ts'

const app = new Koa()
const router = new Router()

app.on('error', (err: any) => {
  console.error(err)
})

// Instantiate session
const store = await makeStore()

// Use body parser for form data
app.use(bodyParser())

// Use Koa session middleware
const { sessionMiddleware, createSession } = initSessionMiddleware({
  store,
  cookieOptions: {
    sameSite: 'lax',
  },
  encryptionKey: 'mandatory-encryption-passphrase-32-chars',
})
app.use(sessionMiddleware)

router.post('/login', async (ctx: any) => {
  const body = (ctx.request as any).body || {}
  const email = body.email
  const password = body.password

  if (password === 'correct') {
    // Deliberately initialize a session upon successful login
    if (!ctx.state.session) {
      ctx.state.session = await createSession(ctx.cookies)
    }
    ctx.state.session.set('email', email)
    ctx.state.session.forget('failed-login-attempts')
    ctx.state.session.flash('message', 'Login successful')
  } else {
    // On failed attempt, deliberately initialize a session if none exists to track failed attempts
    if (!ctx.state.session) {
      ctx.state.session = await createSession(ctx.cookies)
    }
    const failedAttempts =
      (await ctx.state.session.get('failed-login-attempts') || 0) as number
    ctx.state.session.set('failed-login-attempts', failedAttempts + 1)
    ctx.state.session.flash('error', 'Incorrect username or password')
  }
  ctx.redirect('/')
})

router.post('/logout', async (ctx: any) => {
  await ctx.state.session?.deleteSession()
  ctx.redirect('/')
})

router.get('/', async (ctx: any) => {
  const message = await ctx.state.session?.get('message') || ''
  const error = await ctx.state.session?.get('error') || ''
  const failedLoginAttempts = await ctx.state.session?.get(
    'failed-login-attempts',
  )
  const email = await ctx.state.session?.get('email')

  ctx.body = `<!DOCTYPE html>
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

app.listen(8003)
console.log('test server running')
