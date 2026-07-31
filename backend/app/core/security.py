"""JWT, bcrypt and cookie helpers. No DB access lives here."""
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Response

from app.core.config import settings


# ---------- Passwords ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------- JWT ----------
def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


# ---------- Cookies ----------
def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        "access_token", access_token,
        httponly=True, secure=True, samesite="none",
        max_age=settings.ACCESS_TOKEN_MINUTES * 60, path="/",
    )
    response.set_cookie(
        "refresh_token", refresh_token,
        httponly=True, secure=True, samesite="none",
        max_age=settings.REFRESH_TOKEN_DAYS * 86400, path="/",
    )


def set_access_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        "access_token", access_token,
        httponly=True, secure=True, samesite="none",
        max_age=settings.ACCESS_TOKEN_MINUTES * 60, path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/", samesite="none", secure=True)
    response.delete_cookie("refresh_token", path="/", samesite="none", secure=True)
