# OnCall Foot — Agent Handbook

A premium mobile-first marketplace for in-home foot care professionals and their clients.
Three roles: **Client** (books visits), **Provider** (manages their business), **Admin** (platform oversight).

---

## Current State (as of 2026-07-28)

| Layer | Status |
|---|---|
| DB schema | ✅ Pushed to Replit PostgreSQL |
| API server | ✅ Running — health check only (`GET /api/healthz`) |
| Auth routes | ❌ Not implemented yet |
| Business routes | ❌ Not implemented yet |
| Seed data | ❌ Seed script not written yet |
| React frontend | ❌ `artifacts/web/` does not exist yet |

**Next priorities** (see project task list):
1. Implement auth + core API routes
2. Write the seed script
3. Build the React frontend (`artifacts/web/`)

---

## Running on Replit

| Command | Purpose |
|---|---|
| `pnpm --filter @workspace/api-server run dev` | Start API server (build + run) |
| `pnpm --filter @workspace/db run push` | Push schema changes to dev DB |
| `pnpm --filter @workspace/db run generate` | Generate migration files |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate Zod validators + React Query hooks from OpenAPI spec |
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build everything |

The API server workflow is managed by Replit under the name `artifacts/api-server: API Server`.
After any code or dependency change, restart it with the WorkflowsRestart tool.

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Auto-provided by Replit. Set manually on Railway/Render/Fly. |
| `JWT_SECRET` | ✅ (when auth is built) | Long random string. Store as a secret, never in code. |
| `JWT_EXPIRES_IN` | optional | Default `7d`. |
| `PORT` | ✅ | Auto-set by Replit. Set by host on other platforms. |
| `NODE_ENV` | optional | `development` or `production`. |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (e.g. the frontend URL). |
| `SESSION_SECRET` | optional | Already set as a Replit secret. Standard env var, works anywhere. |

---

## Stack

- **Monorepo**: pnpm workspaces (Node.js 24, TypeScript 5.9)
- **API**: Express 5, built with esbuild 0.27.3 → `dist/index.mjs`
- **DB**: PostgreSQL + Drizzle ORM (schema in `lib/db/src/schema/`)
- **Auth**: JWT HS256 + bcrypt *(routes not yet implemented)*
- **Validation**: Zod v4 + drizzle-zod
- **API contract**: OpenAPI 3.1 spec (`lib/api-spec/openapi.yaml`) is the source of truth
- **Codegen**: Orval generates Zod validators (`lib/api-zod/`) and TanStack Query hooks (`lib/api-client-react/`) from the spec
- **Frontend**: React 19 + Vite *(artifact not created yet — `artifacts/web/`)*

---

## Where Things Live

```
artifacts/
  api-server/
    src/
      routes/        ← Add new Express route files here
      middlewares/   ← Auth middleware goes here
      lib/           ← Shared server utilities (logger, etc.)
    build.mjs        ← esbuild config (produces dist/)
lib/
  db/src/schema/     ← Drizzle table definitions (source of truth for DB shape)
  api-spec/
    openapi.yaml     ← OpenAPI spec (source of truth for API contracts)
  api-zod/src/generated/       ← Auto-generated Zod validators (do not edit)
  api-client-react/src/generated/ ← Auto-generated TanStack Query hooks (do not edit)
docs/
  roles-and-permissions.md  ← Full permission matrix per role
  booking-statuses.md       ← Allowed booking status transitions
  data-models.md            ← Full column reference for every table
  api-routes.md             ← Complete route map
  deployment-notes.md       ← Railway / Render / Fly.io instructions
```

---

## DB Schema — Tables

All defined in `lib/db/src/schema/`:

| Table | Purpose |
|---|---|
| `users` | All roles (client, provider, admin). Has `role` column. |
| `provider_profiles` | Provider business info + verification status |
| `travel_zones` | Provider service areas (geofenced) |
| `availability` | Provider weekly schedule |
| `verification_docs` | Provider document metadata |
| `services` | Services offered by each provider |
| `bookings` | Visit requests + lifecycle state machine |
| `reviews` | Post-visit client reviews |
| `invoices` | Payment records (Stripe-ready) |
| `support_tickets` + `support_messages` | Internal support module |

Key conventions:
- **Prices in cents** (integer) — never floats
- `provider_profiles` is separate from `users` (role-agnostic users table)
- Booking status transitions documented in `docs/booking-statuses.md` and must be enforced in route handlers

---

## API Development Workflow

1. **Edit `lib/api-spec/openapi.yaml`** — add or change endpoints there first
2. **Run codegen**: `pnpm --filter @workspace/api-spec run codegen` — regenerates Zod validators and React Query hooks
3. **Implement the route** in `artifacts/api-server/src/routes/`
4. **Push schema if DB changed**: `pnpm --filter @workspace/db run push`

Never edit files under `lib/api-zod/src/generated/` or `lib/api-client-react/src/generated/` directly — they are overwritten by codegen.

---

## Demo Logins (once seed script is written)

| Role | Email | Password |
|---|---|---|
| Admin | admin@oncallfoot.com | demo1234 |
| Provider | sarah@oncallfoot.com | demo1234 |
| Provider | mike@oncallfoot.com | demo1234 |
| Client | jane@oncallfoot.com | demo1234 |
| Client | tom@oncallfoot.com | demo1234 |

---

## Portability — What Is and Isn't Replit-Specific

**Replit-only files (safe to ignore on other hosts):**
- `artifact.toml` files in each artifact — Replit workspace config only
- `artifacts/mockup-sandbox/` — Replit design canvas tool, never deployed
- `.replit`, `.replitignore` — Replit IDE config

**No Replit lock-in in application code:**
- No `@replit/*` packages in any deployed artifact
- `DATABASE_URL` is a standard PostgreSQL connection string — works on any host
- `SESSION_SECRET` and `JWT_SECRET` are standard env vars

See `docs/deployment-notes.md` for Railway, Render, and Fly.io setup.

---

## User Preferences

- Build for continuity: future agents must be able to continue from repo docs and clear structure
- GitHub-first: codebase must remain clean, documented, and portable
- No vendor lock-in to Replit-specific patterns in application code
