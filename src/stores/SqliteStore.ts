import type Store from './Store.ts'
import type { SessionData } from '../Session.ts'

class SqliteStore implements Store {
  sql: (strings: TemplateStringsArray, ...values: any[]) => any

  constructor(
    sql: (strings: TemplateStringsArray, ...values: any[]) => any,
    tableName = 'sessions',
  ) {
    // Bake the tableName into the sql function by replacing __TABLE__ in query strings
    this.sql = (strings: TemplateStringsArray, ...values: any[]) => {
      const newStrings = strings.map((s) => s.replace(/__TABLE__/g, tableName))
      const templateStrings = Object.assign(newStrings, {
        raw: newStrings,
      }) as unknown as TemplateStringsArray
      return sql(templateStrings, ...values)
    }

    this.sql`CREATE TABLE IF NOT EXISTS __TABLE__ (id TEXT, data TEXT)`
  }

  getSessionById(sessionId: string): SessionData | null {
    let session = ''

    for (
      const row of this
        .sql`SELECT data FROM __TABLE__ WHERE id = ${sessionId}`
    ) {
      session = row.data
    }

    return session ? JSON.parse(session) as SessionData : null
  }

  createSession(sessionId: string, initialData: SessionData): void {
    this.sql`INSERT INTO __TABLE__ (id, data) VALUES (${sessionId}, ${
      JSON.stringify(initialData)
    })`
  }

  deleteSession(sessionId: string): void {
    this.sql`DELETE FROM __TABLE__ WHERE id = ${sessionId}`
  }

  persistSessionData(sessionId: string, sessionData: SessionData): void {
    this.sql`UPDATE __TABLE__ SET data = ${
      JSON.stringify(sessionData)
    } WHERE id = ${sessionId}`
  }
}

export default SqliteStore
