"""Review read + summary business logic."""
from bson import ObjectId

from app.repositories import review_repository


async def list_reviews(provider_id: ObjectId) -> list[dict]:
    return await review_repository.list_for_provider(provider_id)


async def get_summary(provider_id: ObjectId) -> dict:
    reviews = await review_repository.list_for_provider(provider_id)
    count = len(reviews)
    if count == 0:
        return {
            "average": 0.0,
            "count": 0,
            "breakdown": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
        }
    total = sum(int(r.get("rating", 0)) for r in reviews)
    avg = round(total / count, 1)
    breakdown = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for r in reviews:
        rating = int(r.get("rating", 0))
        if rating in breakdown:
            breakdown[rating] += 1
    return {"average": avg, "count": count, "breakdown": breakdown}
