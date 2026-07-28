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

## Railway

1. Create a Railway project, add a **PostgreSQL** plugin → copy `DATABASE_URL` into Variables
2. Add a **Web Service** pointed at the repo root
3. Set **Build command**: `pnpm install && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build`
4. Set **Start command**: `node artifacts/api-server/dist/index.mjs`
5. Add all required environment variables (see table above)

---

## Render

1. Create a **PostgreSQL** database service → copy `DATABASE_URL`
2. Create a **Web Service** (Node runtime)
3. **Build command**: `pnpm install && pnpm --filter @workspace/db run push && pnpm --filter @workspace/api-server run build`
4. **Start command**: `node artifacts/api-server/dist/index.mjs`
5. Set all env vars

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

## Frontend Deployment (once built)

The React frontend (`artifacts/web/`) is a Vite SPA. It can be deployed:

- **Separately** on Vercel, Netlify, or Cloudflare Pages → set `VITE_API_URL` to the production API URL
- **Co-hosted** by serving the built `dist/` from Express (add a static middleware in `artifacts/api-server/src/app.ts`)

---

## What Is Replit-Specific (ignore on other hosts)

| File/Dir | Purpose |
|---|---|
| `artifact.toml` files | Replit workspace config — not needed elsewhere |
| `artifacts/mockup-sandbox/` | Replit design canvas tool — never deployed |
| `.replit`, `.replitignore` | Replit IDE config |
| `pnpm-workspace.yaml` `minimumReleaseAge` field | Replit-specific pnpm security setting — harmless but unused on other hosts |
