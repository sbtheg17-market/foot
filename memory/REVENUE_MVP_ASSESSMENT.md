# OnCall Foot — Revenue-MVP Position Assessment (2026-08-11, post-Session 072)

Read-only assessment against origin/main `6f7ec67` + verified managed DB state.
Summary: the FREE marketplace loop is functionally complete and tested end-to-end;
ZERO automated payment rails exist. Revenue capability = Stripe slice + production
deployment; both are greenfield but the schema was designed for them.

## What is genuinely DONE (evidence-based)
- Full marketplace loop, no money: provider signup → application → admin review/approval
  → verification gating → services/availability/travel-zones → public discovery
  (verified-only) → client booking request → provider confirm → complete → invoice RECORD
  (pending) → one-review-per-completed-booking. All tested (63 state-machine, 16
  concurrency, 23 onboarding, 14 reviewer, 14 readiness, 12 notifications, 12 events,
  8+9+11+11 application suites, 7 reviews, 7 lifecycle — all green as of Session 070/072).
- Session 070 slice on main: in-app cancel confirmations, duplicate-submit 409, modal UX.
- Trust rails (revenue-relevant): verification queue, reviewer decisions, verified-only
  discovery, private care notes, RBAC on DB truth.
- Money-ready data model: integer cents everywhere; invoices auto-created on confirm with
  pending→paid reserved; documented schema hooks for stripe_payment_intent_id,
  commissions, subscriptions, featured listings, care plans (docs/future-monetization.md).
- Analytics substrate: append-only marketplace_events (12/12) — now unblocked by Gate B.
- Managed production database: Gate B CLEARED — Supabase PostgreSQL 17.6 with exactly the
  18-table pinned schema, 0 rows (no seed decision yet).

## What does NOT exist (blocking revenue)
1. Payments: no Stripe/PSP code anywhere (grep-verified). Invoices never become "paid".
2. Payouts/commission/subscriptions/featured: DESIGN ONLY.
3. Production deployment: no hosting evidence; app runs in dev workspaces only; managed
   DB is provisioned but nothing points at it; seed policy undecided.
4. Operational minimum for taking money: refunds/cancellation-money policy, admin invoice
   view, disputes, support routes (schema only), account deletion, email notifications
   (push/SSE exist; email absent), password reset UNKNOWN.
5. Race-proof duplicate index (app-level only today) — required before real concurrent
   traffic takes payments on bookings.
6. Geo search is PARTIAL (browse only) — acceptable for a single-market beta.

## Shortest credible paths to first revenue
- Path A (lowest build): provider SaaS subscription via Stripe Billing + feature gating
  (readiness checklist, analytics, featured placement). ~3-4 scoped tasks. Charges
  providers; no money-splitting, no Connect KYC, minimal dispute surface.
- Path B (marketplace-native): commission per booking via Stripe Connect Express —
  client pays on confirmation, platform keeps application fee, provider auto-paid.
  ~5-7 scoped tasks (Connect onboarding, checkout, webhooks → invoice paid, refund-on-
  cancel policy, admin invoice view). Higher build + compliance, aligns with the vision.
- Path C (zero build, manual): single-market beta with offline payment + manually
  invoiced provider fee. Validates demand now; no code.

## Recommended sequence (each = one task → one commit → one patch → one PR)
R0 Race-proof partial unique index (already queued, now unblocked)
R1 Production deployment slice: point API at managed DB, seed policy, secrets, healthz
   monitoring, domain
R2 Stripe slice (pick Path A or B — decision needed from operator)
R3 Operational minimum: refund policy on cancellation, admin invoice view, support intake
Deferred: Phase 4C comfort port, analytics dashboards, mobile parity, care plans.

Position in one line: ~90% of a bookable marketplace, ~0% of the payment rails;
revenue-capable in roughly one deployment slice + one Stripe slice.
