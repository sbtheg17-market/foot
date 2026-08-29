# Provider Data Export — User-Facing Specification

**Added:** 2026-08-29. Companion to
`docs/provider-export-and-recovery-backup-architecture.md` (§3) and
`docs/provider-export-implementation-plan.md`. This is the approved wording
and behavior for the future provider-facing export feature. No infrastructure
terminology (database, SQL, hosting, vendor names, migrations, connection
details) may ever appear on provider-facing surfaces.

---

## Where it lives

```text
Dashboard → Settings → Data and privacy → Export my business data
```

## Screen copy — entry state

> **Export my business data**
>
> Download a copy of your business information — your profile, services,
> availability, schedule exceptions, travel zones, bookings, and the client
> details you already see in your bookings.
>
> Your export is a snapshot of your data at the moment it's prepared. It does
> not update automatically.
>
> [ Prepare export ]

Scope explanation (expandable "What's included?"):

**What is included**

- Your business profile details
- Your services and prices
- Your weekly availability
- Your emergency openings and time-off ranges (including your private notes)
- Your travel zones and service territory
- Your bookings and their status history
- Client details you already see in your bookings

**What is not included**

- Other providers' information
- Platform review and verification records
- Passwords or sign-in details (yours or anyone's)
- Payment card or banking credentials
- Platform system or security records

## Screen copy — preparing state

> **Preparing your export…**
>
> This can take a few minutes. You can leave this page — we'll show the
> download here when it's ready.

## Screen copy — ready state

> **Your export is ready**
>
> [ Download securely ]
>
> **This download expires** on {expiry date/time shown in the provider's
> timezone}. After that, you can prepare a new export at any time.
>
> **Store client information securely.** Your export may contain client names
> and booking details. Keep the file in a safe place, don't share it, and
> delete copies you no longer need.

## Screen copy — export history

> **Previous exports**
>
> {date requested} · {status: Ready / Expired / Cancelled / Failed} ·
> {expires/expired date}

History shows dates and statuses only — never file contents. Providers may
cancel an export that hasn't expired yet:

> [ Cancel this export ] — "This removes the download. You can prepare a new
> export at any time."

## Error-state copy

- Preparation failed:
  > **We couldn't prepare your export.** Nothing was downloaded or shared.
  > Please try again. If this keeps happening, contact support and mention
  > "data export."
- Link expired:
  > **This download has expired.** For your security, download links only work
  > for a limited time. Prepare a new export to get a fresh copy.
- Too many requests:
  > **You have an export in progress.** Please wait for it to finish before
  > starting another.

## Support/escalation language

> Need help with your export, or have a question about what's included?
> Contact support from your dashboard and mention "data export." We'll never
> ask you for your password.

## Accessibility

- All states (entry, preparing, ready, expired, error) must be announced to
  screen readers via status regions.
- The download control is a real button/link with a descriptive accessible
  name ("Download my business data export").
- Expiry dates are written out in full text, not conveyed by color alone.
- All interactive elements are keyboard-reachable with visible focus.

## Approved vocabulary

Use:

```text
Export my business data
Prepare export
Your export is ready
Download securely
This download expires
Store client information securely
```

Never show providers:

```text
pg_dump
Supabase
Railway
GitHub
SQL
connection string
service-role key
database migration
Codespaces
```

## Honesty rules

- An export is described as a **snapshot**, never a live sync or backup
  service.
- No lead, booking, approval, ranking, or feature guarantees anywhere in this
  flow.
- The privacy warning about client information is always shown with the
  download — it is not dismissible copy hidden behind a tooltip.
