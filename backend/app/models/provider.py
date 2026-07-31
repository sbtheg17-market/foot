"""Provider profile (onboarding + edit) payloads."""
from typing import List, Optional

from pydantic import BaseModel, Field


class OnboardingInput(BaseModel):
    name: str = Field(min_length=1)
    photo: Optional[str] = None
    bio: str = ""
    certifications: List[str] = []
