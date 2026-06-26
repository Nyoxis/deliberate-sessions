import type Store from './Store.ts'
import type { SessionData } from '../Session.ts'

class PostgresStore implements Store {
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
  }

  async initSessionsTable() {
    await this
      .sql`create table if not exists __TABLE__ (id varchar not null primary key, data varchar)`
  }

  async getSessionById(sessionId: string): Promise<SessionData | null> {
    const result = await this
      .sql`select data from __TABLE__ where id = ${sessionId}`
    return result.length > 0 ? JSON.parse(result[0].data) as SessionData : null
  }

  async createSession(sessionId: string, initialData: SessionData): Promise<void> {
    await this.sql`insert into __TABLE__ (id, data) values (${sessionId}, ${
      JSON.stringify(initialData)
    })`
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sql`delete from __TABLE__ where id = ${sessionId}`
  }

  async persistSessionData(sessionId: string, sessionData: SessionData): Promise<void> {
    await this.sql`update __TABLE__ set data = ${
      JSON.stringify(sessionData)
    } where id = ${sessionId}`
  }
}

export default PostgresStore
