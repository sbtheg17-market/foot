# OnCall Foot — Design Guidelines

One shared brand system, three role-specific expressions. This document is the visual and interaction contract for **all three portals**. Provider is the only portal implemented today; client and admin styles below are the target when those portals ship.

---

## 1. Brand Position

Calm, clinical, premium, trustworthy, operationally useful. Feels like a funded startup but is easy enough for real field use between home visits.

Tone reference: Calm.com × Square Appointments × a clinical wellness brand.

Anti-patterns (do **not** ship):
- SaaS purple/violet gradients on white
- Generic centered layouts, uniform card grids
- Consumer emoji as icons
- Universal `transition: all` (breaks transforms)
- Text-align center on data-heavy pages
- Cramped desktop-style dialogs on 390px mobile

---

## 2. Shared Foundations (all portals)

### Palette — "Organic & Earthy" sage
Light theme only for now. HSL tokens live in `frontend/src/index.css`.

```
--background     60 20% 98%     off-white cream
--foreground     150 15% 15%    tinted charcoal (never pure black)
--primary        140 25% 45%    sage green (primary actions, highlights)
--secondary      140 10% 90%    pale sage (subtle surfaces, chips)
--muted          140 10% 94%
--accent         140 15% 85%
--destructive    0 84% 60%
--radius         1rem (16px)
```

Contrast: WCAG AA — 4.5:1 small text, 3:1 large.
Depth: solid dark colors, never dark gradients. Use glass (`bg-white/80 backdrop-blur-xl`) for floating surfaces.

### Typography
- **Headings:** Manrope, tracking-tight, weights 500/600/700
- **Body:** DM Sans, `text-base leading-relaxed`
- **Label:** `text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground`
- H1: `text-3xl sm:text-4xl font-bold`
- H2: `text-2xl sm:text-3xl font-semibold`

### Elements
- **Buttons:** pill (`rounded-full`) or `rounded-xl`, min `h-12`, `active:scale-95 transition-transform duration-200`
- **Cards:** `rounded-2xl bg-card border border-black/5`, no shadow default, hover `-translate-y-0.5 shadow-md`
- **Chips:** `rounded-full px-3 py-1 text-xs font-semibold`; status color: green=confirmed/active, amber=pending, red=cancelled, blue=completed
- **Inputs:** Shadcn, `h-12 rounded-xl`
- **Sticky headers:** `bg-white/80 backdrop-blur-md border-b border-black/5 z-40`
- **Bottom nav (mobile):** glass, fixed, `h-16 z-50`, 44px+ tap targets
- **Bottom sheets:** Shadcn `<Sheet side="bottom">`, `h-[92vh] rounded-t-3xl` — preferred over centered dialogs at 390px
- **Icons:** `lucide-react` only. Never emoji.

### Motion
- Never `transition: all`. Specify properties.
- Micro-interaction on every touchable: `active:scale-95`, hover translate/shadow.
- Lists: staggered entrance (Framer Motion available).

### Accessibility
- Every interactive and key informational element ships a `data-testid`.
- Minimum tap target 44×44px.

---

## 3. Provider Portal (active implementation)

**Feeling:** a calm mobile operating system.
**Mode:** operational, data-dense, scannable, one-thumb usable between appointments.

- Base viewport 390px. Container `max-w-md` (mobile), `md:max-w-2xl` (tablet).
- Bottom nav: Home · Bookings · Services · Earnings · Profile.
- Left-aligned data pages (never centered) — scannability wins.
- Status chips on every booking/service card.
- Empty states explain value, not "no data". Always include a next-action CTA.
- Progressive disclosure on Home: greeting → hero → 2-column stat cards → quick access list.

Applied today in: Home, Services list, Service form sheet, Profile, Onboarding wizard, BottomNav.

---

## 4. Client Portal (target, not yet built)

**Feeling:** simple, reassuring, caregiver-friendly, trust-first.
**Mode:** low friction, step-by-step, discovery + booking.

Design deltas from provider portal:
- Larger hero imagery on discovery / provider profile
- Prominent trust signals: **Verified provider** badges, rating breakdown, "Verified from OnCall Foot booking" review labels
- Clear service cards with duration + price, response-time cue
- Caregiver-friendly: "Booking for someone else" toggle, household/dependent switcher
- Reassuring booking confirmation state — full-screen success with next-step summary
- "What to expect" content block on provider profile

Uses the same tokens, buttons, chips and glass surfaces as the provider portal so the marketplace feels like one product.

---

## 5. Admin Portal (target, not yet built)

**Feeling:** operational oversight, aligned brand but denser and less consumer-soft.
**Mode:** control surfaces, tables, moderation, KPI cards.

Design deltas:
- Desktop-friendly widths (`max-w-6xl` regions); tables where cards were
- Higher information density in cards and filters
- Muted foreground weight on non-critical text
- Status chips reused verbatim so status vocab is identical everywhere
- Neutral admin surfaces — no marketing color hits; still sage-primary for primary actions
- No emoji, no confetti; the tone is stewardship

---

## 6. Component Sources

- **Primary components:** `frontend/src/components/ui/` (Shadcn). Import from there.
- **Feedback:** `sonner` toasts. `AlertDialog` for destructive confirms.
- **Sheets/Drawers:** `Sheet side="bottom"` on mobile forms with 3+ fields.
- **Icons:** `lucide-react`.

Reuse existing components before creating new ones. Match conventions.

---

## 7. Current Truth

**What exists in the app:**
- Full provider design system, applied end-to-end on auth, onboarding, home, services, profile
- Sage green tokens active in `index.css` + `tailwind.config.js`
- Glass bottom nav, sticky glass headers, mobile-first shell

**Scaffolded only:**
- Status chip vocabulary (used only on active pages so far)
- Route groups for `/client/*` and `/admin/*`

**Roadmap only, no code:**
- Client portal visuals (§4)
- Admin portal visuals (§5)
- Any monetization UI

---

## 8. Handoff Rules for Future Agents

- **Do not** polish client or admin screens until the provider portal is functionally complete (checkpoints 3–6).
- **Do not** invent new color tokens; extend within the sage palette.
- **Do not** switch to a component library other than Shadcn.
- **Do not** center-align content on data pages.
- **Do** add `data-testid` to every interactive/informational element.
- **Do** keep 44px tap targets and 2–3× the spacing that feels comfortable.
- **Do** reuse the status chip color mapping across bookings, invoices, verification, subscriptions.
