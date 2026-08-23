# Payments Foundation

**Status:** design and test foundation only. Payments are not implemented.

This document defines the provider-neutral contract for future payment work.
It does not authorize a provider, database migration, production configuration,
webhook activation, or financial side effect.

## Current repository boundary

The current invoice table is created when a booking becomes `confirmed` and
uses the existing `pending`, `paid`, and `cancelled` statuses. The booking
state machine remains authoritative and is not changed here. Existing invoice
read routes remain read-only. Any richer payment lifecycle below is a
provider-neutral target for a future schema/provider slice.

All amounts must be non-negative integer minor units with an explicit
three-letter ISO 4217 currency code. The server must look up the service price
and booking ownership; a client-supplied total is never authoritative.

## Provider decision

No provider is selected. **Recommendation for a later decision: Stripe
Connect**, because marketplace connected accounts, provider payouts,
authorization/capture, refunds, webhook signing, idempotency, and sandbox
testing are all established concepts in that product. This is a
recommendation, not an integration.

Before selection, the operator must verify current provider terms for:

- supported platform and connected-account countries, with Canada as the
  initial product-market assumption;
- CAD support and any additional settlement currencies;
- processing, Connect, payout, dispute, and currency-conversion fees;
- provider-account requirements, KYC/identity verification, and who owns
  merchant/tax responsibilities;
- sandbox, webhook retry, event replay, and account-deactivation behavior.

No provider-specific SDK, credential, endpoint, or webhook route belongs in
this foundation.

## Authorization, capture, and booking relationship

The intended future flow is:

1. The server resolves the service price and creates a `draft` invoice while
   the booking is still being prepared.
2. A provider authorization moves the invoice to `authorized`; a client
   action may move it through `requires_action` first.
3. Capture is a separate operation after the approved capture point (normally
   completion or an explicitly approved policy), moving to `captured`.
4. An uncaptured authorization may be voided. Refunds apply only after capture
   and move to `partially_refunded` or `refunded`.

Until a provider and capture policy are approved, the existing interim policy
stands: booking confirmation may occur before payment because the current
application has no live payment attempt. Payment status must not silently
change booking status, and payment integration must not rewrite the booking
state machine.

## Invoice lifecycle

The provider-neutral lifecycle is:

`draft → pending → requires_action → authorized → captured`

Failure and recovery paths are:

- `pending` or `requires_action` → `failed`;
- `failed` → `pending` for a bounded, idempotent retry;
- `pending`, `requires_action`, or `authorized` → `void` when the
  authorization/attempt expires or is cancelled;
- `captured` → `partially_refunded` → `refunded`, or directly `refunded`;
- `captured` or `partially_refunded` → `disputed`.

The current application mapping is intentionally conservative:

| Booking state | Current invoice behavior | Future payment target |
|---|---|---|
| `requested` | no invoice trigger | `draft`/not payable |
| `confirmed` | creates `pending` invoice | `pending` |
| `rescheduled` | booking remains active | preserve payment intent; re-price only by approved policy |
| `completed` | no capture automation | capture only after policy approval |
| `cancelled` | no automatic fee/refund policy | void/refund eligibility requires operator policy |
| `no_show` | no automatic fee/refund policy | requires operator policy |

## Cancellation, no-show, and rescheduling policy

The application must preserve current booking transitions:

- Client or provider cancellation is allowed from `requested`, `confirmed`,
  or `rescheduled` as defined in `docs/booking-statuses.md`.
- Client and provider no-show fee, refund, or payout outcomes are **operator /
  business decisions** and are not invented here.
- Pre-confirmation cancellation has no payment side effect in the current app.
- Post-confirmation cancellation may require a void or refund later, but
  eligibility, fees, and timing are unresolved.
- Post-capture cancellation, client no-show, and provider no-show require an
  approved fee/refund/clawback policy before implementation.
- Rescheduling keeps the booking state machine unchanged. Whether price,
  authorization window, or capture timing changes is unresolved.
- Declined rescheduling leaves the existing booking/payment state unchanged.

## Payouts, fees, taxes, and currency

Provider account onboarding, KYC, payout timing, hold period, platform fee,
refund clawbacks, failed payout recovery, and reconciliation are all
**operator/provider decisions**. A future payout record must reference the
payment/invoice and provider event rather than mutate financial history.

The initial currency assumption is CAD with integer cents, but supported
currencies and settlement countries are not approved. Tax ownership,
jurisdiction rules, tax-inclusive/exclusive display, rounding, and invoice
requirements are unresolved. No tax calculation is implemented.

## Failed payments and idempotency

Retries must be bounded and keyed by an idempotency key. A failed attempt keeps
the booking state unchanged, tells the client calmly that payment needs
attention, and does not expose provider secrets or internal error details.
Providers should see only the booking/payment status needed for their role.
An expired attempt requires support recovery or a new server-authorized
attempt; the client cannot choose a new amount.

## Webhooks

When a provider is selected, webhook handling must:

- verify the signature against the raw request body;
- reject stale timestamps and replayed event IDs;
- persist/deduplicate provider event IDs and idempotency keys;
- tolerate duplicate and out-of-order delivery using a monotonic,
  server-validated state transition;
- acknowledge only after an idempotent state decision;
- use bounded provider retries and redacted structured logs;
- carry a correlation ID through the request, invoice, and audit event.

There is no webhook route in this slice.

## Immutable financial audit trail

Every future payment event must record, without overwriting prior events:
payment ID, invoice ID, booking ID, client ID, provider ID, platform ID, amount
in minor units, currency, platform fee, tax, refund, payout reference, provider
event ID, idempotency key, correlation ID, event timestamp, and prior/new
status. Ledger history is append-only and remains unchanged by this foundation.

## Schema and deployment gate

No schema or migration change is included. A richer lifecycle requires an
operator-reviewed migration design, backup/recovery evidence, and the managed
database release gate in `docs/managed-db-release-gate.md`. Application
startup remains separate from schema migration.

Railway compatibility is preserved: `pnpm run build:deploy`, `pnpm run start`,
the co-hosted API/web service, and `/api/healthz` are unchanged. No payment
secrets or Replit-only runtime assumptions are added.