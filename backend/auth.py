"""
Patient Auth — sign-in + hardened logout.

Endpoints:
  POST /api/auth/register  {email, password, name}  -> 201 {token, patient} | 400 | 409
  POST /api/auth/login     {email, password}         -> 200 {token, patient} | 400 | 401
  POST /api/auth/logout    (Bearer)                  -> ALWAYS 200 (idempotent, hardened)
  GET  /api/auth/me        (Bearer)                  -> 200 {patient} | 401

Hardened logout semantics (per operator acceptance criteria):
  - Server: logout NEVER fails for auth reasons — invalid/expired/missing tokens still get 200,
    so the client can always finish clearing local state.
  - Client: token is cleared in a `finally` block regardless of the request outcome.

Collections (additive; auth scope, separate from the comfort two-store boundary):
  patients      {id, email, name, passwordHash, createdAt}
  auth_sessions {token, patientId, createdAt, revoked}

Identity resolution for comfort routes: `resolve_patient(request)` is installed on
`app.state.resolve_patient` (see server.py). Bearer tokens take precedence; the
`X-Patient-Id` header remains as a DOCUMENTED TEST BYPASS to be removed before deploy.
"""
import os
import re
import secrets
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]
patients = _db["patients"]
sessions = _db["auth_sessions"]

router = APIRouter(prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_MIN_LEN = 8


def _bad_request(detail: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "VALIDATION", "detail": detail})


def _unauthorized() -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "UNAUTHORIZED"})


def _public_patient(doc: dict) -> dict:
    return {"id": doc["id"], "email": doc["email"], "name": doc.get("name") or ""}


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[7:].strip()
        return token or None
    return None


async def _session_patient_id(token: str) -> str | None:
    session = await sessions.find_one({"token": token, "revoked": False})
    return session["patientId"] if session else None


async def resolve_patient(request: Request) -> str | None:
    """Installed on app.state.resolve_patient — used by comfort routes."""
    token = _bearer_token(request)
    if not token:
        return None
    return await _session_patient_id(token)


async def _issue_session(patient_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await sessions.insert_one(
        {
            "token": token,
            "patientId": patient_id,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "revoked": False,
        }
    )
    return token


async def _json_body(request: Request):
    try:
        body = await request.json()
    except Exception:
        return None
    return body if isinstance(body, dict) else None


@router.post("/register")
async def register(request: Request):
    body = await _json_body(request)
    if body is None:
        return _bad_request("request body must be a JSON object")
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    name = (body.get("name") or "").strip()
    if not EMAIL_RE.match(email):
        return _bad_request("a valid email is required")
    if not isinstance(password, str) or len(password) < PASSWORD_MIN_LEN:
        return _bad_request(f"password must be at least {PASSWORD_MIN_LEN} characters")
    if await patients.find_one({"email": email}):
        return JSONResponse(status_code=409, content={"error": "EMAIL_EXISTS"})
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": name,
        "passwordHash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    await patients.insert_one(dict(doc))
    token = await _issue_session(doc["id"])
    return JSONResponse(status_code=201, content={"token": token, "patient": _public_patient(doc)})


@router.post("/login")
async def login(request: Request):
    body = await _json_body(request)
    if body is None:
        return _bad_request("request body must be a JSON object")
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not isinstance(password, str) or not password:
        return _bad_request("email and password are required")
    doc = await patients.find_one({"email": email})
    if not doc or not bcrypt.checkpw(password.encode(), doc["passwordHash"].encode()):
        return _unauthorized()
    token = await _issue_session(doc["id"])
    return JSONResponse(status_code=200, content={"token": token, "patient": _public_patient(doc)})


@router.post("/logout")
async def logout(request: Request):
    """Hardened: ALWAYS 200. Invalid/expired/missing tokens still succeed so the
    client can complete local sign-out deterministically."""
    token = _bearer_token(request)
    if token:
        await sessions.update_one({"token": token}, {"$set": {"revoked": True}})
    return JSONResponse(status_code=200, content={"status": "SIGNED_OUT"})


@router.get("/me")
async def me(request: Request):
    token = _bearer_token(request)
    if not token:
        return _unauthorized()
    patient_id = await _session_patient_id(token)
    if not patient_id:
        return _unauthorized()
    doc = await patients.find_one({"id": patient_id})
    if not doc:
        return _unauthorized()
    return JSONResponse(status_code=200, content={"patient": _public_patient(doc)})
