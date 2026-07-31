"""Provider profile / onboarding business logic."""
from app.models.provider import OnboardingInput
from app.repositories import user_repository


async def complete_onboarding(user: dict, body: OnboardingInput) -> dict:
    update = {
        "name": body.name.strip(),
        "photo": body.photo,
        "bio": body.bio.strip(),
        "certifications": [c.strip() for c in body.certifications if c.strip()],
        "onboarding_complete": True,
    }
    await user_repository.update_fields(user["_id"], update)
    user.update(update)
    return user
