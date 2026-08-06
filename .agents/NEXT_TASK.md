# Next product task — eligible completed-booking reviews

Start this task only after the continuation package is committed and pushed from the synchronized baseline. Keep the feature limited to client reviews for eligible completed bookings.

## Product intent

After a provider completes an appointment, the client should be able to leave one useful, trustworthy review without seeing or exposing provider-private care notes. Reviews should improve confidence in provider selection while preserving booking ownership and lifecycle rules.

## Scope

### API and persistence

- Use the existing reviews table and review contract where possible.
- Allow submission only by an authenticated client for their own booking.
- Allow submission only when the booking status is exactly `completed`.
- Derive `clientId` and `providerId` from the server-side booking record; never trust those values from the request.
- Accept a required integer rating from 1 through 5 and an optional bounded comment.
- Prevent duplicates per booking, including concurrent submissions. Return a clear conflict response for the second submission.
- Preserve unauthorized/not-found behavior without leaking another client's booking or private booking data.
- Preserve provider-private `careNotes`; never include it in review responses, review UI, or public review data.
- Keep provider rating/count updates consistent with successful review creation and avoid double-counting.

### Web UI

- On completed client bookings, show a review action only when no review exists.
- Provide a mobile-first review form with a clear 1–5 rating control, optional comment, inline validation, loading/duplicate-submit protection, success feedback, and retry-safe errors.
- Do not show the review action for requested, confirmed, rescheduled, cancelled, no-show, or non-client bookings.
- Refresh or invalidate booking/detail/provider-review queries after a successful submission.
- Keep the existing cancellation and status-freshness behavior unchanged.

### Mobile UI

- Match the web eligibility and validation rules at 390px.
- Offer a reachable review action from completed booking list/detail surfaces.
- Disable the submit action while in flight and handle stale/conflict responses without duplicate reviews.
- Refresh the relevant booking and provider-review data after success.

### Tests and documentation

- Add route/integration coverage for:
  - Successful completed-booking review.
  - Rejection of non-completed bookings.
  - Rejection of another client's booking.
  - Provider/admin/non-client authorization rejection where applicable.
  - Invalid rating and comment validation.
  - Duplicate and concurrent submissions.
  - No `careNotes` leakage.
- Preserve and rerun existing booking state-machine, concurrency, typecheck, build, and 390px checks.
- Update `docs/api-routes.md`, `docs/data-models.md`, and any relevant UX/checkpoint documentation if behavior or contract details change.
- Append a complete session entry to `.agents/LOG.md`.

## Acceptance criteria

- [ ] Only an authenticated owner of a `completed` booking can submit a review.
- [ ] A booking can have at most one review, including under concurrent requests.
- [ ] Unauthorized, stale, invalid, and duplicate requests return safe, useful responses.
- [ ] Rating is an integer from 1 to 5; optional comment is validated and bounded.
- [ ] Provider identity and client identity are server-derived.
- [ ] `careNotes` never appears in review API responses or client UI.
- [ ] Web and mobile expose the review form only for eligible completed bookings.
- [ ] Web and mobile prevent duplicate taps/submits and recover cleanly from errors.
- [ ] Successful submission refreshes the relevant booking/provider review views.
- [ ] Existing cancellation, booking freshness, provider notification, and provider portal behavior remains intact.
- [ ] API contract/codegen, unit/integration tests, web/mobile typechecks, full build, and 390px previews pass.
- [ ] The scoped feature and documentation are committed and pushed to `origin/main`.

## Explicit exclusions

Do not combine this task with care history, Stripe/payments, admin review moderation, provider review replies, messaging, unrelated booking transitions, or unrelated schema/API changes.