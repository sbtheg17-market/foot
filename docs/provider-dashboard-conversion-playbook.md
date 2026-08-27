# Provider Dashboard — Conversion Playbook (Sales, Demo, Social)

**Created:** 2026-08-28. Documentation only. Every claim below maps to
implemented behavior on current main (`d273d5f`) — see
`provider-dashboard-capability-inventory.md`. Anything not yet built is
explicitly marked and must not be demoed as live.

## The provider value promise (canonical)

> Foot helps you present your services professionally, protect your schedule,
> share one reliable booking link, reduce coordination by text, and give
> clients a simpler way to book with confidence.

Truthful because: booking page + services + availability + service-area fit
checks + travel/setup buffers + reschedule/cancel flows + share tools are all
shipped.

## 60-second demo script (uses only implemented features)

> This is your business home in Foot.
> You can see today's appointments, keep your availability accurate,
> share one professional booking link, and let clients book without text
> back-and-forth.
> The same page helps you manage schedule changes and stay ready for your
> next appointment.

Demo walk (order matches the real dashboard):
1. Greeting + "You have 2 bookings today" + next appointment. *(implemented)*
2. Quick actions → availability page. *(implemented)*
3. Upcoming list, 7/30 toggle, privacy-trimmed names. *(implemented)*
4. Booking-link card: copy, native share, QR, preview; source chart.
   *(implemented)*
5. Personal metrics with honest empty states. *(implemented)*
6. Readiness card → Activation Hub. *(implemented)*
7. Support link. *(implemented)*

Never demo: block-off dates, emergency openings, reminders, payments,
offers, organization views — not implemented; say "on the roadmap, guided by
pilot evidence" if asked.

## Vertical-neutral local-market pitch (reusable)

> Give your clients a professional way to book with you.
> Share one link, show your real availability, and spend less time
> coordinating appointments by message.

## Foot-care-specific pitch (current pilot)

> Give your mobile foot-care clients an easy way to see your services,
> confirm you serve their area, and book an available time without
> back-and-forth texting.

## Social-media and local-marketing angles (truthful framing)

Core themes for every channel: one link · professional presence · fewer
messages · real availability · clear client experience · local trust ·
repeat booking.

| Channel | Truthful framing | How (all shipped tools) |
|---|---|---|
| Instagram | "Book me without the DM back-and-forth — link in bio." | Add booking URL to bio; copy button on the link card |
| Facebook | "New: book my visits online — real times, your area confirmed first." | Share link in a post/page button |
| TikTok | Profile/description link: "book a time that actually exists" | Paste link where appropriate |
| Google Business Profile | Booking URL as the profile link | Copy from link card |
| Text message | Post-visit: "Next time, grab a slot here — takes a minute." | Native share / copy |
| Email | Signature: "Book an appointment: [link]" | Copy |
| Printed cards / posters | QR code straight to the page (`source=qr-card` attribution) | QR on the link card |
| Website | Button/link to the booking page | Copy |

Attribution tip (implemented): bookings arriving via the QR card and other
allowlisted sources appear in the provider's own "Where your bookings come
from" chart — real feedback on which channel works.

## Claims discipline

Never claim: guaranteed leads · guaranteed sales · automatic marketplace
demand · automated reminders · payments · verified status before approval ·
a full workforce-management platform · discovery traffic. Canonical safe
line: **"Share your page anywhere clients already find you."**

Every rate shown to a provider is their own data with honest empty states —
never use metrics in sales material as a promise of outcomes.

## Who this playbook serves

1. Product approval — shows the conversion logic behind each surface.
2. Provider sales demos — the 60-second script + walk order.
3. Social marketing — channel framing above.
4. Pilot onboarding — pairs with `docs/pilot/weekly-pilot-review.md` outreach
   actions.
5. Implementation planning — anything marked not-implemented routes to the
   blueprint phases.
6. Future white-label/org expansion — see
   `provider-dashboard-future-boundaries.md`.
7. Duplicate-work prevention — the inventory is the single source of truth.
