# Deliberate-Sessions

A secure, framework-agnostic session middleware engine for Node.js, Deno, and
Bun. Highly inspired by and consolidating features from
[Oak-sessions](https://github.com/jcs224/oak_sessions) and
[Hono-sessions](https://github.com/jcs224/hono_sessions).

In addition to custom integrations, out-of-the-box middlewares are included for:

- **Hono** (Node.js, Bun, Deno, Cloudflare Workers/Pages)
- **Koa** (Node.js, Bun)
- **Oak** (Deno)

---

## 🛠️ Features

- **Flash Messages**: Data that is deleted automatically once read once (ideal
  for one-off success/error alerts).
- **Encrypted Cookies**: Client-side encrypted cookies powered by
  [iron-webcrypto](https://github.com/brc-dd/iron-webcrypto).
- **Session Expiration**: Automatic expiration after inactivity (configurable
  via `expireAfterSeconds`).
- **Auto-Extend Expiration**: Automatically extends the session expiration on
  active requests.
- **Session Key Rotation**: Easily rotate session IDs to mitigate session
  fixation attacks (when using server-side stores).
- **Strong Typing**: Full TypeScript generic support for session variables.
- **Driver Agnostic**: Built-in Memory, Cookie, Postgres, SQLite, Redis, Webdis,
  and MongoDB stores.

---

## 💡 Why "Deliberate" Sessions?

Unlike standard session managers that automatically instantiate a session and
drop cookies for _every single incoming request_ (including guest visits, search
engine crawlers, and static asset queries), **Deliberate-Sessions** is designed
on a **consent-first, deliberate model**.

Sessions are only initialized when you explicitly call `createSession(..)`.

### Use Cases:

1. **GraphQL APIs**: A single endpoint (e.g. `/graphql`) handles all operations.
   Auto-creating a session for every pre-fetch, introspection query, or guest
   request results in database pollution with thousands of empty, useless
   session records. Deliberate creation ensures sessions are only generated upon
   a successful login mutation.
2. **GDPR and Privacy Compliance**: Under regulations like the GDPR, you must
   obtain user consent before using cookies or storing tracking keys. With
   deliberate sessions, you can easily implement a consent-first architecture by
   only creating a session after the user opts-in or signs in.

---

## 📦 Installation

To install **Deliberate-Sessions**, use the appropriate command for your runtime/package manager:

### Deno
```bash
deno add @nyoxis/deliberate-sessions
```

### Node.js (npm)
```bash
npx jsr add @nyoxis/deliberate-sessions
```

### Bun
```bash
bunx jsr add @nyoxis/deliberate-sessions
```

### pnpm
```bash
pnpm dlx jsr add @nyoxis/deliberate-sessions
```

### Yarn
```bash
yarn dlx jsr add @nyoxis/deliberate-sessions
```

---

## 🚀 Middleware & Setup

### Out-of-the-box Middlewares

For supported frameworks, you can import pre-built middlewares directly:

- **Hono**: `import { initSessionMiddleware } from "@nyoxis/deliberate-sessions/hono"`
- **Koa**: `import { initSessionMiddleware } from "@nyoxis/deliberate-sessions/koa"`
- **Oak**: `import { initSessionMiddleware } from "@nyoxis/deliberate-sessions/oak"`

Example using **Hono**:

```typescript
import { Hono } from 'hono'
import {
  CookieStoreOption,
  initSessionMiddleware,
} from '@nyoxis/deliberate-sessions/hono'

const app = new Hono()
const store = new CookieStoreOption() // Select client-side encrypted cookie storage

const { sessionMiddleware, createSession } = initSessionMiddleware({
  store,
  encryptionKey: 'password_at_least_32_characters_long',
  cookieOptions: {
    sameSite: 'Lax',
    path: '/',
    httpOnly: true,
  },
})

app.use('*', sessionMiddleware)

app.post('/login', async (c) => {
  // Deliberately initialize a session only on successful login
  const session = await createSession(c)
  session.set('user_id', '123')
  return c.text('Logged in')
})
```

### Implementing in Any Framework (Using Accessors)

If you are using a routing framework that is not officially pre-packaged, you
can initialize the core handlers yourself by providing custom `getCookie` and
`setCookie` accessors.

Specify your session's strongly-typed variables and your framework's
context/cookie type using:
`initSessionsHandlers<MySessionVariables, FrameworkContextOrCookieType>`

```typescript
import { CookieStoreOption, initSessionsHandlers } from '@nyoxis/deliberate-sessions'

// 1. Define the variables your session is allowed to store
interface MySessionVariables {
  userId: string
  failedLoginAttempts: number
  message?: string
}

// 2. Initialize handlers
const { fetchSession, storeState, createSession } = initSessionsHandlers<
  MySessionVariables,
  FrameworkContextOrCookieType
>({
  store: new CookieStoreOption(),
  encryptionKey: 'password_at_least_32_characters_long',
  getCookie: (ctx, name) => {
    // ctx is of type FrameworkContextOrCookieType
    return ctx.request.cookies.get(name)
  },
  setCookie: (ctx, name, value, options) => {
    ctx.response.cookies.set(name, value, options)
  },
})

// 3. Resolve the session from the current request context
const session = await fetchSession(ctx)

// 4. Save session changes (writes updated cookies or commits data to database stores)
// NOTE: `storeState` must be executed and awaited at the end of the request-response lifecycle
// (after your route handler has finished executing) so it can capture any modifications
// made to the session (like session.set("userId", ...)) and persist them correctly.
await storeState(session, ctx)

// 5. Create a new session deliberately (e.g. upon user login)
const newSession = await createSession(ctx)
```

---

## 📝 Session API

Once you have a `Session` object (returned by `fetchSession`, `createSession`,
or retrieved from your middleware context), you can interact with it using the
following methods:

### `session.get(key)`

Retrieves a value from the session by its key.

- **Parameters**: `key: string` (or `K extends keyof T` for strongly-typed
  sessions).
- **Returns**: The stored value, or `null` if the key does not exist.
- _Note_: If the key was set using `.flash()`, it will be deleted from the
  session immediately after being read once.

### `session.set(key, value)`

Sets a value in the session.

- **Parameters**:
  - `key: string`
  - `value: any` (type-checked to `T[K]` for strongly-typed sessions).

### `session.flash(key, value)`

Sets a temporary flash message that is automatically deleted the first time it
is read using `.get()`. This is ideal for one-time success or error
notifications.

- **Parameters**:
  - `key: string`
  - `value: any`

### `session.forget(key)`

Removes a specific key and its value from the session.

- **Parameters**: `key: string`

### `session.deleteSession()`

Marks the entire session for deletion. During `storeState` (at the end of the
request-response lifecycle), the session will be completely destroyed from the
backend database or client cookies.

### `session.touch()`

Manually extends the session's expiration time (re-calculates expiration based
on `expireAfterSeconds`) and updates the last accessed timestamp.

---

## 🗄️ Storage Drivers

To select a session store, pass its configuration instance into the `store`
option:

- **Cookie Storage**: Use `new CookieStoreOption()` for stateless, client-side
  encrypted cookie sessions.
- **Memory Storage**: Use `new MemoryStore()` for stateful, in-memory session
  storage (ideal for local development or testing).
- **Database Storage**: For other database stores (Postgres, SQLite, Redis,
  Webdis, and MongoDB), refer to the comprehensive
  [Stores README](https://github.com/Nyoxis/deliberate-sessions/blob/main/src/stores/README.md)
  for constructor parameters and db client configurations.

### Cookie Storage (CookieStoreOption) Peculiarities

When choosing `CookieStoreOption` for stateless client-side sessions, please
keep the following in mind:

1. **Size Limits**: Browsers generally restrict individual cookie sizes to
   **4KB** (including names, values, and attributes). Since the entire session
   payload is serialized, encrypted, and stored in the cookie itself, avoid
   storing large objects (like base64 assets or large state trees) in the
   session.
2. **Encryption Requirement**: `CookieStoreOption` requires `encryptionKey` to
   be provided in the configuration. The key must be at least **32 characters**
   long.

### Custom & Community Stores

This library is fully compatible with the custom store driver interfaces
established in the `hono_sessions`/`oak_sessions` ecosystems.

- Check out the list of
  [hono_sessions Community Adapters](https://github.com/jcs224/hono_sessions/wiki/Community-adapters)
  for pre-built drivers.
- Learn how to build your own adapter by reading the
  [hono_sessions Custom Storage Driver Guide](https://github.com/jcs224/hono_sessions/wiki/Creating-a-custom-storage-driver).

---

## 🔒 Security P.S. (Headers vs Cookies)

You may notice that if the custom `getCookie`/`setCookie` accessors are
configured to fetch and modify HTTP headers (such as the
`Authorization: Bearer <token>` header) instead of cookies:

1. **Bearer Token Sessions**: The engine naturally functions as a **bearer-token
   session manager**.
2. **Stateless JWTs**: When using `CookieStoreOption` in tandem with header
   accessors, the session data is encrypted client-side and returned as a
   stateless bearer token, behaving identically to a **JWT**.

### ⚠️ A Warning on Token Storage

While this is technically possible, **one should avoid using headers/bearer
tokens for web session management and instead use HTTP-only cookies, even when
building for native apps.**

Storing session keys or JWTs in client-accessible locations (like `localStorage`
or memory variables) exposes your application to token extraction via
**Cross-Site Scripting (XSS)** vulnerabilities. In contrast, configuring cookies
with `HttpOnly`, `Secure`, and `SameSite` flags ensures the browser manages the
token safely outside the reach of client-side scripts.

For native applications, utilizing standard HTTP cookies (which are natively
supported by iOS and Android web clients/HTTP libraries) provides a much safer,
unified, and standard session state backend.

For a deeper dive into session security, refer to the
[OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
