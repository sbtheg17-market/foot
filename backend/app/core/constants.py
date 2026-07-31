"""Shared enums + collection names. Single source of truth for status vocab."""
from enum import Enum


# ---------- Collections ----------
class Collections:
    USERS = "users"
    LOGIN_ATTEMPTS = "login_attempts"
    SERVICES = "services"
    AVAILABILITY = "availability"
    BOOKINGS = "bookings"
    # Future: invoices, reviews, travel_zones,
    # verification_submissions, plans, subscriptions, commission_rules,
    # featured_slots, payout_records, audit_logs


# ---------- Status enums (documented for future use; only a subset active today) ----------
class BookingStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    VOID = "void"


class ReviewStatus(str, Enum):
    VISIBLE = "visible"
    FLAGGED = "flagged"
    HIDDEN = "hidden"


class VerificationStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class SubscriptionStatus(str, Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


class FeaturedStatus(str, Enum):
    INACTIVE = "inactive"
    SCHEDULED = "scheduled"
    LIVE = "live"
    EXPIRED = "expired"


DEFAULT_CURRENCY = "USD"
