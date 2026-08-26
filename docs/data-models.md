# Data Models

All models use Drizzle ORM with PostgreSQL. Schema files are in `lib/db/src/schema/`.

---

## users

Core user account. All roles share this table.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| email | text unique | |
| password_hash | text | bcrypt |
| role | enum | client \| provider \| admin |
| first_name | text | |
| last_name | text | |
| phone | text nullable | |
| avatar_url | text nullable | |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

## account_roles

Transitional multi-role membership table. This is the planned long-term source
for role membership; `users.role` remains during the compatibility period.
Membership does not grant provider operations by itself.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | FK → users | cascade delete |
| role | enum | client \| provider \| admin |
| created_at | timestamp | |
| updated_at | timestamp | |

The `(user_id, role)` pair is unique. Existing users are not automatically
given secondary roles.

---

## provider_applications

Provider onboarding and review state, separate from provider business data and
authorization. Provider operations will later require an approved application.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | FK → users | unique, cascade delete |
| provider_profile_id | FK → provider_profiles | unique, cascade delete |
| status | enum | draft \| under_review \| approved \| rejected \| suspended |
| current_step | enum | profile \| services \| availability \| verification \| submitted |
| submitted_at | timestamp nullable | |
| reviewed_at | timestamp nullable | |
| reviewed_by | FK → users nullable | set null on reviewer deletion |
| reviewer_notes | text nullable | admin review notes |
| created_at | timestamp | |
| updated_at | timestamp | |

The current migration phase adds these tables only. Existing
`provider_profiles.verification_status` and all authorization behavior remain
unchanged until a separately tested compatibility phase.

### Client-safe care history

`GET /bookings/history` is a bounded, client-only projection of terminal
bookings (`completed`, `no_show`, and `cancelled`). It derives ownership from
the authenticated user and includes only client-visible booking fields plus
provider identity and service summaries. It never serializes `care_notes`.
History is ordered by most recently updated booking so a newly completed visit
appears promptly; `limit` is capped at 50 and `offset` supports continuation.

---

## provider_profiles

One-to-one with users where role = 'provider'.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | FK → users | unique |
| title | text | e.g. "Certified Foot Care Nurse" |
| bio | text nullable | |
| city | text | |
| service_area_notes | text nullable | free-text description |
| verification_status | enum | pending \| under_review \| approved \| rejected |
| rating | numeric(3,2) | 0.00–5.00, updated on review |
| review_count | integer | |
| profile_complete | boolean | |
| years_experience | integer nullable | |
| accepts_new_clients | boolean | default true |
| public_slug | text nullable | canonical public booking-page slug (`/book/:slug`); lowercase kebab-case 3–64, globally unique (`provider_profiles_public_slug_unique_idx`); assigned at first publish, not provider-editable afterwards |
| booking_page_published | boolean | default false — providers stay unpublished until they intentionally publish |
| booking_page_published_at | timestamp nullable | last transition to published |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## services

Services offered by a provider. Many-to-one with provider_profiles.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | |
| title | text | |
| description | text nullable | |
| duration_minutes | integer | |
| price_cents | integer | stored in cents (CAD) |
| category | text | e.g. "foot_care", "pedicure", "wellness" |
| eligibility_notes | text nullable | e.g. "suitable for diabetic clients" |
| is_active | boolean | default true |
| created_at | timestamp | |

---

## bookings

A scheduled visit.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| client_id | FK → users | |
| provider_id | FK → provider_profiles | |
| service_id | FK → services | |
| status | enum | requested \| confirmed \| completed \| cancelled \| rescheduled \| no_show |
| scheduled_at | timestamp | |
| address | text | |
| city | text | |
| postal_code | text nullable | |
| care_notes | text nullable | accessibility or health notes |
| client_notes | text nullable | general visit notes from client |
| source | text nullable | privacy-safe allowlisted link attribution (`instagram` \| `qr-card` \| `text` \| `facebook` \| `website`) recorded at creation; unknown values are dropped at the API boundary; never used for authorization and never exposed publicly |
| cancelled_by | FK → users nullable | who cancelled |
| cancellation_reason | text nullable | |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## reviews

One review per completed booking, by the client. The unique `booking_id` constraint
is the database-level duplicate guard. Review reads are scoped to the authenticated
client when accessed by booking, and never include the booking's private
`care_notes`.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| booking_id | FK → bookings unique | one review per booking |
| client_id | FK → users | |
| provider_id | FK → provider_profiles | |
| rating | integer | 1–5 |
| comment | text nullable | |
| is_visible | boolean | default true (admin can hide) |
| created_at | timestamp | |

---

## invoices

Payment record per booking.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| booking_id | FK → bookings unique | |
| client_id | FK → users | |
| provider_id | FK → provider_profiles | |
| amount_cents | integer | |
| status | enum | pending \| paid \| cancelled |
| paid_at | timestamp nullable | |
| stripe_payment_intent_id | text nullable | future Stripe |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## support_tickets

Internal support requests from any user.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| user_id | FK → users | |
| subject | text | |
| status | enum | open \| in_progress \| resolved |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## support_messages

Messages within a ticket thread.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| ticket_id | FK → support_tickets | |
| user_id | FK → users | sender |
| message | text | |
| created_at | timestamp | |

---

## availability

Weekly recurring availability for a provider.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | |
| day_of_week | integer | 0 = Sunday … 6 = Saturday |
| start_time | text | "HH:MM" (24h) |
| end_time | text | "HH:MM" (24h) |

---

## travel_zones

Areas a provider is willing to travel to. (Descriptive/legacy — the
authoritative coverage rule since roadmap #12 is `provider_service_areas` +
`provider_coverage_areas` below.)

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | |
| zone_name | text | label, e.g. "Downtown Toronto" |
| city | text | |
| notes | text nullable | travel conditions or fees |

---

## provider_service_areas (roadmap #12)

One service-area configuration per provider. Canada-first: only `CA` is
accepted by the API in this release (column is country-aware for future
expansion). Providers without a row are safely unconfigured — public
eligibility reports `unavailable` and booking-page publishing is blocked
until at least one covered postal area exists. Frozen additive artifact:
`docs/migrations/PROVIDER_SERVICE_AREAS_V1.sql`. NO coordinates, geocoding,
routing, radius, or polygon data is stored.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | unique, cascade delete |
| country_code | text | default `'CA'`; ISO 3166-1 alpha-2 |
| province_code | text | canonical Canadian province/territory code, e.g. `ON`; validated at the API boundary |
| city | text nullable | optional public city context |
| public_description | text nullable | provider-written plain-language public summary; NEVER the authoritative eligibility rule |
| is_active | boolean | default true |
| created_at | timestamp | |
| updated_at | timestamp | |

## provider_coverage_areas (roadmap #12)

One row per covered Canadian postal prefix (FSA — the first three postal-code
characters, e.g. `M5V`). Prefixes are normalized (uppercase, no whitespace)
before insert. Removal deactivates the row (`is_active = false`) so safe
audit metadata is retained; the partial unique index
(`provider_coverage_areas_active_prefix_unique_idx`) keeps ACTIVE coverage
unique per provider while allowing a removed prefix to be re-added. The raw
prefix list is owner-visible only — never exposed publicly.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | cascade delete |
| country_code | text | default `'CA'` |
| prefix | text | normalized FSA |
| is_active | boolean | default true |
| created_at | timestamp | |

The travel/setup buffer is centrally managed in application configuration
(default 30 minutes; environment override `TRAVEL_SETUP_BUFFER_MINUTES`,
validated 0–240) — no schema exists for it in this release by design.

---

## verification_docs

Document metadata for provider verification (file content stored externally).

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | |
| doc_type | text | e.g. "license", "insurance", "certification" |
| file_name | text | |
| submitted_at | timestamp | |
| reviewed_at | timestamp nullable | |
| status | enum | pending \| approved \| rejected |
| reviewer_notes | text nullable | |
