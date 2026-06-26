import type Store from './Store.ts'
import type { SessionData } from '../Session.ts'

type WebdisOptions = {
  url: string
  keyPrefix?: string
}

class WebdisStore implements Store {
  url: string
  keyPrefix: string

  constructor(options: WebdisOptions) {
    this.url = options.url
    this.keyPrefix = options.keyPrefix || 'session_'
  }

  async getSessionById(sessionId: string): Promise<SessionData | null> {
    const payload = await fetch(this.url + '/GET/' + this.keyPrefix + sessionId)
    const payloadJSON = await payload.json()
    const session = payloadJSON.GET

    if (session) {
      return JSON.parse(session) as SessionData
    } else {
      return null
    }
  }

  async createSession(sessionId: string, initialData: SessionData): Promise<void> {
    await fetch(
      this.url + '/SET/' + this.keyPrefix + sessionId + '/' +
        JSON.stringify(initialData),
    )
  }

  async deleteSession(sessionId: string): Promise<void> {
    await fetch(this.url + '/DEL/' + this.keyPrefix + sessionId)
  }

  async persistSessionData(sessionId: string, sessionData: SessionData): Promise<void> {
    await fetch(
      this.url + '/SET/' + this.keyPrefix + sessionId + '/' +
        encodeURI(JSON.stringify(sessionData)),
    )
  }
}

export default WebdisStore
