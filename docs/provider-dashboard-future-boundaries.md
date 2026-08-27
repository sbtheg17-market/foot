# Provider Dashboard — Future Boundaries (White-Label, Organization, Engagement)

**Created:** 2026-08-28. Documentation only — records what is deliberately
NOT built and how today's provider-owned dashboard remains compatible with
future commercial paths without premature architecture.

## Strict current boundary

```text
Organization/workspace, tenant, provider affiliation, client group,
delegated admin, branding, contractor roster, and billing capabilities are
FUTURE and NOT IMPLEMENTED.
```

Not created in this task (and not to be inferred from any diagram here):
organization tables · workspaces · tenants · agencies · client groups ·
provider rosters · delegated admins · organization billing · white-label
routes · franchise management · contractor assignment · team scheduling.

The provider dashboard is and remains **provider-owned and provider-scoped**:
every read is gated to the authenticated provider's own data; platform-admin
pilot metrics, retention intent, and risk flags are never provider-visible.

## Role model (conceptual, future)

| Role | Today | Future |
|---|---|---|
| Platform administrator | Internal Foot operator (`/admin/pilot`) — IMPLEMENTED | unchanged |
| Organization administrator | DOES NOT EXIST | future paying customer managing a workforce/provider network |
| Provider/vendor | Provider portal owner — IMPLEMENTED | may optionally affiliate with an organization |
| Client | Books via provider page — IMPLEMENTED | may belong to org-managed client groups |

## Future-compatibility table

| Current provider dashboard concept | Future organization/workforce adaptation | Current action |
|---|---|---|
| Provider schedule | Organization-scoped workforce schedule | Keep provider-owned now |
| Booking link | Branded organization/provider booking page | Keep provider page canonical now |
| Provider metrics | Organization-scoped operational metrics | Keep metrics provider-only now |
| Availability controls | Workforce/assignment availability | Preserve existing provider rules |
| Support | Organization escalation path | Keep platform support now |
| Share tools | Organization-approved campaign tools | Keep existing provider share link now |

Why this works without premature tenancy: every current surface is keyed to
`providerProfileId` behind owner assertions. A future organization layer can
wrap that scoping (org → affiliated providers) without rewriting provider
surfaces — provided nothing today leaks cross-provider data or hardcodes
"provider == account" into client-facing contracts beyond what already
exists. The activation hub, dashboard payloads, and booking flows all satisfy
that today.

## Dashboard concept classification (required)

- **Implemented now:** today card, upcoming, booking-link growth card,
  source attribution, personal metrics, activity (latest-state), readiness
  entry, support entry, availability/services/service-area controls.
- **Ready to implement next:** next-best-action card + pending-reschedule
  surfacing (wiring of existing data); then Availability Exceptions
  (Phase B, first new model).
- **Future organization-compatible:** all of the above via org-scoped
  wrappers per the table; branded pages; org metrics rollups.
- **Deferred until real pilot evidence:** reminders, trends, event-history
  timeline, offers/engagement, payments, any org/workspace work.

## Future Provider Offer & Engagement system (documented, NOT implemented)

May later support: provider-created availability notices · repeat-booking
prompts · service update cards · optional client-portal notices ·
image/carousel content · consent-based client engagement.

Non-negotiable constraints recorded now, before any build:

```text
Explicit consent
Frequency caps
Dismiss/mute controls
Truthful availability
No fake scarcity
No deceptive countdowns
Accessible media with alt text
No arbitrary HTML or trackers
Privacy-safe targeting
Moderation and audit trail
Payments/redemption rules before discounts or charges
```

Not implemented in this task (and not authorized without pilot evidence +
policy work): offers, carousels, campaigns, microtransactions, paid boosts,
discounts, notifications, images, uploads, messaging.

## Strategic role boundary (append-only record)

```text
Platform-admin Pilot Operations Dashboard: IMPLEMENTED.
Provider Approval Status & Activation Hub: IMPLEMENTED (PR #64).
Provider Dashboard: initial conversion-first version IMPLEMENTED (PR #54);
  evolution blueprint documented (this task) — next wiring is Phase A
  completion, then Availability Exceptions.
Organization-admin/workforce dashboard: FUTURE, NOT IMPLEMENTED.
Provider Offer & Engagement system: FUTURE, NOT IMPLEMENTED.
```
