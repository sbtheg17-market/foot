"""Auth business logic: register, login, refresh."""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from app.core.permissions import Role
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.repositories import user_repository
from app.services import lockout_service


async def register_user(email: str, password: str, name: str) -> dict:
    email = email.lower().strip()
    if await user_repository.get_by_email(email):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    doc = {
        "email": email,
        "password_hash": hash_password(password),
        "name": name.strip(),
        "role": Role.PROVIDER.value,
        "photo": None,
        "bio": "",
        "certifications": [],
        "onboarding_complete": False,
        "verification_status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    inserted_id = await user_repository.insert(doc)
    doc["_id"] = inserted_id
    return doc


async def login_user(email: str, password: str, client_ip: str) -> dict:
    email = email.lower().strip()
    identifier = f"{client_ip}:{email}"
    await lockout_service.check_lockout(identifier)
    user = await user_repository.get_by_email(email)
    if not user or not verify_password(password, user["password_hash"]):
        await lockout_service.record_failure(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await lockout_service.clear(identifier)
    return user


def issue_tokens(user: dict) -> tuple[str, str]:
    uid = str(user["_id"])
    return create_access_token(uid, user["email"]), create_refresh_token(uid)


async def refresh_access_token(refresh_token: str) -> tuple[dict, str]:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await user_repository.get_by_id(ObjectId(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user, create_access_token(str(user["_id"]), user["email"])
