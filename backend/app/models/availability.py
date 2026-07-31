"""Availability + travel zones models (Checkpoint 3).

Weekly is a fixed dict keyed by mon..sun. Each day holds 0+ time-range slots.
Travel is a single embedded zone doc; providers choose radius or pincodes.
"""
import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class WeeklySlot(BaseModel):
    start: str
    end: str

    @field_validator("start", "end")
    @classmethod
    def _valid_time(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError("Time must be HH:MM (24h)")
        return v

    def is_valid_range(self) -> bool:
        return self.start < self.end


class WeeklyAvailability(BaseModel):
    mon: List[WeeklySlot] = []
    tue: List[WeeklySlot] = []
    wed: List[WeeklySlot] = []
    thu: List[WeeklySlot] = []
    fri: List[WeeklySlot] = []
    sat: List[WeeklySlot] = []
    sun: List[WeeklySlot] = []


class TravelZone(BaseModel):
    mode: Literal["radius", "pincodes"] = "radius"
    radius_km: float = Field(default=0, ge=0, le=500)
    home_address: str = ""
    pincodes: List[str] = []


class AvailabilityUpdate(BaseModel):
    weekly: Optional[WeeklyAvailability] = None
    travel: Optional[TravelZone] = None


class AvailabilityOut(BaseModel):
    weekly: WeeklyAvailability
    travel: TravelZone
    updated_at: Optional[str] = None


def default_weekly() -> WeeklyAvailability:
    return WeeklyAvailability()


def default_travel() -> TravelZone:
    return TravelZone()
