# Booking Statuses

All bookings move through a defined status lifecycle.

---

## Status Values

| Status | Description |
|--------|-------------|
| `requested` | Client submitted a booking request. Awaiting provider action. |
| `confirmed` | Provider accepted the booking. Visit is scheduled. |
| `completed` | Visit took place. Provider or system marked it done. |
| `cancelled` | Cancelled by client or provider before the visit. |
| `rescheduled` | Either party requested a new time. Booking remains active at new time. |
| `no_show` | Provider arrived; client was unavailable. |

---

## Allowed Transitions

```
requested  →  confirmed   (provider accepts)
requested  →  cancelled   (client or provider cancels)
confirmed  →  completed   (provider marks done)
confirmed  →  cancelled   (client or provider cancels)
confirmed  →  rescheduled (either party reschedules)
confirmed  →  no_show     (provider marks no-show)
rescheduled → confirmed   (provider reconfirms new time)
rescheduled → cancelled   (either party cancels)
```

Completed and cancelled bookings are terminal — no further transitions.

---

## Who Can Change Status

| Transition | Who |
|------------|-----|
| `requested → confirmed` | Provider |
| `requested → cancelled` | Client or Provider |
| `confirmed → completed` | Provider |
| `confirmed → cancelled` | Client or Provider |
| `confirmed → rescheduled` | Client or Provider |
| `confirmed → no_show` | Provider |
| `rescheduled → confirmed` | Provider |
| `rescheduled → cancelled` | Client or Provider |

Admin can force any transition.

---

## Review Eligibility

Reviews can only be submitted by the client when booking status is `completed`.
One review per booking.

---

## Invoice Trigger

An invoice record is created automatically when a booking reaches `confirmed` status.
Invoice status starts as `pending`, becomes `paid` after payment confirmation (future Stripe integration).
