# OnCall Foot

**OnCall Foot** is a premium mobile-first marketplace and operating system for in-home foot care professionals and their clients. It connects mobile pedicure specialists, foot spa providers, and foot wellness professionals with clients who want visits at home.

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
# fill in DATABASE_URL and JWT_SECRET

pnpm install

# push DB schema
pnpm --filter @workspace/db run push

# seed demo data
pnpm --filter @workspace/api-server run seed

# start API server
pnpm --filter @workspace/api-server run dev

# start frontend (when built)
pnpm --filter @workspace/web run dev
```

### Demo Logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@oncallfoot.com | demo1234 |
| Provider | sarah@oncallfoot.com | demo1234 |
| Provider | mike@oncallfoot.com | demo1234 |
| Client | jane@oncallfoot.com | demo1234 |
| Client | tom@oncallfoot.com | demo1234 |

---

## Project Structure

```
artifacts/
  api-server/          — Express 5 API (routes, middleware, auth)
  web/                 — React + Vite frontend (to be built)
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

---

## Portability

This project is designed to run on any Node.js host (Railway, Render, Fly.io, etc.). No Replit-specific dependencies exist in application code. See [`docs/deployment-notes.md`](./docs/deployment-notes.md).
