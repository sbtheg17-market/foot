# Graphify Continuity Workflow

**Added:** 2026 continuity-infrastructure task (branch
`chore/add-graphify-continuity-workflow`).
**Status:** optional, local-first developer/agent aid. Not a product feature.

## Purpose

- Graphify is a **local-first codebase continuity aid** for OnCall Foot
  (`sbtheg17-market/foot`).
- It maps code, tracked docs, frozen SQL migration artifacts
  (`docs/migrations/*.sql`), and configuration into a queryable knowledge
  graph (`graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html`,
  `manifest.json`).
- It reduces duplicate investigation and improves handoffs between agent
  sessions (Neo, Replit, Emergent, etc.).
- It is **not** an application feature, production service, deployment
  dependency, analytics system, or source of truth. `origin/main` source code
  and the docs under `docs/` remain authoritative.

## Installation (development environments only)

Graphify is a Python CLI installed as an isolated tool — it is **never** part
of the Node/pnpm dependency graph, Docker images, deploy scripts, or CI:

```bash
uv tool install "graphifyy[sql]"     # preferred (the [sql] extra parses docs/migrations/*.sql)
graphify --version                   # verify (this repo's graph was built with 0.9.50)
```

The project-scoped agent skill lives at `.agents/skills/graphify/SKILL.md`
(installed via `graphify install --project --platform agents`). It is
instructional only and blocks nothing.

## Commands

```bash
graphify query "How does provider signup work?"
graphify query "What code enforces travel/setup buffers?"
graphify path "register" "provider_profiles"
graphify explain "booking_outcome_history"
```

`graphify path` searches directed edges by default; add `--undirected` when a
directed route does not exist. `graphify query` truncates to a token budget;
use `--budget` or narrower questions for deep dives.

## Handoff status block (required in every future Neo handoff)

Copy this block into each handoff and update the baseline SHA after any
graph refresh:

```text
Graphify status:
- Main graph artifact baseline: 96b7102694d656112d9e486205d4850333040918 (refreshed 2026-08-28; previous baseline c2c6c10cc93a7f1f3b025fcf9ff5320283255044)
- Extraction mode: CODE-ONLY LOCAL
- Graph files: graphify-out/graph.json, GRAPH_REPORT.md, graph.html, manifest.json
- Refresh policy: manual after major merged roadmap work or significant refactor
- Refresh command:
  graphify extract . --code-only
  graphify cluster-only . --no-label
- Safety: no external APIs, no managed DB introspection, no public Graphify server, no hooks, no CI gate, query logging disabled
- Before substantial work: query Graphify first, then verify output against source and Git history
- If current HEAD differs materially from the graph baseline: graph is potentially stale; refresh is recommended but non-blocking
```

## Worked example — queries verified against source

These queries were run against the committed graph and every cited result was
verified in source (do the same before acting on any graph output):

```bash
graphify query "Where are provider approvals, booking source attribution, cancellations, no-shows, service areas, and provider profiles represented?"
graphify query "What authorization patterns protect existing admin and provider routes?"
graphify query "How is source attribution recorded and exposed?"
```

Verified findings:

- **Provider profiles / approvals:** `providerProfilesTable` →
  `lib/db/src/schema/providers.ts` L22; `providerApplicationsTable` →
  `lib/db/src/schema/provider-applications.ts` L31; admin review statuses
  (`pending`/`under_review`/`approved`/`rejected`) in
  `artifacts/api-server/src/routes/admin.ts`.
- **Service areas:** `providerServiceAreasTable` (L28) and
  `providerCoverageAreasTable` (L71) in `lib/db/src/schema/service-areas.ts`.
- **Cancellations / no-shows:** `artifacts/api-server/src/routes/bookings.ts`
  + `src/lib/booking-state-machine.ts` + `src/lib/cancellation-policy.ts`;
  append-only history table in
  `docs/migrations/CANCELLATION_NO_SHOW_SUPPORT_V1.sql`
  (`booking_outcome_history` REFERENCES `bookings`/`users`, EXTRACTED edges).
- **Authorization patterns:** `requireAuth` (L96) + `requireRole(...)` (L126)
  in `artifacts/api-server/src/middlewares/auth.ts`; the admin router mounts
  `router.use(requireAuth, requireRole("admin"))`
  (`routes/admin.ts` L18); provider routes use
  `requireAuth, requireRole("provider")` per-route (`routes/providers.ts`).
- **Source attribution:** recorded at booking creation via the allowlisted
  `bookings.source` column (`lib/db/src/schema/bookings.ts` ~L45–48,
  privacy-safe); aggregated in `routes/providers.ts` (acquisition-source
  grouping, `qr-card` → `qrCard`, ~L2659–2755) and exposed on the provider
  dashboard response; rendered by `SourceAttributionChart` / `SOURCE_ROWS`
  (`artifacts/web/src/components/dashboard/source-attribution-chart.tsx`
  L23 / L9).

## Agent workflow

For any significant continuation task, Neo (or any agent) should:

1. fetch and inspect current Git state (`git fetch origin --prune`, verify
   `origin/main` SHA per `AGENTS.md`);
2. read the relevant continuity handoff (`docs/NEXT-STEPS.md`,
   `docs/neo/…-handoff.md`, `.agents/LOG.md`);
3. query Graphify for architecture and dependency context;
4. verify Graphify results against source before making edits;
5. treat `EXTRACTED` edges as direct evidence and `INFERRED` edges as
   hypotheses to verify;
6. inspect Git history/PRs/branches before recovering any work;
7. never use Graphify as justification to skip tests or code review.

## Privacy and security

- Code AST extraction is **local and deterministic** (tree-sitter). No code
  leaves the machine.
- **No external API key is used by default.** Community labeling was skipped
  (`cluster-only --no-label`); communities appear as `Community N`
  placeholders. Semantic extraction of docs/PDFs/images and LLM community
  naming require a configured backend and **explicit operator approval**.
- `.env` files, secrets, runtime data (`var/`, `artifacts/**/var/`), local
  databases, `attached_assets/`, agent memory, and generated build output are
  excluded via `.graphifyignore`.
- Query logging remains **disabled**.
- No public/shared Graphify HTTP server is authorized
  (`graphify serve --transport http` is prohibited).
- Live managed-database introspection is **prohibited**
  (`graphify extract . --postgres …` must never be run against the managed
  DB; this repo's DB gates are in `docs/managed-db-release-gate.md`).

## Update policy

- Refresh the graph manually after major merged roadmap work or a significant
  refactor:
  ```bash
  graphify extract . --code-only
  graphify cluster-only . --no-label   # regenerates GRAPH_REPORT.md + graph.html without any LLM
  ```
- Do **not** require it in CI.
- Do **not** enable auto Git hooks (`graphify hook install`) unless expressly
  authorized later.
- Before committing a refresh, inspect graph outputs and perform the secret
  scan:
  ```bash
  rg -n -i "api[_-]?key|secret|password|token|private[_-]?key|database_url|authorization: bearer" graphify-out/ || true
  bash scripts/secret-scan.sh
  ```
  Symbol *names* (e.g. `signToken()`, `pushTokensTable`) are expected; secret
  *values* are not. If a value appears, do not commit — fix
  `.graphifyignore`, delete `graphify-out/`, rebuild, and rescan.

## Committed vs. ignored artifacts

Committed (portable team artifacts): `graphify-out/graph.json`,
`graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html`,
`graphify-out/manifest.json`.

Ignored (local-only, see `.gitignore`): `graphify-out/cache/`,
`graphify-out/cost.json`, `graphify-out/.graphify_analysis.json`,
`graphify-out/.graphify_root`.

## Package scripts decision

No `graphify:*` scripts were added to `package.json`. The workspace scripts
are all pnpm-workspace product commands, and Graphify (a Python `uv` tool) is
not guaranteed in every developer environment — a workspace script would be
misleading and could be mistaken for a build dependency. Run the CLI
directly. No build/test/deploy script depends on Graphify.

## Limitations

- The graph is an aid, not authoritative documentation.
- It can contain inferred relationships (`INFERRED` edges) that must be
  source-verified before acting on them.
- Code-only extraction may not provide full semantic mapping of non-code
  documents (the 2026 initial build skipped ~76 markdown docs and 4 images
  from LLM extraction by design; the SQL migration artifacts *are* parsed via
  the `[sql]` extra).
- Full document/PDF/media extraction requires a configured backend and
  explicit privacy approval.
- The graph goes stale: `GRAPH_REPORT.md` records the commit it was built
  from — compare with `git rev-parse HEAD`.

## Instance-model scope note (added 2026-08-29)

Graphify maps the **canonical prototype repository only**
(`sbtheg17-market/foot` — OnCall Foot). Client/provider instances — the
isolated per-provider GitHub/Railway/Supabase deployments defined in
`docs/canonical-prototype-and-instance-model.md` — are **never** added to
this graph. Do not index instance repositories, the instance registry,
external account data, secret files, database dumps, browser artifacts,
screenshots, `.env` files, credentials, or client data. `.graphifyignore`
remains the boundary for what may be extracted here.
