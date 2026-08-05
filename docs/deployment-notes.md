# Deployment Notes

OnCall Foot is designed to be portable. No Replit-specific dependencies exist in application code.

---

## Required Environment Variables

```env
DATABASE_URL=          # PostgreSQL connection string
JWT_SECRET=            # Long random string for JWT signing
JWT_EXPIRES_IN=7d      # Token expiry (default: 7d)
PORT=5000              # API server port
NODE_ENV=production    # or development
CORS_ORIGINS=          # Comma-separated allowed frontend origins
```

---

## Build & Start Commands

```bash
# Install dependencies
pnpm install

# Push DB schema (first deploy or after schema changes)
pnpm --filter @workspace/db run push

# Build the API server
pnpm --filter @workspace/api-server run build

# Start the API server
pnpm --filter @workspace/api-server run start
# or directly:
node artifacts/api-server/dist/index.mjs
```

---

## Railway (single service — recommended)

The repo ships a `railway.json` and `nixpacks.toml`, so Railway auto-configures:

1. Create a Railway project → add a **PostgreSQL** plugin. Railway exposes `DATABASE_URL` to the service automatically.
2. Deploy the repo. Railway reads `railway.json`:
   - **Build**: `pnpm run build:deploy` (builds the React web app + bundles the API server)
   - **Start**: `pnpm run db:push && pnpm run start` (pushes the schema, then serves API **and** the web app on one port)
   - **Healthcheck**: `/api/healthz`
3. Set the remaining variables: `JWT_SECRET` (required), optionally `JWT_EXPIRES_IN`, `NODE_ENV=production`. `PORT` is injected by Railway.
4. (First deploy only) seed demo data from the Railway shell: `pnpm run seed`.

The Express server serves the built SPA (`artifacts/web/dist/public`) for all non-`/api` routes, so the whole app runs as **one service** — no separate frontend host or CORS setup needed.

---

## Render / Fly.io / any Node host

Same single-service model:

- **Build command**: `pnpm install && pnpm run build:deploy`
- **Start command**: `pnpm run db:push && pnpm run start`
- Provide `DATABASE_URL`, `JWT_SECRET`, and let the host inject `PORT`.

---

## Fly.io

```bash
fly launch                          # from repo root
fly postgres create                 # attach to app
fly secrets set JWT_SECRET=...
fly secrets set DATABASE_URL=...
fly deploy
```

Add a `fly.toml` at the repo root if one doesn't exist. Set `[build] command` and `[processes] app` accordingly.

---

## Database Migrations

Schema is managed with Drizzle ORM:

| Command | When to use |
|---|---|
| `pnpm --filter @workspace/db run push` | Development — pushes schema directly (no migration files) |
| `pnpm --filter @workspace/db run generate` | Production — generates SQL migration files |
| `pnpm --filter @workspace/db run migrate` | Production — applies generated migration files |

**On Replit**: schema changes to production are handled through the Publish flow (Replit diffs dev vs prod and applies automatically). Do not write custom migration scripts.

**On other hosts**: use `generate` + `migrate` for production schema changes.

---

## Frontend Deployment

By default the React SPA (`artifacts/web/`) is **co-hosted** by the Express API server: `pnpm run build:deploy` builds it to `artifacts/web/dist/public`, and the server serves it for all non-`/api` routes (see `artifacts/api-server/src/app.ts`). This is the single-service model used above.

If you prefer to host the frontend **separately** (Vercel, Netlify, Cloudflare Pages), build just the web package (`pnpm --filter @workspace/web run build`) and point it at the API origin. The generated API client uses relative `/api/*` paths, so serve it behind the same domain or set a base URL via `setBaseUrl()`.

---

## What Is Replit-Specific (ignore on other hosts)

| File/Dir | Purpose |
|---|---|
| `artifact.toml` files | Replit workspace config — not needed elsewhere |
| `artifacts/mockup-sandbox/` | Replit design canvas tool — never deployed |
| `.replit`, `.replitignore` | Replit IDE config |
| `pnpm-workspace.yaml` `minimumReleaseAge` field | Replit-specific pnpm security setting — harmless but unused on other hosts |
