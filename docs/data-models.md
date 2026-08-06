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

Areas a provider is willing to travel to.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| provider_id | FK → provider_profiles | |
| zone_name | text | label, e.g. "Downtown Toronto" |
| city | text | |
| notes | text nullable | travel conditions or fees |

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
