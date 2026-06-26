# Playwright Integration Tests

This directory contains the integration test suite for the `deliberate-sessions`
library. The suite verifies session functionality across all supported
frameworks/runtimes (Hono Node/Bun/Deno, Oak, and Koa) and databases.

## Running Tests

To run the integration tests, first compile the NPM package in the root
directory:

```bash
deno run -A scripts/build_npm.ts
```

Then, navigate to the `playwright/` directory and make sure you have the required browser (Chromium) installed:

```bash
cd playwright

# Install Chromium browser binary
npx playwright install chromium

# If your OS is missing system dependencies (such as libnss3, libasound2), install them using:
npx playwright install --with-deps chromium
```

Finally, run Playwright from this directory, specifying the target database store via the `STORE` environment variable:

```bash
STORE=<store_type> npx playwright test
```

## Supported `STORE` Configurations and Prerequisites

The test servers will automatically adapt to the `STORE` variable. Below are the
supported stores, which environments support them, and what databases must be
running locally:

| `STORE` Type           | Supported Environments           | Prerequisites / local setup                                                                                  |
| :--------------------- | :------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **`cookie`** (Default) | Hono (Node, Bun, Deno), Oak, Koa | None. Uses client-side encrypted cookies.                                                                    |
| **`memory`**           | Hono (Deno), Oak, Koa            | None. Sessions stored in-memory on the server.                                                               |
| **`sqlite`**           | Hono (Bun), Koa, Oak             | None. Uses local `./database.db` and `./tmp/database.sqlite` files.                                          |
| **`redis`**            | Oak, Koa                         | Redis server running on `localhost:6379`                                                                     |
| **`webdis`**           | Oak, Koa                         | Webdis server running on `localhost:7379`                                                                    |
| **`postgres`**         | Oak, Koa                         | PostgreSQL server running on `localhost:5432`<br>Database: `postgres`<br>User: `postgres` / Pass: `postgres` |
| **`mongo`**            | Oak, Koa                         | MongoDB server running on `mongodb://localhost:27017`                                                        |
