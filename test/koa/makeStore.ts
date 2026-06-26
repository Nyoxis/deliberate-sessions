import { CookieStoreOption, MemoryStore, Store } from '@nyoxis/deliberate-sessions'
import PostgresStore from '@nyoxis/deliberate-sessions/postgres-store'
import RedisStore from '@nyoxis/deliberate-sessions/redis-store'
import SqliteStore from '@nyoxis/deliberate-sessions/sqlite-store'
import MongoStore from '@nyoxis/deliberate-sessions/mongo-store'
import WebdisStore from '@nyoxis/deliberate-sessions/webdis-store'

const getStore = (storeClass: any) => {
  return storeClass.default || storeClass
}

function makeStore(): Promise<Store | CookieStoreOption> {
  const storeType =
    (typeof Deno !== 'undefined' ? Deno.env.get('STORE') : process.env.STORE) ||
    'cookie'
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
  const { DatabaseSync } = await import('node:sqlite')
  const { default: SQL } = await import('sql-template-strings')

  const db = new DatabaseSync('./database.db')
  const sql = (fragments: any, ...values: any[]) => {
    const statement = SQL(fragments, ...values)
    const stmt = db.prepare(statement.sql)
    return stmt.all(...statement.values)
  }

  const store = new (getStore(SqliteStore))(sql)
  return store
}

function createWebdisStore() {
  const store = new (getStore(WebdisStore))({
    url: 'http://localhost:7379',
  })
  return Promise.resolve(store)
}

async function createPostgresStore() {
  const { default: pg } = await import('pg')
  const { default: SQL } = await import('sql-template-strings')

  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })
  await client.connect()

  const sql = async (fragments: any, ...values: any[]) => {
    const statement = SQL(fragments, ...values)
    const res = await client.query(statement.text, statement.values)
    return res.rows
  }

  const store = new (getStore(PostgresStore))(sql as any)
  try {
    await client.query('DROP TABLE IF EXISTS sessions')
  } catch (e) {}
  await store.initSessionsTable()
  return store
}

async function createMongoStore() {
  const { MongoClient } = await import('mongodb')
  const client = new MongoClient('mongodb://localhost:27017')
  await client.connect()
  const db = client.db('test')
  return new (getStore(MongoStore))(db as any)
}

async function createRedisStore() {
  const { default: Redis } = await import('ioredis')
  const redis = new Redis({
    host: '127.0.0.1',
    port: 6379,
  })
  return new (getStore(RedisStore))((command, args) =>
    redis.call(command, ...args)
  )
}

export default makeStore
