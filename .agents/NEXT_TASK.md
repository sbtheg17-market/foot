# Next product task — role-aware marketplace signup and onboarding

## Current gate

Phase 3 authorization hardening is complete and verified. Database-backed role
membership checks, approved-provider enforcement, provider-application
ownership checks, and admin membership checks are live. Do not begin this task
until the user explicitly approves the signup/onboarding checkpoint.

## Audit status

Phase 0, the additive schema migration, compatibility backfill/server-state
exposure, and Phase 3 authorization hardening are complete. Implementation of
role-aware signup/onboarding remains paused until the product/API checkpoint is
explicitly approved.

## Current findings

- Web and mobile already use one shared authentication flow and one shared
  `POST /auth/register` API.
- Signup currently persists the selected `role` directly to `users.role` and
  immediately issues a JWT containing that role.
- `users.role` is a single PostgreSQL enum value (`client | provider | admin`);
  a user cannot currently hold both client and provider roles.
- `provider_profiles.user_id` is unique, but there is no provider application
  or onboarding-state table.
- Provider profile status exists (`pending`, `under_review`, `approved`,
  `rejected`) and profile completion exists, but provider registration does not
  create or manage a safe pending application flow.
- Provider-only API routes now require database-backed provider membership,
  same-user/same-profile application ownership, approved application status,
  and approved provider-profile verification status.
- There is no email/phone verification implementation beyond placeholder
  password-reset routes.
- No analytics/event-tracking convention was found.
- Web currently uses `/register`, `/login`, `/discover`, `/bookings`, and
  `/provider/*`; mobile uses Expo auth screens and tab/account routes. The
  requested `/signup`, `/onboarding/*`, `/client/dashboard`, and
  `/provider/application-status` routes do not exist.

## Decision gate

Before implementation, explicitly approve a planned product/schema/API
checkpoint for:

- representing multiple roles per authenticated user without duplicating
  accounts;
- representing provider application/onboarding state separately from
  authorization;
- deriving effective authorization server-side and issuing refreshed session
  claims after approved role changes;
- preserving all existing client/provider/admin permissions and privacy
  behavior.

Phase 3 is not a reason to add active-role switching automatically. Keep
`users.role` and the current JWT shape compatible until the signup/onboarding
checkpoint defines the safe context-selection behavior.

Do not add Stripe, payout onboarding, admin expansion, care-history expansion,
or unrelated review work in this task.

## After approval

1. Define the migration and API contract in OpenAPI first.
2. Add focused server tests for role intent versus authorization, pending
   provider applications, cross-role access, duplicate signup, refresh/resume,
   and privacy.
3. Implement shared web/mobile signup and server-confirmed redirects.
4. Add client and provider onboarding states without blocking ordinary client
   signup on provider-only fields.
5. Run the existing booking/review suites, new onboarding tests, typecheck,
   build, workflows, and 390px previews.