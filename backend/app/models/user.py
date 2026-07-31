"""User read/response models."""
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.common import PyObjectId


class UserOut(BaseModel):
    id: PyObjectId = Field(alias="_id")
    email: str
    name: str
    role: str = "provider"
    photo: Optional[str] = None
    bio: Optional[str] = None
    certifications: List[str] = []
    onboarding_complete: bool = False

    model_config = {"populate_by_name": True}


def user_to_out(doc: dict) -> UserOut:
    """Strip password_hash before serializing a raw user doc."""
    safe = {k: v for k, v in doc.items() if k != "password_hash"}
    return UserOut(**safe)
