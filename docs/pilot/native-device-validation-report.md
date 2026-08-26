# Native-device validation report — pilot readiness

**Date:** 2026-08-26 · **Verdict: emulation-PASS / hardware-DEFERRED**

Per the operator decision (2026-08-26): automated Playwright device-profile
emulation now, plus a step-by-step manual script for real hardware
(`docs/pilot/native-device-hardware-test-script.md`). Emulation covers
viewport, touch input, mobile user agent, device pixel ratio, engine
differences (WebKit vs Chromium), device-timezone independence, deep links,
and 3G throttling. It does **not** cover cold start, OS permission prompts,
push notifications, or OS-level deep-link routing — those stay on the manual
hardware script and this report must not be read as physical verification.

## How to run

```bash
pnpm run smoke:mobile-emulation    # scripts/src/pilot/native-device-emulation.ts
```

Same prerequisites as the real-browser smoke test (seeded scratch DB, built
bundle on :8080, Playwright chromium+webkit installed).

## Devices tested (EMULATED profiles — Playwright 1.62.1)

| Profile | Engine | Viewport | Extras |
|---|---|---|---|
| iPhone 13 | WebKit **26.5** (iOS Safari engine) | 390×844, touch, iOS UA | device timezone forced to PST |
| Pixel 5 | Chromium **151.0.7922.34** | 393×851, touch, Android UA | PST timezone + CDP 3G throttle (400 ms RTT, ~1.6 Mbps down) |

## Flows tested + results — 2026-08-26 (9/9 PASS)

| Flow | iPhone 13 (WebKit) | Pixel 5 (Chromium) |
|---|---|---|
| Deep link `/book/:slug?source=text` renders (simulates opening from a text message) | PASS | PASS |
| PST device still sees marketplace (America/Toronto) times | PASS | PASS |
| Full touch booking flow (eligibility → service → slot → sign-in → confirm) with `source=text` recorded | PASS (booking created) | PASS (booking created) |
| Provider portal renders on the device viewport (bottom nav + support link) | PASS | PASS |
| Booking page interactive under 3G throttle | n/a (CDP is Chromium-only) | PASS — **1,671–1,684 ms** to interactive across runs |

## Issues found / resolved / deferred

- **Found + resolved (script fixture):** newest-booking lookup when a
  cancelled booking's slot is rebooked (same fix as the smoke script).
- **Product issues found: none** on either engine profile.
- **Deferred to hardware (operator):** cold start after app kill, notification
  permission prompts, Expo push delivery, OS share-sheet/deep-link routing,
  real-network behavior, iOS Safari toolbar viewport quirks under scroll.

## Provider/client flow coverage note

The provider flows the pilot depends on (service-area setup, service +
availability configuration, publish, share link, QR, accept, reschedule
proposal, no-show marking, cancellation) are covered end-to-end on desktop by
the real-browser smoke test; on the mobile profiles this report verifies
portal rendering and the full client booking flow. The manual hardware script
walks every provider flow step-by-step on real phones.

## Verdict

**Emulation: PASS (9/9). Hardware: DEFERRED — never performed** (consistent
with the standing `docs/native-device-checklist.md` entry). Run the hardware
script on one real iPhone (iOS 16+) and one real Android (12+) before pilot
day 1 and append the dated results here.
