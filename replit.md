# OnCall Foot

A premium mobile-first marketplace and operating system for in-home foot care professionals and their clients.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port from `$PORT`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run generate` — generate migration files (production)

## Required Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (already provisioned in Replit)
- `JWT_SECRET` — secret key for signing JWTs (must be set before auth routes work)
- `JWT_EXPIRES_IN` — token expiry e.g. `7d`
- `PORT` — set automatically by Replit

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (HS256) + bcrypt
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React 19 + Vite (artifact: `artifacts/web/` — to be built)

## Where Things Live

- `artifacts/api-server/src/routes/` — Express route handlers
- `lib/db/src/schema/` — Drizzle table definitions (source of truth for DB)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)
- `lib/api-zod/src/generated/` — auto-generated Zod validators (run codegen after spec changes)
- `lib/api-client-react/src/generated/` — auto-generated TanStack Query hooks
- `docs/` — architecture decisions, roles, booking statuses, routes map

## Database Schema

All tables are defined in `lib/db/src/schema/`. Current models:
- `users` — all roles (client, provider, admin)
- `provider_profiles` — provider business info + verification status
- `travel_zones` — provider service areas
- `availability` — provider weekly schedule
- `verification_docs` — provider document metadata
- `services` — services offered by providers
- `bookings` — visit requests and their lifecycle
- `reviews` — post-visit client reviews
- `invoices` — payment records (Stripe-ready)
- `support_tickets` + `support_messages` — internal support module

## Architecture Decisions

- Prices stored in **cents** (integer) to avoid float precision issues
- `provider_profiles` is separate from `users` to keep the users table clean and role-agnostic
- Booking status transitions are documented in `docs/booking-statuses.md` and enforced in route handlers
- OpenAPI spec drives codegen for both Zod validators and React Query hooks — always update spec before implementing a new endpoint
- No Replit-specific dependencies in application code — fully portable to Railway/Render/Fly.io

## User Preferences

- Build for continuity: future agents must be able to continue from repo docs and clear structure
- GitHub-first: codebase must remain clean, documented, and portable
- No vendor lock-in to Replit-specific patterns

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Always run `pnpm --filter @workspace/db run push` after changing schema files (dev)
- `SESSION_SECRET` is available as a Replit secret; `JWT_SECRET` must also be set

## Pointers

- See `docs/roles-and-permissions.md` for the full permission matrix
- See `docs/booking-statuses.md` for allowed status transitions
- See `docs/data-models.md` for full column reference
- See `docs/api-routes.md` for the complete route map
- See the `pnpm-workspace` skill for workspace structure details
