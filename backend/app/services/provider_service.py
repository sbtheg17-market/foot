"""Provider profile / onboarding / verification business logic."""
from app.core.constants import VerificationStatus
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


async def submit_for_verification(user: dict) -> dict:
    """Lightweight verification submission — flips `draft`/`rejected` -> `pending_review`.
    Approvals/rejections happen via the admin portal (not yet built)."""
    current = user.get("verification_status") or VerificationStatus.DRAFT.value
    if current in (VerificationStatus.PENDING_REVIEW.value, VerificationStatus.APPROVED.value):
        return user
    await user_repository.update_fields(user["_id"], {"verification_status": VerificationStatus.PENDING_REVIEW.value})
    user["verification_status"] = VerificationStatus.PENDING_REVIEW.value
    return user
