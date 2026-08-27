# Native-device verification checklist — NOT automated, NOT claimed by CI

**Status:** Native-device behavior has **never been verified** in any recorded
session. CI (`.github/workflows/ci.yml`) runs the mobile typecheck and
deterministic Expo static exports for iOS and Android; those prove the bundle
compiles and exports — they are **not** native validation. Neither are Expo
web, browser previews, or source inspection.

This checklist is the authoritative manual procedure for a future
device-validation phase. Record device model, OS version, Expo SDK, and app
commit SHA with every run.

## Environments to cover (each is a separate sign-off)

| Environment | Status |
|---|---|
| iOS Simulator | NEVER RUN — unavailable in recorded environments |
| Android emulator | NEVER RUN — unavailable in recorded environments |
| Physical iOS device (Expo Go or dev build) | NEVER RUN |
| Physical Android device (Expo Go or dev build) | NEVER RUN |

## Setup

1. Start the API with a seeded scratch database reachable from the device
   (`DATABASE_URL`, `JWT_SECRET`, `pnpm run db:push && pnpm run seed`).
2. `pnpm --filter @workspace/mobile run dev` (Expo start) and open the app on
   the target device.
3. Sign in with the seeded demo accounts (see `docs/NEXT-STEPS.md`).

## Checks

### Booking and rescheduling
- [ ] Create a booking from marketplace slots (exact server slot submitted).
- [ ] Client reschedule of a CONFIRMED booking via real slots; current slot
      disabled and tagged "current"; old datetime never reusable.
- [ ] Provider proposes a new time (consent-first); client sees the proposal
      card; accept applies the time; decline keeps the original.
- [ ] Duplicate-tap protection on submit buttons.

### Native alerts
- [ ] Success/error alerts in the booking and reschedule flows render as
      native alerts (React Native Web `Alert` is a no-op — web export cannot
      verify this).

### Notifications
- [ ] Foreground push: in-app receipt on a booking status change.
- [ ] Background push: notification tap routes to `/booking/:id`.
- [ ] Cold start: kill the app, tap a push, deep link resolves after auth
      hydration.
- [ ] Permission denial: deny notifications → token registration remains
      non-fatal; flows keep working.

### Token lifecycle
- [ ] Push token registered on sign-in.
- [ ] Logout removes the registered push token (best-effort endpoint).
- [ ] Session expiry produces a clean re-auth path, not a crash.

### Device timezone differences
- [ ] Set the device to a non-marketplace timezone: booking lists, detail
      screens, and slot pickers all show marketplace-timezone labels with the
      zone abbreviation.
- [ ] Repeat across a DST boundary date if feasible.

### Deep links
- [ ] `/booking/:id` deep link from a killed app, a backgrounded app, and a
      running app; unauthorized booking ids do not leak details.

### Service-area eligibility (added 2026-08-26, roadmap #12)
- [ ] Marketplace booking modal: the service-area check (country/province/
      postal code) runs before slot submission; an ineligible postal code
      blocks booking with the approved calm copy (no internal details).
- [ ] Eligible postal code proceeds to slots; a booking within the provider's
      travel/setup buffer of another appointment is rejected with the
      approved 409 copy and the client can pick another time.
- [ ] The raw provider coverage list is never visible anywhere in the app.

## Store builds

No `eas.json` exists; store-level builds (EAS) remain an operator decision and
are out of scope for CI.

## Roadmap #13 additions to verify on real devices (2026-08-26 — NOT yet performed)

- Client cancel alert shows the server preview copy (free vs late) on iOS/Android.
- Provider "Mark no-show" appears only for past confirmed bookings; alert flow works.
- "Ask for help with this booking" opens an escalation and disables after success.
- Native alerts (RN `Alert.alert`) are no-ops in web export — these flows were
  verified via API + jsdom only. Native-device verification remains DEFERRED.

## Provider verification onboarding (2026-08-28 — emulation PASS, hardware DEFERRED)

- Provider signup → onboarding → verification-document submission → honest
  under-review success copy: PASS at Pixel 5 viewport (Chromium emulation),
  on both the current schema and the Gate B drift simulation.
- Repo emulation suite 9/9 PASS; real-browser smoke 13/13 PASS.
- Real-hardware verification of the onboarding flow remains DEFERRED with the
  rest of this checklist.

## Provider Approval Status & Activation Hub (2026-08-28 — emulation PASS, hardware DEFERRED)

- Activation hub (`/provider/application-status`) targeted smoke at 390×844
  (Chromium, real cookie sign-in): hero, status pill, truthful progress
  count, next-action deep link, checklist, verification card, readiness
  cards, help section, zero horizontal overflow, keyboard focus on
  interactive elements — 10/10 PASS.
- Repo emulation suite rerun with the hub built in: 9/9 PASS (iPhone 13
  WebKit + Pixel 5 Chromium profiles); real-browser smoke 13/13 PASS.
- The Expo app keeps its existing application-status screen (unchanged
  `GET /providers/application/status`); native hub parity is a deferred
  follow-up (see TODO ledger). Real-hardware verification remains DEFERRED
  with the rest of this checklist.
