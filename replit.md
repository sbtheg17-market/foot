# OnCall Foot — Agent Handbook

> *The right care. At your door. Right now.*

OnCall Foot is a **funded-quality, mobile-first marketplace** for in-home foot care. It pairs clients who need professional foot rejuvenation with verified mobile specialists — at their door, on their schedule.

**Before writing a single line of code, read these two documents:**
- [`docs/product-vision.md`](docs/product-vision.md) — the mission, brand posture, and what "best foot aid quickly" means in every feature decision
- [`docs/ux-guidelines.md`](docs/ux-guidelines.md) — mobile-first UI principles, component patterns, tone of voice, and the comfort standards every user-facing screen must meet

**Before writing a commit message or naming a checkpoint**, read:
- [`docs/checkpoint-notes-guide.md`](docs/checkpoint-notes-guide.md) — how to write notes that serve the cause, not just describe code

---

## Current Build State (2026-07-28)

| Layer | Status |
|---|---|
| DB schema | ✅ Pushed to Replit PostgreSQL |
| API server | ✅ Running — health check only (`GET /api/healthz`) |
| Auth routes | ❌ Not implemented |
| Business routes | ❌ Not implemented |
| Seed data | ❌ Seed script not written |
| React frontend | ❌ `artifacts/web/` does not exist yet |

**Planned next (see project task list):**
1. Implement auth + core API routes
2. Write the seed script (demo accounts + sample bookings)
3. Build the React frontend (`artifacts/web/`)

---

## Running on Replit

| Command | Purpose |
|---|---|
| `pnpm --filter @workspace/api-server run dev` | Build + start the API server |
| `pnpm --filter @workspace/db run push` | Push schema changes to dev DB |
| `pnpm --filter @workspace/db run generate` | Generate migration files (for production) |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate Zod validators + React Query hooks from OpenAPI spec |
| `pnpm run typecheck` | Full typecheck across all packages |
| `pnpm run build` | Typecheck + build everything |

The API server workflow is `artifacts/api-server: API Server` — restart it after any code or dependency change.

---

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Auto-provided by Replit. Set manually on Railway/Render/Fly. |
| `JWT_SECRET` | ✅ when auth is built | Long random string. Store as a secret, never in code. |
| `JWT_EXPIRES_IN` | optional | Default `7d`. |
| `PORT` | ✅ | Auto-set by Replit. Set by host on other platforms. |
| `NODE_ENV` | optional | `development` or `production`. |
| `CORS_ORIGINS` | optional | Comma-separated allowed origins (frontend URL in prod). |
| `SESSION_SECRET` | optional | Already set as a Replit secret. Standard env var, works anywhere. |

---

## Stack

- **Monorepo**: pnpm workspaces (Node.js 24, TypeScript 5.9)
- **API**: Express 5, built with esbuild 0.27.3 → `artifacts/api-server/dist/index.mjs`
- **DB**: PostgreSQL + Drizzle ORM (schema in `lib/db/src/schema/`)
- **Auth**: JWT HS256 + bcrypt *(routes not yet implemented)*
- **Validation**: Zod v4 + drizzle-zod
- **API contract**: OpenAPI 3.1 spec (`lib/api-spec/openapi.yaml`) — source of truth for all endpoints
- **Codegen**: Orval generates Zod validators (`lib/api-zod/`) and TanStack Query hooks (`lib/api-client-react/`) from the spec — always run codegen after changing the spec
- **Frontend**: React 19 + Vite + TanStack Query + Wouter *(artifact not created yet)*

---

## Where Things Live

```
artifacts/
  api-server/
    src/
      routes/        ← Express route handlers (one file per domain)
      middlewares/   ← Auth middleware (requireAuth, requireRole, requireSelf)
      lib/           ← Server utilities (logger, etc.)
    build.mjs        ← esbuild config → dist/
lib/
  db/src/schema/     ← Drizzle table definitions (source of truth for DB shape)
  api-spec/
    openapi.yaml     ← OpenAPI spec (source of truth for API contracts)
  api-zod/src/generated/          ← Auto-generated Zod validators (DO NOT EDIT)
  api-client-react/src/generated/ ← Auto-generated TanStack Query hooks (DO NOT EDIT)
docs/
  product-vision.md       ← Mission, brand, the "right pairing" principle — READ FIRST
  ux-guidelines.md        ← Mobile-first UI standards every screen must meet — READ FIRST
  checkpoint-notes-guide.md ← How to write commit/checkpoint notes that serve the cause
  roles-and-permissions.md  ← Full permission matrix per role
  booking-statuses.md       ← Allowed booking status transitions + who triggers each
  data-models.md            ← Full column reference for every table
  api-routes.md             ← Complete planned route map
  deployment-notes.md       ← Railway / Render / Fly.io instructions
  future-monetization.md    ← Stripe Connect, subscriptions, care plans, upsells
```

---

## DB Schema — Tables

All defined in `lib/db/src/schema/`:

| Table | Purpose |
|---|---|
| `users` | All roles (client, provider, admin). `role` column gates access. |
| `provider_profiles` | Provider business info + verification status |
| `travel_zones` | Provider service areas |
| `availability` | Provider weekly schedule |
| `verification_docs` | Provider document metadata |
| `services` | Services offered by each provider |
| `bookings` | Visit requests + status state machine |
| `reviews` | Post-visit client reviews (one per completed booking) |
| `invoices` | Payment records (Stripe-ready) |
| `support_tickets` + `support_messages` | Internal support module |

Key conventions:
- **Prices in cents** (integer) — never floats
- `provider_profiles` is separate from `users` — keeps the users table role-agnostic
- Booking status transitions are strict — see `docs/booking-statuses.md`, enforce in route handlers
- Invoice is created automatically when booking reaches `confirmed`

---

## API Development Workflow

1. **Edit `lib/api-spec/openapi.yaml`** — define the endpoint shape first
2. **Run codegen**: `pnpm --filter @workspace/api-spec run codegen`
3. **Implement the route** in `artifacts/api-server/src/routes/`
4. **Push schema if DB changed**: `pnpm --filter @workspace/db run push`

Never edit files under `lib/api-zod/src/generated/` or `lib/api-client-react/src/generated/` directly.

---

## Demo Logins (once seed script exists)

| Role | Email | Password |
|---|---|---|
| Admin | admin@oncallfoot.com | demo1234 |
| Provider | sarah@oncallfoot.com | demo1234 |
| Provider | mike@oncallfoot.com | demo1234 |
| Client | jane@oncallfoot.com | demo1234 |
| Client | tom@oncallfoot.com | demo1234 |

---

## Portability — What Is and Isn't Replit-Specific

**Replit-only (safe to ignore on other hosts):**
- `artifact.toml` files — Replit workspace config
- `artifacts/mockup-sandbox/` — Replit design canvas tool, never deployed
- `.replit`, `.replitignore` — Replit IDE config
- `pnpm-workspace.yaml` `minimumReleaseAge` field — harmless on other hosts

**No lock-in in application code** — no `@replit/*` packages in any deployed artifact. See `docs/deployment-notes.md` for Railway/Render/Fly.io instructions.

---

## User Preferences

- **Vision first**: every build decision starts from `docs/product-vision.md` — comfort, trust, speed to care
- **Mobile-first always**: every screen designed for 390px before desktop
- **Commit notes serve the cause**: see `docs/checkpoint-notes-guide.md`
- **GitHub-first**: codebase stays clean, documented, and portable
- **No vendor lock-in** in application code
