# Session Stores & Custom Connectors

This directory contains the database store implementations for
`deliberate-sessions`. To remain completely environment and driver agnostic:

- The **SQL-based stores** (`SqliteStore`, `PostgresStore`) accept a **tagged
  template literal SQL executor function** in their constructor.
- The **Redis store** (`RedisStore`) accepts a generic **command runner
  function** `(command, args)`.
- The **MongoDB store** (`MongoStore`) accepts a collection/database interface
  compatible with standard mongo clients in both Deno and Node.js.

---

## Why Tagged Template SQL Executors & `sql-template-strings`?

When writing SQL queries, parameterization is crucial to prevent **SQL
Injection** vulnerabilities. However, different database drivers and clients use
different query parameter syntax:

- **PostgreSQL (`pg`)** uses `$1, $2, $3` placeholders.
- **SQLite / MySQL / MariaDB** use `?` placeholders.

Using the `sql-template-strings` package allows you to write clean tagged
template queries like:

```typescript
sql`SELECT data FROM sessions WHERE id = ${sessionId}`
```

The query is automatically parsed into a database-native format containing:

1. A parameterized query string (with the correct placeholders, e.g., `$1` or
   `?`).
2. An array of values to bind.

### How to Write a Custom Connector

If a database client doesn't support template literals natively, you can easily
wrap it using `sql-template-strings`:

```typescript
import SQL from 'sql-template-strings'

function createCustomExecutor(dbClient) {
  return async function sql(strings: TemplateStringsArray, ...values: any[]) {
    // 1. Parse the template string
    const statement = SQL(strings, ...values)

    // 2. Execute using the client's standard query method
    // - Use `statement.text` for $1, $2 (Postgres)
    // - Use `statement.sql` for ? (SQLite)
    const result = await dbClient.query(statement.text, statement.values)
    return result
  }
}
```

---

## Instructions for `SqliteStore`

The `SqliteStore` expects the executor function to execute the query and return
the rows as **raw arrays** (e.g., `[[ "session-data-json" ]]`).

### Constructor Parameters & Autocreation

- **`sql`** (required): The tagged template literal executor function.
- **`tableName`** (optional, defaults to `'sessions'`): The name of the sessions
  table in the SQLite database.

**Autocreation**: The store's constructor **automatically** attempts to create
the sessions table if it doesn't already exist by running:

```sql
CREATE TABLE IF NOT EXISTS tableName (id TEXT, data TEXT)
```

No manual table initialization is required.

### 1. Deno (`jsr:@db/sqlite`)

Deno's SQLite driver natively supports template strings out-of-the-box using the
`db.sql` property. No wrapping is required:

```typescript
import { Database } from 'jsr:@db/sqlite'
import SqliteStore from 'deliberate-sessions/sqlite-store'

const db = new Database('./database.db')
const store = new SqliteStore(db.sql.bind(db))
```

### 2. Native Node.js (`node:sqlite`)

Node.js 22.5+ includes a native SQLite module. We wrap it using `statement.sql`
(which yields `?` placeholders):

```typescript
import { DatabaseSync } from 'node:sqlite'
import SQL from 'sql-template-strings'
import SqliteStore from 'deliberate-sessions/sqlite-store'

const db = new DatabaseSync('./database.db')

const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const statement = SQL(strings, ...values)
  const stmt = db.prepare(statement.sql)
  stmt.setReturnArrays(true) // Return raw arrays of rows: [ [data] ]
  return stmt.all(...statement.values)
}

const store = new SqliteStore(sql)
```

### 3. Bun (`bun:sqlite`)

Bun's native `Database` driver can be wrapped in a similar fashion using
`db.prepare(..).values(..)` to return raw arrays:

```typescript
import { Database } from 'bun:sqlite'
import SQL from 'sql-template-strings'
import SqliteStore from 'deliberate-sessions/sqlite-store'

const db = new Database('./database.db')

const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const statement = SQL(strings, ...values)
  return db.prepare(statement.sql).values(...statement.values) // Returns [ [data] ]
}

const store = new SqliteStore(sql)
```

### 4. `better-sqlite3` (npm)

If using `better-sqlite3` on Node, use `.raw().all()` to output raw arrays:

```typescript
import Database from 'better-sqlite3'
import SQL from 'sql-template-strings'
import SqliteStore from 'deliberate-sessions/sqlite-store'

const db = new Database('database.db')

const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const statement = SQL(strings, ...values)
  const stmt = db.prepare(statement.sql)
  return stmt.raw().all(...statement.values) // Returns [ [data] ]
}

const store = new SqliteStore(sql)
```

---

## Instructions for `PostgresStore`

The `PostgresStore` expects the executor to return an array of objects
representing the rows (e.g. `[{ data: "session-data-json" }]`).

### Constructor Parameters & Autocreation

- **`sql`** (required): The tagged template literal executor function.
- **`tableName`** (optional, defaults to `'sessions'`): The name of the sessions
  table in the PostgreSQL database.

**Autocreation**: Because PostgreSQL table creation is an asynchronous
operation, the constructor **does not** automatically create the table. You
should explicitly initialize the table during your application startup:

```typescript
const store = new PostgresStore(sql, 'my_sessions')
await store.initSessionsTable() // Autocreates the table if not present
```

Under the hood, `initSessionsTable()` runs:

```sql
CREATE TABLE IF NOT EXISTS tableName (id varchar not null primary key, data varchar)
```

### 1. `postgres` (postgres.js)

The popular `postgres` driver (compatible with Node, Deno, and Bun) natively
supports template strings:

```typescript
import postgres from 'postgres'
import PostgresStore from 'deliberate-sessions/postgres-store'

const sql = postgres('postgres://user:password@localhost:5432/dbname')
const store = new PostgresStore(sql)
```

### 2. `pg` (npm)

The legacy `pg` driver expects query strings and parameters, so we wrap it using
`statement.text` (which yields `$1, $2` placeholders):

```typescript
import pg from 'pg'
import SQL from 'sql-template-strings'
import PostgresStore from 'deliberate-sessions/postgres-store'

const client = new pg.Client({ connectionString: 'postgres://...' })
await client.connect()

const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  const statement = SQL(strings, ...values)
  const result = await client.query(statement.text, statement.values)
  return result.rows // Returns array of row objects
}

const store = new PostgresStore(sql)
```

---

## Instructions for `RedisStore`

`RedisStore` is database-driver agnostic. Instead of wrapping connections or raw
client instances, it takes a simple command-sending function of signature
`(command: string, args: any[]) => Promise<any>`. This makes it compatible with
any Redis library across Node, Deno, and Bun.

### Constructor Parameters

- **`sendCommand`** (required): Function to execute Redis commands.
- **`keyPrefix`** (optional, defaults to `'session_'`): Prefix prepended to all
  session keys stored in Redis.
- **`ttl`** (optional, in seconds): Time-to-live. If specified, the store
  appends the `EX <ttl>` flag to the Redis `SET` command, instructing Redis to
  automatically clean up expired sessions.

For example, to configure a store with a custom prefix and a 1-day TTL:

```typescript
const store = new RedisStore(sendCommand, 'my_prefix_', 86400)
```

### 1. npm: `ioredis`

Pass a function that calls `redis.call`:

```typescript
import Redis from 'ioredis'
import RedisStore from 'deliberate-sessions/redis-store'

const redis = new Redis('redis://localhost:6379')
const store = new RedisStore((command, args) => redis.call(command, ...args))
```

### 2. npm: `redis` (node-redis)

Pass a function that wraps the client's `.sendCommand()` method:

```typescript
import { createClient } from 'redis'
import RedisStore from 'deliberate-sessions/redis-store'

const redis = createClient({ url: 'redis://localhost:6379' })
await redis.connect()

const store = new RedisStore((command, args) =>
  redis.sendCommand([command, ...args])
)
```

### 3. Deno (`https://deno.land/x/redis`)

Simply bind the `sendCommand` function of Deno's redis client:

```typescript
import { connect } from 'https://deno.land/x/redis/mod.ts'
import RedisStore from 'deliberate-sessions/redis-store'

const redis = await connect({ hostname: '127.0.0.1', port: 6379 })
const store = new RedisStore(redis.sendCommand.bind(redis))
```

---

## Instructions for `MongoStore`

MongoDB client libraries share the same basic query API across Deno and Node.js.
`MongoStore` accepts any database object that implements a `.collection(name)`
method, which in turn returns a collection with `.findOne`, `.replaceOne`, and
`.deleteOne` methods.

### Constructor Parameters & Autocreation

- **`db`** (required): The MongoDB database instance.
- **`collectionName`** (optional, defaults to `'sessions'`): The name of the
  collection where sessions will be stored.

**Autocreation**: MongoDB dynamically creates the database and collection upon
the first session write. No schema definition or manual collection creation is
required.

### 1. Node.js / Bun (`mongodb`)

Pass the resolved database object from the official Mongo client:

```typescript
import { MongoClient } from 'mongodb'
import MongoStore from 'deliberate-sessions/mongo-store'

const client = new MongoClient('mongodb://localhost:27017')
await client.connect()
const db = client.db('test')

const store = new MongoStore(db)
```

### 2. Deno (`https://deno.land/x/mongo`)

Pass the database object resolved from the Deno Mongo client:

```typescript
import { MongoClient } from 'https://deno.land/x/mongo/mod.ts'
import MongoStore from 'deliberate-sessions/mongo-store'

const client = new MongoClient()
const db = await client.connect('mongodb://localhost:27017')

const store = new MongoStore(db)
```

---

## Instructions for `WebdisStore`

`WebdisStore` stores session data using a Webdis endpoint (an HTTP interface to
a Redis server). This is ideal for serverless environments or restricted runtime
containers where direct TCP connections are prohibited (e.g., Deno Deploy,
Cloudflare Workers).

It requires a Webdis URL and works identically across Deno, Node.js, and Bun.

### Configuration Options & Autocreation

- **`options`** (required object):
  - **`url`** (required string): The Webdis server URL endpoint.
  - **`keyPrefix`** (optional string, defaults to `'session_'`): Prefix
    prepended to all session keys stored in Redis.

```typescript
import WebdisStore from 'deliberate-sessions/webdis-store'

const store = new WebdisStore({
  url: 'http://127.0.0.1:7379',
  // Optional: basic auth credentials
  // user: "username",
  // password: "password"
})
```
