# Deliberate-Sessions

Based on [Oak-sessions](https://github.com/jcs224/oak_sessions), this package has been modified to implement deliberate cookie-based sessions.

It is designed to be more framework-agnostic, although it currently depends on Oak's cookie handling.

## Usage

```ts
const { fetchSession, storeState, createSession } = Session.initSessionsHandlers(store)
// Handlers can be used in simple middleware
app.use(async (ctx, next) => {
    const session = await fetchSession(ctx.cookies);
    if (session) {
        ctx.state.session = session
    }
    await next();
    await storeState(ctx.state.session, ctx.cookies)
})
```