"""Single source of truth for plan tiers.

Providers' `plan` field drives:
  - commission_rate (platform take)
  - marketplace placement (sort order in listings)
  - feature gates (opportunity cards, priority support, custom analytics)
  - Stripe subscription price lookup keys

Keep the config here — payouts, subscriptions, opportunities all derive from it.
"""
from __future__ import annotations

from typing import Any, Literal

Plan = Literal["free", "pro", "premium"]

# Ordered from lowest to highest tier
PLAN_ORDER: dict[str, int] = {"free": 2, "pro": 1, "premium": 0}


PLAN_CONFIG: dict[str, dict[str, Any]] = {
    "free": {
        "label": "Free",
        "monthly_price_cents": 0,
        "commission_rate": 0.18,
        "placement_boost": 0,
        "features": {
            "opportunities": True,
            "priority_placement": False,
            "advanced_analytics": False,
            "featured_badge": False,
        },
        "description": "Start free. Standard commission (18%), get listed after admin approval.",
        "stripe_price_lookup_key": None,
    },
    "pro": {
        "label": "Pro",
        "monthly_price_cents": 2900,  # $29/mo
        "commission_rate": 0.15,
        "placement_boost": 1,
        "features": {
            "opportunities": True,
            "priority_placement": True,
            "advanced_analytics": True,
            "featured_badge": False,
        },
        "description": "Priority placement above Free providers, lower commission (15%), advanced insights.",
        "stripe_price_lookup_key": "solecare_pro_monthly",
    },
    "premium": {
        "label": "Premium",
        "monthly_price_cents": 6900,  # $69/mo
        "commission_rate": 0.12,
        "placement_boost": 2,
        "features": {
            "opportunities": True,
            "priority_placement": True,
            "advanced_analytics": True,
            "featured_badge": True,
        },
        "description": "Top of search, lowest commission (12%), featured badge, and premium support.",
        "stripe_price_lookup_key": "solecare_premium_monthly",
    },
}


def commission_rate_for(plan: str) -> float:
    return float(PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])["commission_rate"])


def price_lookup_for(plan: str) -> str | None:
    return PLAN_CONFIG.get(plan, {}).get("stripe_price_lookup_key")


def has_feature(plan: str, feature: str) -> bool:
    return bool(PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])["features"].get(feature, False))


def plan_by_lookup_key(lookup_key: str) -> str | None:
    for plan, cfg in PLAN_CONFIG.items():
        if cfg.get("stripe_price_lookup_key") == lookup_key:
            return plan
    return None
