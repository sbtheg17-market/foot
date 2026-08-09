# Phase 4B — Provider Readiness Checklist UI (WRITTEN SCOPE OUTLINE ONLY)

Status: outline for review. NO UI files or product code have been changed.
Prerequisites (must be confirmed first): Step 1 branch cleanup + Step 2
managed-DB catalog gate (exit 0).

Baseline: foot origin/main 7c3367299bdaf635ff2340d0d5896da8f5cb38aa.

## Objective

Turn the existing owner-scoped readiness API into a visible provider workflow
that moves an approved provider toward their first client booking:

    Provider profile -> readiness checklist -> fix missing items
    -> "Ready for clients" state

Web provider portal FIRST (`artifacts/web/` only). Mobile parity is a
SEPARATE follow-up checkpoint (MC6 -> MC7 precedent).

## Data source (existing only — no backend change)

- `GET /providers/me/readiness` via the generated client hook (regenerate
  nothing; the contract already exists from Phase 2, published `4bb0e00`).
- No new endpoints, no OpenAPI edits, no schema change, no event writes.

## UI scope (artifacts/web/)

1. New route `/provider/readiness` in the provider portal + a checklist
   entry point from the provider dashboard/layout (nav item or card).
2. `ReadinessChecklist` component rendering C1–C7 as a vertical checklist:
   - per-item state: complete / missing (server-provided only — the client
     re-derives NOTHING);
   - plain-language description of each missing requirement;
   - a direct "Fix this" link per item routing to the existing surface that
     resolves it (profile edit, services CRUD, availability, travel zones,
     application status — exact mapping read from the API response fields);
   - progress summary (e.g. "5 of 7 complete").
3. "Ready for clients" state when the API reports the provider fully ready
   (celebratory, but factual — no discovery/activation claims beyond what
   the API returns).
4. States: loading skeleton; error + retry; 401 -> sign-in redirect; 403
   (non-provider member); 404/empty (no application yet) -> onboarding
   entry point; focus/reconnect refetch.
5. Privacy boundaries: render only owner-scoped fields from the readiness
   response; never render `reviewerNotes`/`reviewedBy` or any
   reviewer-private data (they are not in the response; the UI must not
   fetch other sources to fill gaps).
6. `data-testid` on every state and interactive element.

## Explicitly OUT of scope (locked)

- No discovery control or eligibility change (Phase 4C decision pending).
- No booking enforcement (Phase 4D), no activation override, no
  deactivation action, no event emission from the UI.
- No schema, OpenAPI, generated-client, or API changes.
- No mobile changes in this checkpoint.
- No email/push/notification coupling.

## Validation plan

- Full workspace typecheck + web production build.
- Existing API regression suites stay green (no API change expected).
- Manual browser screenshot verification of every state (no new web test
  framework — deferred item unchanged).
- Scope check: changed files limited to `artifacts/web/**` +
  `.agents/LOG.md` + `.agents/NEXT_TASK.md` (Session 059 entry).
- `publish:gate` run with the allow-list extended to the approved file set
  before handoff; patch + SHA-256 produced; managed-channel publication
  after separate review.

## Open questions for the reviewer (do not block the outline)

1. Where should the checklist live: its own `/provider/readiness` page,
   a dashboard card + page, or both?
2. Should the C1–C7 labels come verbatim from the API response, or is a
   fixed client-side label map per readiness key acceptable?
3. Is a progress indicator (n of 7) wanted in the provider nav/layout
   (similar to the Alerts badge), or page-only for this slice?
