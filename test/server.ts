import { Application, Router } from "jsr:@oak/oak@^17"
import { Session } from '../mod.ts'
import { makeStore } from "./makeStore.ts";

type AppState = {
    session: Session
}
const app = new Application<AppState>()

app.addEventListener('error', (evt) => {
    console.log(evt.error)
})

const router = new Router<AppState>();

// Instantiate session
const store = await makeStore()
// const session = new Session(store)
const { fetchSession, storeState, createSession } = Session.initSessionsHandlers(store,
    {
        cookieSetOptions: {
            sameSite: 'lax'
        }
    }
)
// Apply sessions to your Oak application. You can also apply the middleware to specific routes instead of the whole app.
app.use(async (ctx, next) => {
    const session = await fetchSession(ctx.cookies);
    if (session) {
        ctx.state.session = session
    }
    await next();
    await storeState(ctx.state.session, ctx.cookies)
})

router.post('/login', async (ctx) => {
  const form = await ctx.request.body.form()
    if(form.get('password') === 'correct') {
        ctx.state.session = await createSession(ctx.cookies);
        // Set persistent data in the session
        ctx.state.session.set('email', form.get('email'))
        // Set flash data in the session. This will be removed the first time it's accessed with get
        ctx.state.session.flash('message', 'Login successful')
    }
    ctx.response.redirect('/')
})

router.post('/logout', async (ctx) => {
    // Clear all session data
    await ctx.state.session.deleteSession()
    ctx.response.redirect('/')
})

router.get("/", async (ctx) => {
    const message = await ctx.state.session?.get('message') || ''
    const error = await ctx.state.session?.get('error') || ''
    const email = await ctx.state.session?.get('email')
    ctx.response.body = `<!DOCTYPE html>
    <body>
        <p id="message">
            ${message}
        </p>
        <p id="error">
            ${error}
        </p>

        ${email ? 
        `<form id="logout" action="/logout" method="post">
            <button name="logout" type="submit" id="logout-button">Log out ${email}</button>
        </form>`
        : 
        `<form id="login" action="/login" method="post">
            <p>
                <input id="email" name="email" type="text" placeholder="you@email.com">
            </p>
            <p>
                <input id="password" name="password" type="password" placeholder="password">
            </p>
            <button name="login" id="login-button" type="submit">Log in</button>
        </form>` 
    }
    </body>`;
})

app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8002 })
console.log('test server running')
