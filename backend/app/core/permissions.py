"""Centralized RBAC.

Role-first surface, permission-first checks. Route handlers should
depend on `require_permission(Permission.X)` — never on raw role strings.
Ownership / resource-scoped checks (e.g. "provider owns this service")
live in service/repository layers, not here.

Only the `provider` role is exercised today. `client`, `admin` and future
roles are scaffolded so subsequent portals can be wired without rewrites.
"""
from enum import Enum
from typing import Iterable

from fastapi import Depends, HTTPException, status

from app.core.dependencies import get_current_user


# ---------- Roles ----------
class Role(str, Enum):
    PROVIDER = "provider"
    CLIENT = "client"
    ADMIN = "admin"
    # future-friendly
    SUPPORT_AGENT = "support_agent"
    COMPLIANCE_REVIEWER = "compliance_reviewer"
    FINANCE_ADMIN = "finance_admin"
    MARKETPLACE_MANAGER = "marketplace_manager"


# ---------- Permissions ----------
class Permission(str, Enum):
    # Provider (self)
    PROVIDER_READ_SELF = "provider:read:self"
    PROVIDER_UPDATE_SELF = "provider:update:self"
    PROVIDER_VERIFY_SELF = "provider:verify:self"
    PROVIDER_BILLING_SELF = "provider:billing:self"

    # Client (self)
    CLIENT_READ_SELF = "client:read:self"
    CLIENT_UPDATE_SELF = "client:update:self"
    CLIENT_BOOK_SELF = "client:book:self"
    CLIENT_REVIEW_CREATE_SELF = "client:review:create:self"

    # Bookings
    BOOKING_READ_SELF = "booking:read:self"
    BOOKING_CREATE_SELF = "booking:create:self"
    BOOKING_UPDATE_SELF = "booking:update:self"
    BOOKING_MANAGE_ASSIGNED = "booking:manage:assigned"
    BOOKING_READ_ANY = "booking:read:any"
    BOOKING_UPDATE_ANY = "booking:update:any"

    # Services (provider owns; admin can read/manage in future)
    SERVICE_READ_SELF = "service:read:self"
    SERVICE_CREATE_SELF = "service:create:self"
    SERVICE_UPDATE_SELF = "service:update:self"
    SERVICE_DELETE_SELF = "service:delete:self"
    SERVICE_READ_ANY = "service:read:any"

    # Reviews
    REVIEW_READ_SELF = "review:read:self"
    REVIEW_CREATE_SELF = "review:create:self"
    REVIEW_MODERATE_ANY = "review:moderate:any"

    # Invoices
    INVOICE_READ_SELF = "invoice:read:self"
    INVOICE_CREATE_SELF = "invoice:create:self"
    INVOICE_UPDATE_SELF = "invoice:update:self"
    INVOICE_READ_ANY = "invoice:read:any"

    # Marketplace / Admin
    PROVIDER_APPROVE_ANY = "provider:approve:any"
    PROVIDER_SUSPEND_ANY = "provider:suspend:any"
    CLIENT_READ_ANY = "client:read:any"
    CLIENT_UPDATE_ANY = "client:update:any"
    COMMISSION_READ_ANY = "commission:read:any"
    COMMISSION_MANAGE_ANY = "commission:manage:any"
    SUBSCRIPTION_READ_ANY = "subscription:read:any"
    SUBSCRIPTION_MANAGE_ANY = "subscription:manage:any"
    SUPPORT_READ_ANY = "support:read:any"
    SUPPORT_UPDATE_ANY = "support:update:any"
    ADMIN_DASHBOARD_READ = "admin:dashboard:read"


# ---------- Role -> Permissions map ----------
_PROVIDER_PERMS: set[Permission] = {
    Permission.PROVIDER_READ_SELF,
    Permission.PROVIDER_UPDATE_SELF,
    Permission.PROVIDER_VERIFY_SELF,
    Permission.PROVIDER_BILLING_SELF,
    Permission.SERVICE_READ_SELF,
    Permission.SERVICE_CREATE_SELF,
    Permission.SERVICE_UPDATE_SELF,
    Permission.SERVICE_DELETE_SELF,
    Permission.BOOKING_READ_SELF,
    Permission.BOOKING_UPDATE_SELF,
    Permission.BOOKING_MANAGE_ASSIGNED,
    Permission.INVOICE_READ_SELF,
    Permission.INVOICE_CREATE_SELF,
    Permission.INVOICE_UPDATE_SELF,
    Permission.REVIEW_READ_SELF,
}

_CLIENT_PERMS: set[Permission] = {
    Permission.CLIENT_READ_SELF,
    Permission.CLIENT_UPDATE_SELF,
    Permission.CLIENT_BOOK_SELF,
    Permission.CLIENT_REVIEW_CREATE_SELF,
    Permission.BOOKING_READ_SELF,
    Permission.BOOKING_CREATE_SELF,
    Permission.INVOICE_READ_SELF,
    Permission.REVIEW_CREATE_SELF,
    Permission.SERVICE_READ_ANY,
}

_ADMIN_PERMS: set[Permission] = {
    Permission.ADMIN_DASHBOARD_READ,
    Permission.PROVIDER_APPROVE_ANY,
    Permission.PROVIDER_SUSPEND_ANY,
    Permission.CLIENT_READ_ANY,
    Permission.CLIENT_UPDATE_ANY,
    Permission.BOOKING_READ_ANY,
    Permission.BOOKING_UPDATE_ANY,
    Permission.SERVICE_READ_ANY,
    Permission.REVIEW_MODERATE_ANY,
    Permission.INVOICE_READ_ANY,
    Permission.COMMISSION_READ_ANY,
    Permission.COMMISSION_MANAGE_ANY,
    Permission.SUBSCRIPTION_READ_ANY,
    Permission.SUBSCRIPTION_MANAGE_ANY,
    Permission.SUPPORT_READ_ANY,
    Permission.SUPPORT_UPDATE_ANY,
}

ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.PROVIDER: _PROVIDER_PERMS,
    Role.CLIENT: _CLIENT_PERMS,
    Role.ADMIN: _ADMIN_PERMS,
    # future scoped subsets — extend as those roles are activated
    Role.SUPPORT_AGENT: {Permission.SUPPORT_READ_ANY, Permission.SUPPORT_UPDATE_ANY, Permission.BOOKING_READ_ANY},
    Role.COMPLIANCE_REVIEWER: {Permission.PROVIDER_APPROVE_ANY, Permission.REVIEW_MODERATE_ANY},
    Role.FINANCE_ADMIN: {Permission.INVOICE_READ_ANY, Permission.COMMISSION_READ_ANY, Permission.COMMISSION_MANAGE_ANY},
    Role.MARKETPLACE_MANAGER: {Permission.ADMIN_DASHBOARD_READ, Permission.PROVIDER_APPROVE_ANY, Permission.SERVICE_READ_ANY, Permission.BOOKING_READ_ANY},
}


def has_permission(role: str | Role, permission: Permission) -> bool:
    try:
        r = Role(role) if not isinstance(role, Role) else role
    except ValueError:
        return False
    return permission in ROLE_PERMISSIONS.get(r, set())


def require_permission(permission: Permission):
    """FastAPI dependency: 403 unless the current user's role has the permission."""
    async def _dep(user: dict = Depends(get_current_user)):
        if not has_permission(user.get("role", ""), permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return _dep


def require_any_permission(perms: Iterable[Permission]):
    """FastAPI dependency: 403 unless the user has at least one of the given permissions."""
    perms = list(perms)

    async def _dep(user: dict = Depends(get_current_user)):
        role = user.get("role", "")
        if not any(has_permission(role, p) for p in perms):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return _dep
