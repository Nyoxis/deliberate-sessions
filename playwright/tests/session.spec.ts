import { expect, test } from '@playwright/test'
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
      return false
    }
  }
  return true
}

const store = process.env.STORE || 'cookie'
const targetRuntime = process.env.JS_RUNTIME
const runAll = !targetRuntime

const targets: Array<{ name: string; url: string }> = []

if (canRunDenoStore(store) && (runAll || targetRuntime === 'deno')) {
  if (store === 'cookie' || store === 'memory') {
    targets.push({ name: 'Hono (Deno)', url: 'http://localhost:8000' })
  }
  targets.push({ name: 'Oak', url: 'http://localhost:8002' })
}

if (hasBinary('bun') && (runAll || targetRuntime === 'bun')) {
  if (store === 'cookie' || store === 'sqlite') {
    targets.push({ name: 'Hono (Bun)', url: 'http://localhost:3005' })
  }
}

if (hasBinary('node') && (runAll || targetRuntime === 'node')) {
  if (store === 'cookie') {
    targets.push({ name: 'Hono (Node)', url: 'http://localhost:3000' })
  }
  targets.push({ name: 'Koa', url: 'http://localhost:8003' })
}

if (hasBinary('node') && (runAll || targetRuntime === 'cloudflare')) {
  if (store === 'cookie') {
    targets.push({
      name: 'Hono (Cloudflare Workers)',
      url: 'http://localhost:8787',
    })
    targets.push({
      name: 'Hono (Cloudflare Pages)',
      url: 'http://localhost:8788',
    })
  }
}

for (const target of targets) {
  test(`logs in a user after several mistakes (${target.name})`, async ({ page }) => {
    await page.goto(target.url + '/')

    // Hono has a title "Hono Sessions", while Oak and Koa servers do not set a title.
    if (target.name.startsWith('Hono')) {
      await expect(page).toHaveTitle(/Hono Sessions/)
    }

    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('incorrect')
    await page.locator('#login-button').click()

    await expect(page.locator('#error')).toContainText(
      'Incorrect username or password',
    )
    await expect(page.locator('#failed-login-attempts')).toContainText(
      'Failed login attempts: 1',
    )

    await page.goto(target.url + '/')
    await expect(page.locator('#failed-login-attempts')).toContainText(
      'Failed login attempts: 1',
    )
    await expect(page.locator('#error')).toBeHidden()
    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('wrong')
    await page.locator('#login-button').click()

    await expect(page.locator('#failed-login-attempts')).toContainText(
      'Failed login attempts: 2',
    )

    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('correct')
    await page.locator('#login-button').click()

    await expect(page.locator('#failed-login-attempts')).toBeHidden()
    await expect(page.locator('#message')).toContainText(/Login [sS]uccessful/)

    await page.goto(target.url + '/')
    await expect(page.locator('#logout-button')).toContainText(
      'Log out test@test.com',
    )
    await expect(page.locator('#message')).toBeHidden()
    await page.locator('#logout-button').click()

    await page.goto(target.url + '/')
    await page.locator('#email').fill('test@test.com')
    await page.locator('#password').fill('incorrect')
    await page.locator('#login-button').click()
    await expect(page.locator('#error')).toContainText(
      'Incorrect username or password',
    )
    await expect(page.locator('#failed-login-attempts')).toContainText(
      'Failed login attempts: 1',
    )
  })
}
