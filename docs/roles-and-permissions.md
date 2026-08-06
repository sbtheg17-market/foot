# Roles & Permissions

OnCall Foot currently has three user roles. During the staged migration, role
membership in `account_roles` is now the authorization source, while
`users.role` remains the compatibility active-context field. JWT role claims
remain a compatibility session signal; route authorization confirms them
against the current database state.

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

- `requireAuth` — a valid JWT whose user still exists, is active, and whose
  compatibility role matches the database user context
- `requireRole('client')` — requires the active client context and a matching
  `account_roles` membership
- `requireRole('provider')` — requires the active provider context and a
  matching `account_roles` membership
- `requireRole('admin')` — requires the active admin context and a matching
  `account_roles` membership
- `requireSelf` — user can only access/modify their own resources
- Provider endpoints on `/api/providers/me/*` always scope to `req.user.id`
- Admin endpoints on `/api/admin/*` always require database-backed admin
  membership

Provider operational authorization requires provider membership, an application
owned by the same user and profile, an `approved` application status, and an
`approved` provider-profile verification status. Provider signup intent and
draft, under-review, rejected, or suspended onboarding must never grant
provider operational access.

Credential submission remains available to a provider member whose application
is not yet approved so onboarding can reach review. It does not grant access to
provider operations.

---

## Post-Registration Flow

After registration, users are redirected based on role:
- `client` → `/dashboard` (client portal)
- `provider` → `/provider/dashboard` (provider portal, complete profile prompt)
- `admin` → `/admin/dashboard`
