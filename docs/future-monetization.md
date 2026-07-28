# Future Monetization

The schema and architecture are designed to support these monetization models without major refactoring.

---

## Commission on Bookings

- Add `commission_rate` and `commission_cents` columns to `invoices`
- Platform fee deducted from provider payout
- Stripe Connect splits payment at checkout

**Schema hooks:** `invoices.stripe_payment_intent_id`, `invoices.amount_cents`

---

## Provider Subscriptions (SaaS tier)

- `provider_subscriptions` table: `provider_id`, `plan` (free | starter | pro), `stripe_subscription_id`, `current_period_end`
- Feature gates: calendar sync, analytics, featured placement
- Free tier: limited active services or booking slots

**Schema hooks:** `provider_profiles.profile_complete`, extend with `plan` reference

---

## Featured Listings

- `provider_profiles.is_featured` boolean column (add when ready)
- Featured providers rank higher in search results
- Sold as a monthly add-on or included in Pro plan

---

## Recurring Care Plans

- `care_plans` table: `client_id`, `provider_id`, `frequency` (weekly | biweekly | monthly), `service_id`, `status`
- Auto-generate bookings on a schedule
- Clients pay plan rate, provider gets stable recurring income

**Schema hooks:** `bookings` table already supports all needed fields

---

## Add-On Upsells

- `service_addons` table: `service_id`, `title`, `price_cents`, `duration_minutes`
- Client selects add-ons during booking flow
- `booking_addons` join table for per-booking selections

---

## Household / Membership Plans

- `memberships` table: `client_id`, `plan`, `stripe_subscription_id`
- Discounted booking rates, priority scheduling, invoice history

---

## Stripe Integration Path

When ready to add payments:
1. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env`
2. Use Stripe Connect for provider payouts
3. `invoices.stripe_payment_intent_id` already in schema
4. Webhook endpoint: `POST /api/webhooks/stripe`
