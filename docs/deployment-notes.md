# Deployment Notes

OnCall Foot is designed to be portable. No Replit-specific dependencies exist in application code.

---

## Environment Variables Required

```env
DATABASE_URL=          # PostgreSQL connection string
JWT_SECRET=            # Long random string for JWT signing
JWT_EXPIRES_IN=7d      # Token expiry
PORT=5000              # API server port
NODE_ENV=production    # or development
CORS_ORIGINS=          # Comma-separated allowed origins
```

---

## Railway

1. Create a Railway project
2. Add a PostgreSQL plugin → copy `DATABASE_URL` into env vars
3. Add a Web Service → point to repo root
4. Set start command: `pnpm --filter @workspace/api-server run start`
5. Set build command: `pnpm install && pnpm --filter @workspace/api-server run build`
6. Set all environment variables

---

## Render

1. Create a PostgreSQL database service → copy `DATABASE_URL`
2. Create a Web Service → Node runtime
3. Build command: `pnpm install && pnpm --filter @workspace/api-server run build`
4. Start command: `node artifacts/api-server/dist/index.mjs`
5. Set env vars

---

## Fly.io

1. `fly launch` from repo root
2. `fly postgres create` → attach to app
3. Set secrets: `fly secrets set JWT_SECRET=... DATABASE_URL=...`
4. `fly deploy`

---

## Database Migrations

- Schema is managed with Drizzle ORM
- Push schema (dev): `pnpm --filter @workspace/db run push`
- Generate migrations (prod): `pnpm --filter @workspace/db run generate`
- Apply migrations: `pnpm --filter @workspace/db run migrate`

---

## Frontend Deployment

The React frontend (`artifacts/web/`) can be deployed separately as a static site on Vercel, Netlify, or Cloudflare Pages, or co-hosted behind the same Express server.

When deploying separately, set `VITE_API_URL` to the production API URL.

---

## No Replit Lock-in

- No `@replit/` packages in application runtime code
- `SESSION_SECRET` is a standard env var — works anywhere
- The `artifact.toml` files are Replit workspace config only — ignored by other hosts
