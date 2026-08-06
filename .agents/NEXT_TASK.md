# Next product task — preserve the care-history checkpoint

The minimal client-safe care-history slice is implemented locally and must be
verified, documented, committed, and pushed before starting another product
feature.

## Completed slice

- `GET /bookings/history` is client-only, ownership-scoped, bounded, and
  returns completed, no-show, and cancelled booking history.
- History responses include provider identity and service summaries.
- Provider-private `careNotes` are excluded from care history and client booking
  list/create/detail/status responses.
- Web and mobile past-booking views include loading, empty, error/retry,
  refresh, provider, service, and status states.

## Required checkpoint work

- Run focused care-history tests.
- Rerun booking state-machine, booking concurrency, review, typecheck, build,
  and 390px web/mobile checks.
- Update `.agents/LOG.md` and continuation documentation.
- Commit one focused checkpoint and push normally to `origin/main`.
- Confirm local and remote hashes match, ahead/behind is `0/0`, and the working
  tree is clean.

## Explicit exclusions

Do not start Stripe/payments, admin care-history views, clinical-record
functionality, provider workflow redesign, new review workflows, messaging,
or unrelated schema/API changes.