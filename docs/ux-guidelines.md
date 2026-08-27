# UX & UI Guidelines — OnCall Foot

This document is the definitive reference for any agent building the frontend (`artifacts/web/`) or any client-facing UI. Read `docs/product-vision.md` first — this document operationalizes that vision into concrete decisions.

---

## Mobile-First Is Non-Negotiable

The primary user is a client booking a visit from their phone, or a provider accepting a request between appointments. Every screen must be designed for a 390px viewport first. Desktop is an enhancement, not the baseline.

**Checklist for every screen:**
- [ ] Tap targets are ≥ 44px tall
- [ ] Text is legible at 16px base (no 11px fine print on mobile)
- [ ] Primary action is thumb-reachable (bottom half of screen)
- [ ] No horizontal scroll on mobile
- [ ] Forms use appropriate input types (`tel`, `email`, `date`, `number`)
- [ ] Loading states exist — no blank screens during API calls
- [ ] Empty states have a clear next action

---

## Visual Language

### Palette

The palette should communicate **health, trust, and premium care**. Suggested direction:

| Role | Intent |
|---|---|
| Primary | Deep, confident — conveys trust and professionalism (deep navy, slate, or forest) |
| Accent | Warm and inviting — suggests wellness and care (warm amber, blush, or sage) |
| Surface | Clean whites and very light greys — clinical cleanliness without coldness |
| Destructive | Standard red — only for cancellations and irreversible actions |
| Success | Calm green — confirmations, completed visits |

> Agent note: When implementing the design system, pick a cohesive palette and lock it in `tailwind.config` as named tokens (not ad-hoc hex values). Every component uses tokens, never raw colors.

### Typography

- **Headings**: Humanist sans-serif — approachable but authoritative (e.g. Inter, Geist, or DM Sans)
- **Body**: Same family, 16px base, 1.5 line-height minimum on mobile
- **Numbers / prices**: Tabular lining figures — never let prices shift width
- **No all-caps body text** — it reads as shouting

### Spacing

- Use an 8px grid. All spacing values are multiples of 4 or 8.
- Cards have generous padding (16px minimum on mobile, 24px on desktop)
- Section breaks use whitespace, not dividers — dividers only for data tables

### Elevation / Shadow

- Light, diffused shadows only — this is a wellness product, not a finance dashboard
- Cards float softly; no hard borders on cards unless inside a data table
- Bottom sheets (mobile modals) use a subtle backdrop, not a full dark overlay

---

## Navigation Pattern

### Client app
- **Bottom tab bar** (mobile) — 4 tabs max: Home / Discover, Bookings, Profile, [optional: Messages]
- Avoid hamburger menus — they hide your app's structure
- Active tab clearly distinguished (filled icon + label color change)

### Provider portal
- **Bottom tab bar** (mobile): Dashboard, Requests, Schedule, Earnings, Profile
- Provider portal should feel like a focused tool, not a marketing site

### Admin
- Side nav (desktop primary) with a slide-in drawer on mobile
- Admin is never the primary mobile use case; usable on tablet/desktop is sufficient

---

## Key Screens & UX Principles

### Provider Discovery (client-facing)

This is the highest-stakes screen — first impressions.

- **Lead with the provider's face and name** — humans book from humans, not from credentials lists
- Star rating + review count visible immediately
- "Verified" badge prominent but not aggressive
- Distance shown in human terms ("12 min away", "4.2 miles") not coordinates
- Filter chips at the top (Service type, Available today, Rating, Distance) — not a hidden filter sheet
- Lazy-load provider cards — never show a spinner with nothing beneath it

### Provider Profile (client-facing)

- Hero: photo, name, title, rating, verification badge — above the fold on mobile
- Services listed with price and duration — scannable at a glance
- Reviews below services — 3 visible, expand for more
- Sticky "Book Now" button at the bottom on mobile — always visible
- Availability preview ("Next available: Tomorrow 2 PM") near the CTA

### Booking Flow

Keep it to 3 steps maximum on mobile:
1. Select service + preferred time (provider's availability calendar)
2. Confirm address
3. Review & confirm (price, time, provider — all visible before tapping "Confirm")

No account required to browse; account required to book. Registration during booking should be frictionless (email + password only — ask for more later).

### Booking Confirmation

This screen is a trust moment — make it feel like a real confirmation:
- Provider's photo, name
- Date, time, service, address — all explicit
- "Add to calendar" link
- Estimated invoice amount
- "Message provider" option (future feature — show as coming soon, not missing)

### Post-visit review

- Show a review action only for the owning client's `completed` bookings.
- Use a 1–5 star control with 44px minimum tap targets and an optional comment
  capped at 1,000 characters.
- Keep validation inline; replace the submit label while saving and disable the
  action to prevent duplicate submissions.
- After saving, show the submitted review in place and refresh provider review
  surfaces. A conflict means the review already exists, not that the client
  should retry blindly.

### Client care history

- Keep upcoming visits and past care history visually distinct.
- History cards show the visit date, status, provider identity, service, and
  client-visible location/notes only; never show provider-private care notes.
- Use a bounded, refreshable list with loading skeletons, a calm empty state,
  and a retry action for failures.
- Preserve the same history eligibility, ownership, and privacy behavior on web
  and mobile at the 390px baseline.

### Provider Dashboard

- Today's appointments prominently — "You have 2 visits today"
- Pending requests with one-tap accept/decline (not buried in a list)
- Earnings summary (this week / this month) — providers care about money
- Quick-edit availability toggle ("I'm available today" on/off)

### Empty States

Never leave a user staring at nothing. Every empty state needs:
- An icon or illustration (lightweight, not clip art)
- One sentence that names what's missing
- One action that fixes it

| Screen | Empty state text | Action |
|---|---|---|
| Client bookings | "Your foot care journey starts here." | Browse providers |
| Provider requests | "No new requests. Your profile is live." | Edit availability |
| Provider earnings | "Your first booking will show earnings here." | — |
| Reviews | "No reviews yet — your first visit will change that." | — |

### Error States

- Never show a raw error code or stack trace
- "Something went wrong — please try again" + retry button covers 90% of cases
- Network errors: "Check your connection and try again"
- 404: "We couldn't find that page" + home link
- Form validation: inline, on-field, in red — never a toast for validation errors

---

## Interaction Patterns

### Loading
- Skeleton screens (content-shaped placeholders) — not spinners, except for full-page initial loads
- Button loading state: replace label with a spinner, disable the button — never let users double-tap

### Toasts / Notifications
- Success: bottom of screen, auto-dismiss in 3s, soft green
- Error: bottom of screen, requires dismissal, red
- Only one toast visible at a time
- Never toast validation errors — those belong inline

### Confirmations
- Destructive actions (cancel booking, delete service) require a bottom sheet confirmation on mobile — not a browser `confirm()` dialog
- Wording: confirm button says the action ("Cancel booking"), not "OK" / "Yes"

### Pull to Refresh
- Implement on all list screens (bookings, providers, notifications)

---

## Component Architecture Notes (for React/Vite frontend)

- Use `lib/api-client-react` TanStack Query hooks for all data fetching — do not write raw `fetch` calls in components
- Use `lib/api-zod` validators to parse API responses at the boundary — not inside components
- Keep components in `src/components/` — screens in `src/pages/` or `src/screens/`
- Shared UI primitives (Button, Card, Badge, Avatar, BottomSheet) live in `src/components/ui/`
- Route with `wouter` (already in catalog) — keep routes flat and predictable

---

## Accessibility

- All interactive elements have a focus ring (not `outline: none` without replacement)
- Color alone never communicates state — always pair with icon or text
- Images have `alt` text; decorative images have `alt=""`
- Form fields always have associated `<label>` elements

---

## Performance Targets (mobile on 4G)

- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- No layout shift on load (reserve space for images)
- Lazy-load images below the fold

---

## Writing for the UI

Every string in the UI — labels, buttons, placeholders, descriptions — should pass through this filter:

1. **Is it specific?** "Book Sarah for a pedicure" > "Submit booking"
2. **Is it human?** "Your session is confirmed" > "Booking status: CONFIRMED"
3. **Is it calm?** Errors don't panic. Confirmations don't over-celebrate.
4. **Does it move the user forward?** Every empty state and error has a next step.

The app speaks like a knowledgeable, warm professional — not a form.

## Provider public booking page — 2026-08-25 (roadmap #11)

The provider-owned booking page (`/book/:providerSlug`) is a conversion
surface a provider shares directly (Instagram bio, texts, QR cards, print,
their own website). Principles:

- **One canonical page per provider.** The QR code and every share action
  encode the same `/book/:slug` URL — never campaign-specific duplicates.
- **Distinct from marketplace discovery** (`/providers`), but derived from the
  same profile/services/availability source of truth and the same booking flow.
- **Honest copy.** The dashboard card never promises marketplace client
  acquisition; sharing the link is provider-driven.
- **Non-leaking fallbacks.** Missing, unpublished, and inactive providers all
  render the same calm generic not-found state with a next step
  ("Browse providers"); no provider state is disclosed.
- **Mobile-first and accessible**: service selection uses real buttons with
  `aria-pressed`, the sticky booking CTA explains why it is disabled, the QR
  image has a descriptive text alternative and a labeled PNG download.
- **Privacy**: only public-safe provider fields render; attribution `source`
  parameters are allowlisted and invisible to visitors.

## Service-area eligibility and travel buffer — 2026-08-26 (roadmap #12)

The provider promise: *"Share your booking page confidently. Clients confirm
their area before booking, and available times include practical setup/travel
time."* Principles:

- **Eligibility before commitment.** On `/book/:providerSlug` the client
  confirms their area (country/province/postal code) BEFORE service and slot
  selection; slots are never shown to an unconfirmed visitor. The same check
  gates the marketplace/mobile booking modal.
- **Plain-language postal guidance.** Providers managing "Areas you serve"
  (`/provider/service-area`) see: *"In Canada, the first three characters of
  a postal code identify a local area, for example M5V."* No jargon like
  "FSA" without explanation.
- **Calm, non-leaking outcomes.** Each eligibility state renders approved
  copy with a next step: eligible → proceed; ineligible → check the postal
  code or try another provider; needs_review → contact the provider before
  booking; invalid → correct the input; unavailable → online booking is not
  currently available. Never internal logic, raw coverage lists, or
  technical errors.
- **Buffer transparency, not configuration noise.** Providers see the active
  travel/setup buffer (30 minutes centrally managed) as read-only context in
  their settings; clients simply see realistic availability. The 409 copy on
  a buffer conflict asks for another time — it never blames or explains
  internals.
- **The server decides.** UI eligibility results are presentation only;
  every booking/reschedule write revalidates server-side.

## Cancellation/no-show UX (roadmap #13 — added 2026-08-26)

- **Policy upfront:** the public booking page (`/book/:slug`) and the client
  booking detail show the plain-language policy (`CancellationPolicyNotice`,
  server-provided copy) before any destructive action. Never show internal
  state identifiers to users.
- **Honest confirm dialogs:** the cancel confirmation (web dialog + mobile
  alert) includes the server-computed consequence from
  `GET /bookings/:id/cancellation-preview` ("free until…" vs "recorded as
  late — no fee is charged"). The UI mirrors, never computes, policy.
- **Provider guardrails:** provider cancels require a structured reason
  category; the portal decline flows send `declined_request` /
  `reschedule_declined`. No-show marking uses an in-app dialog (never the
  native browser confirm) that explains the client-visible consequence; the
  button appears only after the scheduled time (server remains authoritative).
- **Escalation:** terminal bookings (cancelled/no_show/completed) show
  "Ask for help with this booking" (web `booking-escalate-button`, mobile
  `booking-escalate-button`) — duplicate-tap safe (idempotent server + local
  disabled state). Calm success copy; no dispute jargon.
- **Accessibility:** the policy notice is a labelled `role="note"`; dialogs
  reuse the existing AlertDialog semantics; all new states are text-based
  (never color-only) and axe-tested at the jsdom level.

## Provider dashboard tone (2026-08-27)

- **Conversion-first, never corporate:** the dashboard greets by first name,
  celebrates wins ("clients can count on you!") and nudges gently on amber/red
  metrics ("a reminder text 24 hours before cuts no-shows"). No shame, no
  judgment, no admin jargon (providers never see pilot activation language).
- **Honest numbers only:** metrics show an explicit empty state until a
  booking is resolved — never a fake 0%/100%. The earnings card is labelled
  "Coming soon"; the estimate is explained ("completed visits × your service
  prices") and states that the pilot keeps 100% with direct collection.
- **Status = color + text everywhere:** metric chips ("On track" / "Worth a
  look" / "Needs attention" / "Growing"), booking status chips ("Confirmed" /
  "Awaiting your reply" / "Rescheduled"), and the source chart's plain-text
  labels/counts (bars are decorative, `aria-hidden`).
- **Privacy by default:** client names are trimmed to first name + last
  initial and locations to FSA/city on the dashboard — full addresses live
  only on the booking detail surfaces where they are needed.
- **No fake controls:** date-specific "emergency slots"/"block off dates"
  need an availability-exceptions model that does not exist yet, so the quick
  actions link to real, working surfaces instead (availability, share link,
  bookings).

## Provider verification submission (onboarding recovery, 2026-08-28)

- **Purpose copy is honest and specific:** "Submit the reference details for
  one credential so we can review your provider application." A credential
  reference is not a document upload — the security explainer stays visible.
- **Success copy never overpromises:** "Document submitted. Your application
  is still under review. We'll let you know if anything else is needed."
  Submitting a document never tells a provider they are approved or bookable.
- **Recoverable server failure (5xx/network):** "We couldn't submit this
  document right now. Your information has not been lost. Please try again or
  contact support." — with the server-resolved support contact link. The raw
  "Internal server error" string is never rendered. Entered values stay in
  the form.
- **Field-specific validation:** "Choose a document type." / "Enter a
  document reference." / "Keep the reference within the allowed length
  (200 characters max)." — mirrored client-side for immediate feedback,
  enforced server-side as the source of truth.
- **Submission mechanics:** loading label + disabled button while pending,
  double-tap guard, `role="alert"` error container that receives focus,
  `role="status"` success confirmation, mobile-width layout, axe-clean.

## Pilot operations metrics (Part 1 note, 2026-08-28)

Any surface that renders pilot metrics must show honest empty copy for
undefined rates ("No completed appointments yet") — never a mathematically
misleading `0%` — and must present thresholds as nonjudgmental operating
aids, never provider rankings or public scores. The `/admin/pilot` UI
conventions land with Part 2.

## Pilot operations dashboard (`/admin/pilot`, Part 2 — 2026-08-28)

- **Name the role.** The page header says "Platform administrator · Internal
  pilot dashboard — never shown to providers or clients". Never label an
  internal surface just "admin": platform admin ≠ (future, unimplemented)
  organization admin.
- **Honest numbers.** Undefined rates render honest empty copy ("No
  completed appointments yet", "No booking outcomes yet") — never `0%`.
  Thresholds (80/85/20/10/3) appear as quiet text aids ("At target",
  "Within guardrail"), never as rankings, and never as color alone.
- **Non-punitive language.** Risk flags render as friendly follow-up labels
  ("Setup incomplete", "Ready but not shared", "Check in with provider") —
  prompts to help, not leaderboards or shame.
- **Calm failure states.** 401 → sign-in prompt; 403 → "restricted to
  platform administrators"; other errors → "Nothing is lost — please try
  again" with a retry button. No metric data flashes before authorization
  resolves.
- **Mobile strategy.** Summary cards collapse 2 → 3 → 5 columns; the
  provider table scrolls horizontally inside its rounded container
  (min-width table, `overflow-x-auto`) so columns stay readable at 390px.
- **Charts.** Dependency-free CSS bars only; values always as text; bars
  `aria-hidden`. Review prompts use cautious "review / check / assess"
  wording and state they are not automated diagnosis.

## Provider Approval Status & Activation Hub (2026-08-28)

- **Guided, not bureaucratic.** One hero (status pill + one-sentence
  explanation + truthful progress + single "Next step" card), completed
  milestones grouped into one compact positive strip, remaining steps as
  action rows with "why this matters" microcopy and direct deep links to the
  existing destinations. Never more than the real remaining steps; no fake
  progress; approval-gated steps show "Available after approval" instead of
  links that would land on a 403.
- **Truthful conversion copy.** Status labels are plain-language
  ("Finish setting up", "Under review", "Update needed", "Account needs
  attention"); celebratory copy ("Your booking page is live", "You're up and
  running") appears only when the server proves the state. The value section
  lists implemented behavior only — no reminder, payment, demand, or revenue
  claims anywhere on the page (guarded by tests).
- **Recovery-first error states.** Rejected applications show only the
  provider-visible reason with a support fallback sentence; verification
  `needs_update` pairs friendly copy with the existing resubmission route;
  suspended states route to support. Loading/error/404/403 states are
  explicit; errors are generic.
- **Accessibility.** Single `main` + labelled sections + one h1; status via
  text pills (never color alone); progress bar with accessible label;
  `role="alert"` errors; sr-only step-state suffixes; axe-clean on approved
  and rejected states; verified at 390×844 with zero horizontal overflow and
  keyboard-reachable actions.
- **Reuse over duplication.** The publish/share/QR surface is the existing
  `BookingPageCard`; history is the existing submission timeline; support is
  the existing `SupportContactLink`. The hub adds copy and composition, not
  new business UI.
