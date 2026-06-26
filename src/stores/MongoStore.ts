import type Store from './Store.ts'
import type { SessionData } from '../Session.ts'

interface MongoDatabase {
  collection(name: string): MongoCollection<any>
}

interface MongoCollection<T> {
  findOne(filter: object): Promise<T | undefined | null>
  replaceOne(filter: object, replacement: T, options?: object): Promise<unknown>
  deleteOne(filter: object): Promise<unknown>
}

interface MongoSession {
  id: string
  data: SessionData
}

class MongoStore implements Store {
  db: MongoDatabase
  sessions: MongoCollection<MongoSession>

  constructor(db: MongoDatabase, collectionName = 'sessions') {
    this.db = db
    this.sessions = db.collection(collectionName) as MongoCollection<MongoSession>
  }

  async getSessionById(sessionId: string): Promise<SessionData | null> {
    const session = await this.sessions.findOne({ id: sessionId })

    return session ? session.data : null
  }

  async createSession(sessionId: string, initialData: SessionData): Promise<void> {
    await this.sessions.replaceOne(
      { id: sessionId },
      {
        id: sessionId,
        data: initialData,
      },
      { upsert: true },
    )
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessions.deleteOne({ id: sessionId })
  }

  async persistSessionData(sessionId: string, sessionData: SessionData): Promise<void> {
    await this.sessions.replaceOne(
      { id: sessionId },
      {
        id: sessionId,
        data: sessionData,
      },
      { upsert: true },
    )
  }
}

export default MongoStore
