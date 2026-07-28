# Checkpoint & Commit Notes Guide

This document tells any agent — or contributor — how to write commit messages and checkpoint notes for this project. The standard is simple: **every note should serve the cause of best foot aid, quickly.**

---

## The Test

Before writing a commit message, ask:

> *"Does this note tell the next person (or agent) what got better for the user?"*

If the answer is "no" — if it only describes code mechanics — rewrite it.

---

## Format

```
<what changed>: <why it matters to the product>

Optional: note any non-obvious decisions or things the next agent must know.
```

---

## Examples

**Good:**
```
booking status patch route: providers can now accept requests with one tap
  - enforces allowed transitions from booking-statuses.md
  - returns the full updated booking so the client UI refreshes immediately
```

```
provider discovery endpoint: filters by city, service type, and verified-only
  - results ordered by rating DESC so best providers surface first
  - distance sort to be added once geo data is on provider_profiles
```

```
seed script: demo accounts ready (admin, 2 providers, 2 clients, sample bookings)
  - logins documented in README and replit.md
  - covers all booking statuses so UI can be tested against every state
```

```
auth middleware: JWT validation on all protected routes
  - requireSelf guard prevents cross-user data leaks
  - role checks match the permission matrix in docs/roles-and-permissions.md
```

**Bad (too mechanical, no product context):**
```
add route handler
fix bug
update schema
refactor auth
```

---

## Checkpoint Naming

When Replit auto-creates checkpoints or you name one manually, follow the same principle:

| Situation | Checkpoint name |
|---|---|
| Auth working end-to-end | `Auth: login, register, JWT middleware live` |
| Provider browse + profile | `Discovery: browse + provider profiles working` |
| Full booking flow | `Booking flow: request → confirm → complete` |
| Frontend skeleton | `Frontend: shell, routing, auth screens` |
| Seed data in | `Seed: demo accounts and sample data ready` |

---

## What Always Goes in the Notes

Regardless of what changed, always call out if you:

1. **Changed the DB schema** — note which tables and whether `db push` was run
2. **Changed the OpenAPI spec** — note that codegen must be re-run
3. **Added a required env var** — name it and add it to `replit.md` + `docs/deployment-notes.md`
4. **Changed a booking status transition rule** — note the change against `docs/booking-statuses.md`
5. **Changed a permission rule** — note the change against `docs/roles-and-permissions.md`
6. **Left something intentionally incomplete** — name it so the next agent doesn't wonder

---

## The Product Reminder

This project is in the **foot rejuvenation industry**. Every feature built is in service of one thing:

> The right professional reaches the right client at the exact moment they're needed.

If a commit gets us closer to that — faster matching, cleaner booking flow, more trustworthy provider profiles, a more comfortable mobile experience — say so in the note.
