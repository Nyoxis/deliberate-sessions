import MemoryStore from './src/stores/MemoryStore.ts'
import { CookieStoreOption } from './src/stores/CookieStore.ts'

import { decrypt, encrypt } from './src/Crypto.ts'

import initSessionsHandlers from './src/Handlers.ts'
import Session from './src/Session.ts'
import type { SessionData } from './src/Session.ts'
import type Store from './src/stores/Store.ts'
import type SessionConfig from './src/SessionConfig.ts'

export {
  CookieStoreOption,
  decrypt,
  encrypt,
  initSessionsHandlers,
  MemoryStore,
  Session,
}

export type { SessionConfig, SessionData, Store }
