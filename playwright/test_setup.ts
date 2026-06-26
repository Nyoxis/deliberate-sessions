import { execSync } from 'child_process'

function hasBinary(binary: string): boolean {
  try {
    execSync(`which ${binary}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function canRunDenoStore(store: string): boolean {
  if (!hasBinary('deno')) return false
  if (store === 'sqlite') {
    try {
      execSync('deno eval "import(\'jsr:@db/sqlite\')"', { stdio: 'ignore' })
      return true
    } catch {
      console.warn(
        'Deno SQLite driver is not working on this machine. Skipping Deno Oak/Hono SQLite servers.',
      )
      return false
    }
  }
  if (store === 'postgres') {
    try {
      execSync(
        'deno eval "import(\'https://deno.land/x/postgresjs@v3.4.9/mod.js\')"',
        { stdio: 'ignore' },
      )
      return true
    } catch {
      console.warn(
        'Deno Postgres driver is not working on this machine. Skipping Deno Oak/Hono Postgres servers.',
      )
      return false
    }
  }
  return true
}

export function runtimeCommand() {
  const store = process.env.STORE || 'cookie'
  const targetRuntime = process.env.JS_RUNTIME // e.g. 'deno', 'node', 'bun', 'cloudflare'
  const webServers: Array<
    { command: string; url: string; reuseExistingServer: boolean }
  > = []

  const runAll = !targetRuntime
  const denoAvailable = canRunDenoStore(store) && (runAll || targetRuntime === 'deno')
  const bunAvailable = hasBinary('bun') && (runAll || targetRuntime === 'bun')
  const nodeAvailable = hasBinary('node') && (runAll || targetRuntime === 'node')
  const cloudflareAvailable = hasBinary('node') && (runAll || targetRuntime === 'cloudflare')

  if (denoAvailable) {
    // Add Hono Deno (port 8000)
    if (store === 'cookie' || store === 'memory') {
      webServers.push({
        command:
          `cd ../test/hono/deno && STORE=${store} deno run --no-check -A server_deno.ts`,
        url: 'http://127.0.0.1:8000',
        reuseExistingServer: !process.env.CI,
      })
    }
    // Add Oak (port 8002)
    webServers.push({
      command:
        `cd ../test/oak && STORE=${store} deno run --no-check -A server.ts`,
      url: 'http://127.0.0.1:8002',
      reuseExistingServer: !process.env.CI,
    })
  }

  if (bunAvailable) {
    // Add Hono Bun (port 3005)
    if (store === 'cookie' || store === 'sqlite') {
      webServers.push({
        command: `cd ../test/hono/bun && ( [ -d node_modules/@nyoxis ] || bun install ) && STORE=${store} PORT=3005 bun run ${
          store === 'sqlite' ? 'src/test_sqlite.ts' : 'src/test_cookie.ts'
        }`,
        url: 'http://127.0.0.1:3005',
        reuseExistingServer: !process.env.CI,
      })
    }
  }

  if (nodeAvailable) {
    // Add Hono Node (port 3000)
    if (store === 'cookie') {
      webServers.push({
        command: `cd ../test/hono/node && ( [ -d node_modules/@nyoxis ] || npm install ) && STORE=${store} npm run test_cookie`,
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
      })
    }
    // Add Koa (port 8003)
    webServers.push({
      command: `cd ../test/koa && ( [ -d node_modules/@nyoxis ] || npm install ) && STORE=${store} npm run dev`,
      url: 'http://127.0.0.1:8003',
      reuseExistingServer: !process.env.CI,
    })
  }

  if (cloudflareAvailable && store === 'cookie') {
    // Add Hono Cloudflare Workers (port 8787)
    webServers.push({
      command: `cd ../test/hono/cloudflare_workers && ( [ -d node_modules/@nyoxis ] || npm install ) && npm run dev`,
      url: 'http://127.0.0.1:8787',
      reuseExistingServer: !process.env.CI,
    })

    // Add Hono Cloudflare Pages (port 8788)
    webServers.push({
      command: `cd ../test/hono/cloudflare_pages && ( [ -d node_modules/@nyoxis ] || npm install ) && npm run build && npm run preview`,
      url: 'http://127.0.0.1:8788',
      reuseExistingServer: !process.env.CI,
    })
  }

  return {
    webServers,
    server_url: webServers[0]?.url || 'http://127.0.0.1:8003',
  }
}
