# INSIGHTS LOG — OnCall Foot (append-only advisory loop)

PURPOSE: a durable, cross-handoff advisory ledger. Every agent/recipient who
inherits this workspace may APPEND an entry (never edit or delete prior
entries) with product/market/operational insight, so successive sessions
compound learning about what makes this app win — a human-in-the-loop
learning flywheel that parallels the provenance ledger's discipline.

STATUS OF EVERYTHING IN THIS FILE: NON-BINDING ADVISORY. Nothing here
authorizes scope. All implementation still requires owner approval, gate
compliance (Gate B, publication gates), and the repo's contract-first flow.

APPEND FORMAT (copy for new entries):
---
## INSIGHT-NNN — YYYY-MM-DD — <author/agent + session>
Context: <what state the product was in>
Insight: <the observation>
Why it matters: <market/revenue/trust rationale>
Cheapest first step: <smallest gate-compliant move>
Confidence + assumptions: <be honest>
---

============================================================================
## INSIGHT-001 — 2026-08-11 — Neo (E2/Emergent), post-C'/B' takeover session
### "Provider is the revenue engine; admin is the missing trust factory"

Context at time of writing: canonical main d2ad54cd (A'->C'->B' published).
Provider portal is rich (readiness, bookings, earnings, notifications,
sign-out). Admin surface is ~4 routes (application review approve/reject).
Monetization is contract/roadmap only (commission, SaaS tiers, featured
slots, recurring care plans — docs/future-monetization.md). Gate B
unverified; economics R1-R7 contract-only. Phase 4C comfort profiles
prepared. White-label deferred.

### A. What is MISSING, ranked by provider-revenue leverage

1. SUPPLY-HEALTH EARLY WARNING (admin dashboard, highest leverage).
   In supply-constrained care marketplaces, provider churn kills revenue
   months before demand churn is visible. Today an admin cannot see:
   acceptance rate, time-to-accept, availability-hours trend, last-active,
   declining-utilization curves per provider. The marketplace_events
   pipeline (Phase 3, published) already emits the raw events — what is
   missing is the admin READ layer: a "supply health" view with cold/warm/
   at-risk cohorts and a stuck-provider queue. Providers who feel busy stay;
   providers who go quiet churn silently. Retained provider = retained
   commission + SaaS seat. Cheapest first step: a read-only funnel/cohort
   API over existing marketplace_events (no schema change; aligns with the
   already-gated Phase 4-7 funnel work).

2. CREDENTIAL LIFECYCLE + SCOPE-OF-PRACTICE GUARDRAILS (the admin niche
   nobody generic owns). Foot care straddles wellness and clinical care
   (diabetic feet, post-surgical). Certifications and insurance EXPIRE.
   Missing: expiry dates on verification submissions, re-verification
   scheduling, automatic discovery-eligibility downgrade on lapse (Phase 4E
   hook), and a service-taxonomy flag (clinical vs wellness) mapped to
   credential tier. This is the difference between "a directory with
   badges" and "an operating system a liability insurer or B2B partner
   will trust". It also becomes the strongest white-label selling point
   later: compliance-as-a-feature. Cheapest first step: contract + OpenAPI
   draft for credential expiry/renewal states (non-schema, Phase-4C-style
   preparation discipline).

3. REBOOKING RATE AS THE CANONICAL QUALITY SIGNAL. In recurring care,
   "client books the SAME provider again" is a far stronger quality proxy
   than star reviews (elderly/diabetic clients rarely leave reviews but
   reliably rebook people they trust). Missing: per-provider rebooking %
   and client-retention curves, admin-visible, and eventually feeding
   discovery ranking. This also closes the "Right Pairing" promise loop:
   comfort profile (4C) -> pairing -> outcome (rebooked or not) -> better
   pairing. That outcome label is the seed of real machine learning for
   matching; the event taxonomy (Phase 4G, 14 events) should make sure a
   rebooking/same-provider flag is captured from day one.

4. DISPUTE / INCIDENT MODULE (in-home care WILL have incidents). PRD lists
   disputes + support_threads as target tables but nothing exists. An
   in-home visit gone wrong (injury allegation, property damage, no-show
   at a home, unsafe environment for the provider) is an existential trust
   moment. Missing: structured incident intake (both sides), resolution
   workflow with strike ledger, and admin notes that survive audits. Note:
   provider-side safety reporting (unsafe home) protects the REVENUE side
   and is almost universally forgotten by marketplaces. Post-Gate-B work,
   but the contract can be drafted now.

5. PAYOUT + COMMISSION AUDIT LEDGER (before Stripe, not after). When
   commission_cents lands, disputes about money follow. This repo already
   lives by an append-only provenance ledger for engineering; mirror the
   same discipline as an append-only FINANCIAL event ledger
   (invoice -> commission -> payout-record trail, immutable, admin-queryable)
   so reconciliation is a query, not archaeology. Rare in early
   marketplaces; cheap if designed before payments switch on; a white-label
   buyer requirement later anyway.

6. DEMAND-SUPPLY GAP MAP (turn admin data into a sales tool). Client
   searches/comfort profiles + travel zones already imply where demand
   exists with no provider coverage. Missing: an admin heat view of
   unserved demand. Direct monetization: recruit providers into proven-
   demand zones (their first weeks are pre-sold => activation + retention),
   and later sell "expansion slots"/featured placement by zone with actual
   evidence instead of promises.

### B. Vertical-specific market gaps (foot care, not generic marketplace)

7. HSA/FSA-READY RECEIPTS / SUPERBILL FIELDS. Diabetic and post-surgical
   foot care is health-adjacent spend. Adding provider-credential ID,
   service CPT-style descriptor and clean itemization to invoices makes
   receipts HSA/FSA-submittable (US assumption — verify jurisdiction).
   Near-zero build cost on the existing invoice model; unlocks a paying
   demographic and raises average order value. Differentiates instantly
   from beauty/wellness booking apps.

8. ORGANIZATION ACCOUNTS (pre-white-label stepping stone). Senior-living
   facilities, home-health agencies and podiatry-clinic overflow are
   natural bulk buyers: one org account, many care recipients (households
   already exist as a concept), consolidated invoicing, scheduled visit
   blocks. This is the bridge between single-marketplace and the deferred
   white-label platform phase — and it de-risks white-label by proving
   multi-tenant-ish boundaries inside one tenant first.

9. RECURRING CARE PLAN HEALTH (the retention product). future-monetization
   already plans care_plans. The missing admin/ops piece: plan-adherence
   monitoring (missed cycles = churn precursor + care risk for diabetic
   clients). "Your Tuesday client hasn't rebooked in 6 weeks" is
   actionable for provider AND platform. Recurring plans are the most
   stable provider income and therefore the most stable commission.

10. PUBLIC VERIFICATION REGISTRY (cheap trust multiplier). A public
    "verify this provider's badge" page (badge ID -> verified status,
    credential tier, insurance current: yes/no) that providers can link
    from their own marketing. Cost: one read-only endpoint + page.
    Value: providers advertise the platform FOR you; trust becomes
    distribution.

### C. Sequencing guidance (gate-compliant)
- NOW (non-schema, contract-first, matches current discipline): contracts +
  OpenAPI drafts for #2 credential lifecycle and #4 incident intake; event-
  taxonomy additions for #3 rebooking labels; docs for #7 receipt fields.
- AFTER GATE B: read layers for #1 supply health and #6 gap map over
  marketplace_events; then #5 financial ledger alongside economics
  implementation; #8/#9 as their own reviewed slices.
- Confidence: high on #1-#5 (structural marketplace economics), medium on
  #7/#8 (jurisdiction / sales-motion dependent), directional on #10.

### D. The learning loop this file exists for
Each future recipient: read the latest entries, add what the market taught
you (support tickets, provider interviews, funnel numbers), and cite ledger
evidence where possible. Insights with real event data (Phase 4G) beat
opinions; retire superseded insights by APPENDING a correction entry that
references the original — never by editing history. Same rule as the
provenance ledger: the loop only compounds if the record is append-only.
============================================================================
