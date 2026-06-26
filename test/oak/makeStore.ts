import { CookieStoreOption, MemoryStore, Store } from '@nyoxis/deliberate-sessions'
import PostgresStore from '@nyoxis/deliberate-sessions/postgres-store'
import RedisStore from '@nyoxis/deliberate-sessions/redis-store'
import SqliteStore from '@nyoxis/deliberate-sessions/sqlite-store'
import MongoStore from '@nyoxis/deliberate-sessions/mongo-store'
import WebdisStore from '@nyoxis/deliberate-sessions/webdis-store'

function makeStore(): Promise<Store | CookieStoreOption> {
  const storeType = Deno.env.get('STORE')
  console.info(`Creating session store of type ${storeType}`)

  switch (storeType) {
    case 'cookie':
      return createCookieStore()
    case 'sqlite':
      return createSQLiteStore()
    case 'redis':
      return createRedisStore()
    case 'webdis':
      return createWebdisStore()
    case 'postgres':
      return createPostgresStore()
    case 'mongo':
      return createMongoStore()
    case 'memory':
      return createMemoryStore()
    default:
      throw new Error(`Unknown STORE type specified: ${storeType}`)
  }
}

function createCookieStore() {
  return Promise.resolve(new CookieStoreOption())
}

function createMemoryStore() {
  return Promise.resolve(new MemoryStore())
}

async function createSQLiteStore() {
  const { Database } = await import('jsr:@db/sqlite')
  const db = new Database('./database.db')
  const store = new SqliteStore(db.sql.bind(db))
  return store
}

function createWebdisStore() {
  const store = new WebdisStore({
    url: 'http://localhost:7379',
  })
  return Promise.resolve(store)
}

async function createPostgresStore() {
  const { default: postgres } = await import(
    'https://deno.land/x/postgresjs@v3.4.9/mod.js'
  )
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })
  const store = new PostgresStore(sql)
  try {
    await sql`DROP TABLE IF EXISTS sessions`
  } catch (e) {}
  await store.initSessionsTable()
  return store
}

async function createMongoStore() {
  const { MongoClient } = await import(
    'https://deno.land/x/mongo@v0.34.0/mod.ts'
  )
  const client = new MongoClient()
  const mongo = await client.connect('mongodb://localhost:27017')
  return new MongoStore(mongo)
}

async function createRedisStore() {
  const { connect: connectRedis } = await import(
    'https://deno.land/x/redis@v0.41.2/mod.ts'
  )
  const redis = await connectRedis({
    hostname: '127.0.0.1',
    port: 6379,
  })
  return new RedisStore(redis.sendCommand.bind(redis))
}

export default makeStore