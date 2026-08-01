"""One-shot Stripe catalog setup for subscription plans (Pro / Premium).

Run manually with `python setup_stripe.py` after any plan-config change.
Idempotent: reuses existing products/prices by lookup_key.
"""
from __future__ import annotations

import os
from pathlib import Path

import stripe
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

stripe.api_key = os.environ["STRIPE_SECRET_KEY"]

from plans import PLAN_CONFIG  # noqa: E402  (after api_key is set)


CATALOG = [
    {
        "emergent_product_id": "solecare_pro",
        "name": "SoleCare Pro",
        "tax_code": "txcd_10103001",  # SaaS
        "prices": [{
            "lookup_key": PLAN_CONFIG["pro"]["stripe_price_lookup_key"],
            "amount": PLAN_CONFIG["pro"]["monthly_price_cents"],
            "currency": "usd",
            "interval": "month",
        }],
    },
    {
        "emergent_product_id": "solecare_premium",
        "name": "SoleCare Premium",
        "tax_code": "txcd_10103001",
        "prices": [{
            "lookup_key": PLAN_CONFIG["premium"]["stripe_price_lookup_key"],
            "amount": PLAN_CONFIG["premium"]["monthly_price_cents"],
            "currency": "usd",
            "interval": "month",
        }],
    },
]


def get_or_create_product(entry: dict):
    for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(
        name=entry["name"],
        tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]},
    )


def ensure_price(product_id: str, p: dict) -> None:
    existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
    if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
        stripe.Price.modify(existing[0].id, active=False)
        existing = []
    if not existing:
        kwargs = dict(
            product=product_id,
            unit_amount=p["amount"],
            currency=p["currency"],
            lookup_key=p["lookup_key"],
            transfer_lookup_key=True,
        )
        if p.get("interval"):
            kwargs["recurring"] = {"interval": p["interval"]}
        stripe.Price.create(**kwargs)


def main() -> None:
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for price in entry["prices"]:
            ensure_price(product.id, price)
        print(f"OK  {entry['name']}  product={product.id}")


if __name__ == "__main__":
    main()
