# Roles & Permissions

OnCall Foot currently has three user roles. During the staged migration, role
membership is being introduced in `account_roles`, while `users.role` remains
the compatibility field. No authorization behavior changes in the additive
schema phase.

---

## Role Definitions

### `client`
A person who books in-home foot care visits.

### `provider`
A foot care professional who offers mobile services.

### `admin`
Platform operator with full oversight.

---

## Permission Matrix

| Resource | client | provider | admin |
|----------|--------|----------|-------|
| Own profile (read/write) | ✅ | ✅ | ✅ |
| Provider marketplace (browse) | ✅ | ✅ | ✅ |
| Provider profile (read) | ✅ | ✅ | ✅ |
| Provider profile (write own) | ❌ | ✅ | ✅ |
| Services (read) | ✅ | ✅ | ✅ |
| Services (write own) | ❌ | ✅ | ✅ |
| Create booking | ✅ | ❌ | ✅ |
| View own bookings | ✅ | ✅ (as provider) | ✅ |
| Accept / manage booking (own) | ❌ | ✅ | ✅ |
| Cancel booking | ✅ (own) | ✅ (own) | ✅ |
| Leave review (after completed visit) | ✅ | ❌ | ✅ |
| View invoices (own) | ✅ | ✅ | ✅ |
| Submit support ticket | ✅ | ✅ | ✅ |
| Respond to support ticket | ❌ | ❌ | ✅ |
| Admin: view all users | ❌ | ❌ | ✅ |
| Admin: manage verification | ❌ | ❌ | ✅ |
| Admin: view all bookings | ❌ | ❌ | ✅ |
| Admin: platform metrics | ❌ | ❌ | ✅ |
| Admin: moderate reviews | ❌ | ❌ | ✅ |

---

## Route Protection Rules

- `requireAuth` — any authenticated user
- `requireRole('client')` — clients only
- `requireRole('provider')` — providers only
- `requireRole('admin')` — admin only
- `requireSelf` — user can only access/modify their own resources
- Provider endpoints on `/api/providers/me/*` always scope to `req.user.id`
- Admin endpoints on `/api/admin/*` always require `requireRole('admin')`

Future provider authorization must require both provider membership and an
approved provider application. Provider signup intent and draft onboarding must
never grant provider operational access. This rule is documented for the
authorization-hardening phase and is not yet a runtime change.

---

## Post-Registration Flow

After registration, users are redirected based on role:
- `client` → `/dashboard` (client portal)
- `provider` → `/provider/dashboard` (provider portal, complete profile prompt)
- `admin` → `/admin/dashboard`
