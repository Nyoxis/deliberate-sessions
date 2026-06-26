// ex. scripts/build_npm.ts
import { build, emptyDir } from '@deno/dnt'
import { dirname, fromFileUrl, join } from '@std/path'

const version = JSON.parse(
  await Deno.readTextFile(
    dirname(fromFileUrl(import.meta.url)) + '/../deno.json',
  ),
).version

const DIST_DIR = './npm'

await emptyDir(DIST_DIR)

await build({
  entryPoints: [
    './mod.ts',
    {
      name: './postgres-store',
      path: './src/stores/PostgresStore.ts',
    },
    {
      name: './redis-store',
      path: './src/stores/RedisStore.ts',
    },
    {
      name: './sqlite-store',
      path: './src/stores/SqliteStore.ts',
    },
    {
      name: './mongo-store',
      path: './src/stores/MongoStore.ts',
    },
    {
      name: './webdis-store',
      path: './src/stores/WebdisStore.ts',
    },
    {
      name: './koa',
      path: './src/middlewares/koa.ts',
    },
    {
      name: './hono',
      path: './src/middlewares/hono.ts',
    },
  ],
  outDir: DIST_DIR,
  shims: {
    // see JS docs for overview and more options
    // deno: true,
    // crypto: true,
  },
  package: {
    // package.json properties
    name: '@nyoxis/deliberate-sessions',
    version,
    description: 'Cookie-based sessions for Hono web framework',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/nyoxis/deliberate-sessions.git',
    },
    bugs: {
      url: 'https://github.com/nyoxis/deliberate-sessions/issues',
    },
    peerDependencies: {
      'koa': '^2.0.0 || ^3.0.0',
      'hono': '^4.0.0',
    },
    peerDependenciesMeta: {
      'koa': {
        'optional': true,
      },
      'hono': {
        'optional': true,
      },
    },
    devDependencies: {
      'koa': '^2.0.0 || ^3.0.0',
      'hono': '^4.0.0',
    },
  },
  typeCheck: false,
  scriptModule: false,
  test: false,
  compilerOptions: {
    lib: ['DOM', 'ES2022'],
  },
})

const dependenciesMapping = [
  {
    name: 'hono',
    version: '^4.0.0',
    peerDependency: true,
  },
  {
    name: 'koa',
    version: '^2.0.0 || ^3.0.0',
    peerDependency: true,
  },
]

// Patch package.json to add peer dependencies and remove dev dependencies
// This is required because dnt doesn't support peer dependencies for NPM packages yet
// See https://github.com/denoland/dnt/issues/433 for details
async function fixPeerDependencies() {
  const packageJsonPath = join(DIST_DIR, 'package.json')
  const packageJson = JSON.parse(await Deno.readTextFile(packageJsonPath))

  const dependencies = packageJson.dependencies || {}
  const peerDependencies = packageJson.peerDependencies || {}

  for (const value of dependenciesMapping) {
    if (typeof value === 'string') {
      continue
    }

    const { name, version, peerDependency } = value

    if (peerDependency) {
      peerDependencies[name] = version
      delete dependencies[name]
    } else {
      dependencies[name] = version
    }
  }

  packageJson.dependencies = dependencies
  packageJson.peerDependencies = peerDependencies

  await Deno.writeTextFile(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2),
  )
}

await fixPeerDependencies()

// post build steps
Deno.copyFileSync('LICENSE', 'npm/LICENSE')
Deno.copyFileSync('README.md', 'npm/README.md')
