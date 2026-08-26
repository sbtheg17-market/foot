# Native-device hardware test script — run on real phones before pilot day 1

**Status: NOT YET PERFORMED** (hardware-DEFERRED). Run on one iPhone (iOS 16+)
and one Android (12+). Record device model, OS version, app/web SHA, date, and
tester for every row. Append results to
`docs/pilot/native-device-validation-report.md` — do not overwrite history.

Target: the deployed pilot URL (or LAN address of a staging build). All flows
are mobile-browser flows unless marked (Expo).

## Provider flow (do on both phones)

| # | Step | Expected | iPhone | Android |
|---|---|---|---|---|
| P1 | Sign in at `/login` as a pilot provider | Lands on provider dashboard | ☐ | ☐ |
| P2 | Provider → Service area: add FSA prefixes (e.g. L2R, L6H, M5V) for ON | Prefixes saved and listed | ☐ | ☐ |
| P3 | Services: confirm the 5 pilot services exist with correct price/duration | List matches pilot menu | ☐ | ☐ |
| P4 | Availability: apply the 9–5 weekdays preset, then edit one day | Saves; edits persist after reload | ☐ | ☐ |
| P5 | Dashboard: publish the booking page | Publish succeeds; share card appears | ☐ | ☐ |
| P6 | Copy the share link; open the QR code | Link on clipboard; QR renders and scans | ☐ | ☐ |
| P7 | Bookings: see the incoming test booking (from C-steps below) | Booking visible with client info | ☐ | ☐ |
| P8 | Accept the booking | Status → confirmed; client notified | ☐ | ☐ |
| P9 | Propose a reschedule (pick a real slot + reason) | Proposal pending; client's time unchanged | ☐ | ☐ |
| P10 | After the visit time passes: mark a confirmed booking no-show | Dialog explains consequence; status → no-show | ☐ | ☐ |
| P11 | Cancel a requested booking (structured reason) | Cancels with reason category | ☐ | ☐ |

## Client flow (do on both phones)

| # | Step | Expected | iPhone | Android |
|---|---|---|---|---|
| C1 | Open the booking link **from a text message** (deep link) | `/book/:slug` renders | ☐ | ☐ |
| C2 | Enter an out-of-area FSA (e.g. K1A 0A6) | Clear "does not serve this area" message; no services shown | ☐ | ☐ |
| C3 | Enter a valid corridor FSA (e.g. L2R 3M4) | Eligible; services appear | ☐ | ☐ |
| C4 | Select a service, pick a real slot, enter address/contact, sign in, confirm | Booking created; confirmation visible under My bookings | ☐ | ☐ |
| C5 | Accept or decline the provider's reschedule proposal | Chosen outcome reflected; times correct | ☐ | ☐ |
| C6 | Cancel a booking | Policy dialog shows free/late honestly; cancellation recorded | ☐ | ☐ |
| C7 | Open a finished booking → "Ask for help with this booking" | Escalation confirmation appears | ☐ | ☐ |
| C8 | Tap the support link in the page footer | Mail app / form opens with the pilot support address | ☐ | ☐ |

## Edge cases

| # | Step | Expected | iPhone | Android |
|---|---|---|---|---|
| E1 | Enable OS 3G/LTE throttling (or Settings → developer network shaping); reload the booking page | Usable within a few seconds; no broken layout | ☐ | ☐ |
| E2 | Set the phone timezone to PST; view slots and booking times | Times still shown in America/Toronto with the timezone label | ☐ | ☐ |
| E3 | Kill the browser/app completely, reopen the deep link (cold start) | Page/app restores; signed-in state per platform norms | ☐ | ☐ |
| E4 | (Expo app) Fresh install: notification permission prompt | Prompt appears once; choice respected | ☐ | ☐ |
| E5 | (Expo app) Receive a booking push with the app closed | Push arrives; tapping opens the booking | ☐ | ☐ |
| E6 | Rotate device / split-screen on Android | Layout remains usable | ☐ | ☐ |

## Sign-off

| Field | Value |
|---|---|
| iPhone model / iOS | |
| Android model / version | |
| Web/app SHA | |
| Date / tester | |
| Verdict | PASS / FAIL (list failing rows) |
