# Secret rotation procedure — pilot readiness

**Date:** 2026-08-26 · **Status: documented + rotation drill PASS.**

## Secret inventory

| Secret | Where it lives | Used by | Blast radius if leaked |
|---|---|---|---|
| `JWT_SECRET` | deployment env only (never in repo) | API auth token signing | full account impersonation — rotate immediately |
| `DATABASE_URL` | deployment env only | API ↔ PostgreSQL | full data access — rotate DB password immediately |
| `SUPPORT_CONTACT_EMAIL` / `SUPPORT_CONTACT_URL` | deployment env | support footer links | low (public contact info) |
| `CANCELLATION_NOTICE_HOURS`, `TRAVEL_SETUP_BUFFER_MINUTES`, `MARKETPLACE_TIMEZONE` | deployment env | policy config | not secret — config only |
| Expo push credentials | Expo account (not in repo) | mobile push | push spoofing — rotate in Expo dashboard |
| GitHub access tokens | operator password manager / platform settings | repo pushes, PRs | repo write — revoke in GitHub settings |

Repo hygiene: `scripts/secret-scan.sh` (deny-list over tracked files) runs in
CI on every push — clean on this branch. `.env*` files are gitignored;
`.env.example` documents names only.

## Who has access

Deployment environment variables: **repository operator only** (platform
dashboard). No secrets are shared with pilot providers or clients.

## Rotation steps

### `JWT_SECRET` (drilled below)
1. Generate a new value: `openssl rand -hex 32`.
2. Update the platform env var; redeploy/restart the API.
3. **Effect:** every existing session token is invalidated at once — all users
   must sign in again (acceptable at pilot scale; do it off-hours).
4. Verify: an old token gets 401; a fresh login gets 200.

### `DATABASE_URL` / DB password
1. Rotate the password in the managed-DB dashboard (or `ALTER USER … PASSWORD`).
2. Update `DATABASE_URL`; restart the API; `curl /api/healthz` + one
   authenticated read.
3. Old credentials stop working immediately.

### Support contact
1. Update `SUPPORT_CONTACT_EMAIL`/`SUPPORT_CONTACT_URL`; restart.
2. Verify `GET /api/support/contact` returns the new value with
   `isPlaceholder: false`. Invalid values fail loudly (500 + thrown
   `InvalidSupportContactError`) rather than silently falling back.

### GitHub token
Revoke at github.com → Settings → Developer settings; issue a replacement;
update wherever the operator stores it. Never commit tokens.

## Rotation drill — 2026-08-26 (non-critical secret class test: `JWT_SECRET` on the local stack)

| Step | Result |
|---|---|
| Login with secret A → `GET /bookings` | **200** |
| Restart API with secret B (`JWT_SECRET` rotated) | server healthy |
| Same old token → `GET /bookings` | **401** (invalidated as designed) |
| Fresh login under secret B → `GET /bookings` | **200** |
| Simultaneously set `SUPPORT_CONTACT_EMAIL=pilot-support@example.com` | `GET /api/support/contact` → that address, `isPlaceholder:false` |
| Restore original local config | server healthy |

**Drill verdict: PASS.** Performed on the local disposable stack; the managed
deployment was not touched.
