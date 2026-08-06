# OnCall Foot — New-account continuation setup

This document is the shortest safe path for a new account, host, or agent to resume OnCall Foot without relying on chat history. The synchronized baseline for this package is commit `9abdd31`.

## 1. Clone and inspect

```bash
git clone <repository-url>
cd <repository-directory>
git checkout main
git pull --ff-only origin main
node --version
pnpm --version
```

Use Node.js 24+ and pnpm 9+ (the repository package manager is pnpm 9.15.0). Read these files before changing code:

1. `.agents/LOG.md`
2. `replit.md`
3. `docs/product-vision.md`
4. `docs/ux-guidelines.md`
5. `.agents/AGENT-RULES.md`

For product work, also read the relevant role, booking, data-model, and API documents.

## 2. Required external services and secure setup

### PostgreSQL database — required

The API and Drizzle schema require PostgreSQL.

- Replit: provision/use the workspace PostgreSQL database and let the platform expose `DATABASE_URL`.
- Other hosts: create a PostgreSQL instance and set `DATABASE_URL` in the host environment manager.
- Never put the connection string in Git, `.env.example`, logs, or chat.
- Development schema commands:

```bash
pnpm --filter @workspace/db run push
pnpm run seed
```

For production, follow `docs/deployment-notes.md`: generate/apply migrations according to the host's deployment process rather than experimenting against production.

### JWT signing secret — required for authenticated routes

Set `JWT_SECRET` in the host's secret manager. It must be a long random value and must never be printed or committed. `JWT_EXPIRES_IN` is optional and defaults to the server's configured expiry.

`SESSION_SECRET` is reserved for host/session integrations and may be required by a deployment environment even though the current API authentication is JWT-based. Keep it in the secret manager when the host provides or requires it.

### GitHub remote — required for checkpoint continuation

The repository uses `origin/main` as the synchronization target.

- Connect GitHub through the host's managed GitHub integration or credential manager.
- Use normal `git pull --ff-only` and `git push origin main`.
- Do not paste tokens into commands, files, logs, or documentation.
- After a reported push failure, compare `git rev-parse HEAD`, `git rev-parse origin/main`, and `git rev-list --left-right --count origin/main...main` before retrying. Do not force-push or rewrite history.

### Expo push delivery — optional mobile runtime service

Mobile push notification delivery uses Expo's push service through `expo-server-sdk` and `expo-notifications`. No Expo credential belongs in this repository.

- For a real device, use an Expo-compatible development build/account and grant notification permission.
- The app registers a device token with the API after an authenticated client/provider session.
- Push delivery is best-effort; booking state must remain correct if delivery is unavailable.
- Web development does not provide native Expo push delivery.

### Replit workflows — development convenience, not an application dependency

The current workspace workflows are:

- `artifacts/api-server: API Server`
- `artifacts/web: web`
- `artifacts/mobile: expo`
- `artifacts/mockup-sandbox: Component Preview Server`

Restart the relevant workflow after code, package, or run-command changes. The mockup sandbox is for design work only and is not deployed.

## 3. Install and run

```bash
pnpm install
cp .env.example .env
# Fill .env through a secure local environment manager only.

pnpm --filter @workspace/db run push
pnpm run seed
```

Run services in separate terminals:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/web run dev
pnpm --filter @workspace/mobile run dev
```

The API binds to `PORT`. The web client uses the API's `/api` path through the configured artifact/proxy setup. Mobile development uses the Expo script and host-provided Expo variables.

## 4. Contract and schema workflow

For any new or changed endpoint:

1. Edit `lib/api-spec/openapi.yaml`.
2. Run `pnpm --filter @workspace/api-spec run codegen`.
3. Implement the API route.
4. Use generated React Query hooks in web/mobile; never edit generated files manually.
5. Push development schema only when the data model actually changes.

Existing reviews table, review route contract, and public provider-review display are already present. Phase 3 authorization hardening is complete; the next task is the separately approved role-aware signup/onboarding checkpoint, see `.agents/NEXT_TASK.md`.

## 5. Verification and handoff

```bash
git status --short --branch
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run test:integration
git diff --check
```

Check the web and mobile surfaces at 390px before handoff. Append the completed work and verification to `.agents/LOG.md`, commit the scoped change, and push normally to `origin/main`.

## Known limitations and excluded features

- No Stripe/payment checkout or payment capture is part of the active checkpoint.
- Care history is implemented with bounded client-safe projections; provider-private `careNotes` must remain private and must not be exposed through client review responses or UI.
- Admin review moderation is represented in the broader API plan but is not part of the next client review slice.
- Expo push delivery depends on device permissions and external delivery; it is not a source of booking truth.
- The app currently uses JWT authentication and host-managed secrets; credentials are intentionally absent from this package.
- The mockup sandbox is a development/design tool, not a production service.
- Uploaded handoff files under `attached_assets/` are local-only and must remain outside Git history.