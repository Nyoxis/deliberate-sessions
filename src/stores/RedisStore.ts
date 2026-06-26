import type Store from './Store.ts'
import type { SessionData } from '../Session.ts'

class RedisStore<T> implements Store {
  keyPrefix: string
  sendCommand: (command: string, args: any[]) => Promise<any>
  ttl?: number

  constructor(
    sendCommand: (command: string, args: any[]) => Promise<any>,
    keyPrefix = 'session_',
    ttl?: number,
  ) {
    this.keyPrefix = keyPrefix
    this.sendCommand = sendCommand
    this.ttl = ttl
  }

  async getSessionById(sessionId: string): Promise<SessionData | null> {
    const session = await this.sendCommand('GET', [this.keyPrefix + sessionId])

    if (session) {
      const value = JSON.parse(String(session)) as SessionData
      return value
    } else {
      return null
    }
  }

  async createSession(sessionId: string, initialData: SessionData): Promise<void> {
    const args: any[] = [
      this.keyPrefix + sessionId,
      JSON.stringify(initialData),
    ]
    if (this.ttl !== undefined) {
      args.push('EX', this.ttl)
    }
    await this.sendCommand('SET', args)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sendCommand('DEL', [this.keyPrefix + sessionId])
  }

  async persistSessionData(sessionId: string, sessionData: SessionData): Promise<void> {
    const args: any[] = [
      this.keyPrefix + sessionId,
      JSON.stringify(sessionData),
    ]
    if (this.ttl !== undefined) {
      args.push('EX', this.ttl)
    }
    await this.sendCommand('SET', args)
  }
}

export default RedisStore
