# OnCall Foot

OnCall Foot is a mobile-first marketplace and operating system for in-home foot care professionals and their clients. It connects mobile specialists with clients who want trusted visits at home.

---

## What It Is

A vertical marketplace with three roles:

- **Client** — discovers providers, books in-home visits, tracks appointments and invoices
- **Provider** — manages their business: services, schedule, clients, earnings, and bookings
- **Admin** — full platform oversight, verification management, analytics, and moderation

---

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces |
| Backend | Node.js 24, Express 5, TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | JWT (HS256) + bcrypt |
| API spec | OpenAPI 3.1 + Orval codegen |
| Frontend | React 19 + Vite + TanStack Query |
| Validation | Zod v4 + drizzle-zod |

---

## Run Locally

### Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

### Setup

```bash
cp .env.example .env
# Set the required values in the host's secret/environment manager.

pnpm install

# Push the development schema when the database is provisioned or changed.
pnpm --filter @workspace/db run push

# Optional: create the local/demo dataset.
pnpm run seed

# Start the API server.
pnpm --filter @workspace/api-server run dev

# In a second terminal, start the web app.
pnpm --filter @workspace/web run dev

# In another terminal, start Expo when mobile development is needed.
pnpm --filter @workspace/mobile run dev
```

Do not commit `.env` files, secret values, account passwords, tokens, or connection strings. Create test accounts locally or through the host's secret/seed workflow.

### Verification commands

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run test:integration
```

After changing `lib/api-spec/openapi.yaml`, regenerate the typed API packages before building:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## Project Structure

```
artifacts/
  api-server/          — Express 5 API (routes, middleware, auth)
  web/                 — React + Vite provider/client web app
lib/
  db/                  — Drizzle schema + migrations
  api-spec/            — OpenAPI spec (source of truth for contracts)
  api-zod/             — Generated Zod validators from spec
  api-client-react/    — Generated TanStack Query hooks from spec
docs/
  roles-and-permissions.md
  booking-statuses.md
  data-models.md
  api-routes.md
  future-monetization.md
  deployment-notes.md
scripts/               — Post-merge and build scripts
```

---

## Docs

See [`docs/`](./docs/) for:

- [Roles & Permissions](./docs/roles-and-permissions.md)
- [Booking Statuses](./docs/booking-statuses.md)
- [Data Models](./docs/data-models.md)
- [API Routes](./docs/api-routes.md)
- [Future Monetization](./docs/future-monetization.md)
- [Deployment Notes](./docs/deployment-notes.md)
- [New-account continuation setup](./.agents/SETUP.md)
- [Next product task](./.agents/NEXT_TASK.md)

---

## Portability

This project is designed to run on any Node.js host (Railway, Render, Fly.io, etc.). No Replit-specific dependencies exist in application code. See [`docs/deployment-notes.md`](./docs/deployment-notes.md).

## Current product scope

The active product surface includes provider discovery, client booking, booking lifecycle visibility, client cancellation, status freshness, provider notifications, and existing review API/public review display foundations. Stripe/payments, care history, and a full admin product remain outside the active client checkpoint.
