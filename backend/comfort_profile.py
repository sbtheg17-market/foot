"""
Comfort Profile API — Phase 4C consent-gated routes.

CONTRACT (source of truth): docs/comfort-profile/PHASE_4C_COMFORT_PROFILE_CONTRACT_V3.md

Server rules live HERE, at the contract/module boundary (§1.2) — never in client shells.

Operations (exactly six — §2):
  1. grantConsent              POST   /api/comfort-profile/consent            -> 201 | 400 | 401
  2. withdrawConsent           POST   /api/comfort-profile/consent/withdraw  -> 200 | 404 | 401
  3. deleteComfortProfile      DELETE /api/comfort-profile                    -> 204 | 404 | 401
  4. getComfortProfile         GET    /api/comfort-profile                    -> 200 | 401
  5. updateComfortPreferences  PUT    /api/comfort-profile/preferences        -> 200 | 400 | 409 | 401
  6. getProviderProjection     GET    /api/provider/comfort-projection/{id}   -> 200 | 404-only | 401 (NO 403)

Invariants enforced here:
  - isConsentActive is determined from the LATEST consent row (§3).
  - Status allow-list is exactly ["ACTIVE"] (§3).
  - Withdraw appends a WITHDRAWN row; it NEVER deletes profile data (§2.1).
  - Withdraw and delete are separate operations.
  - PUT returns 409 when consent is not active.
  - build_provider_projection encodes the FOUR conditions (§4); null -> HTTP 404.
  - There is NO 403 branch anywhere in this module.

Persistence: exactly TWO additive collections (§6) — comfort_consents (append-only),
comfort_profiles. No existing collections are modified.

Identity (Task-1 stub, upgraded by AUTH task): requests carry `X-Patient-Id` /
`X-Provider-Id` headers; a missing identity yields 401.
"""
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _client[os.environ["DB_NAME"]]
consents = _db["comfort_consents"]   # additive collection 1 (append-only rows)
profiles = _db["comfort_profiles"]   # additive collection 2 (one doc per patient)

router = APIRouter(prefix="/api")

# ---- Contract constants (§2.1, §3) -------------------------------------------------
ALLOWED_SCOPE_FIELDS = ["temperature", "lighting", "noise", "notes"]
STATUS_ALLOW_LIST = ["ACTIVE"]  # exactly one entry — extending requires contract review
PREFERENCE_ENUMS = {
    "temperature": ["cool", "moderate", "warm"],
    "lighting": ["dim", "soft", "bright"],
    "noise": ["quiet", "low", "moderate"],
}
NOTES_MAX_LEN = 1000


# ---- Helpers ------------------------------------------------------------------------
def _unauthorized() -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "UNAUTHORIZED"})


def _bad_request(detail: str) -> JSONResponse:
    return JSONResponse(status_code=400, content={"error": "VALIDATION", "detail": detail})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _bypass_enabled() -> bool:
    """DOCUMENTED TEST BYPASS (dev/staging only — approval ENTRY-012 caveat).
    X-Patient-Id / X-Provider-Id headers are honored ONLY when
    ALLOW_TEST_IDENTITY_HEADERS=true. Production must not set this flag."""
    return os.environ.get("ALLOW_TEST_IDENTITY_HEADERS", "false").strip().lower() == "true"


async def _patient_id(request: Request) -> str | None:
    """Resolve the acting patient identity. Bearer session first; header bypass
    only when the dev flag allows it."""
    resolver = getattr(request.app.state, "resolve_patient", None)
    if resolver is not None:
        resolved = await resolver(request)
        if resolved:
            return resolved
    if _bypass_enabled():
        pid = request.headers.get("X-Patient-Id", "").strip()
        return pid or None
    return None


async def _provider_identity(request: Request) -> str | None:
    """Resolve the acting provider identity. Bearer provider session first
    (patient tokens are rejected by role enforcement); header bypass only when
    the dev flag allows it."""
    resolver = getattr(request.app.state, "resolve_provider", None)
    if resolver is not None:
        resolved = await resolver(request)
        if resolved:
            return resolved
    if _bypass_enabled():
        pid = request.headers.get("X-Provider-Id", "").strip()
        return pid or None
    return None


async def _latest_consent_row(patient_id: str) -> dict | None:
    rows = await consents.find({"patientId": patient_id}).sort("ts", -1).limit(1).to_list(1)
    return rows[0] if rows else None


def _is_consent_active(latest_row: dict | None) -> bool:
    """§3 — latest row exists AND its status is in the allow-list."""
    return latest_row is not None and latest_row.get("status") in STATUS_ALLOW_LIST


def build_provider_projection(latest_row: dict | None, profile: dict | None) -> dict | None:
    """§4 — the four conditions, all required, evaluated in order.

    Returns the scoped, non-null projection dict, or None (-> HTTP 404, never 403).
    """
    # 1. Consent exists — the patient has at least one consent row.
    if latest_row is None:
        return None
    # 2. Latest row allowed — status in the allow-list.
    if latest_row.get("status") not in STATUS_ALLOW_LIST:
        return None
    # 3. Profile exists.
    if profile is None:
        return None
    # 4. Non-empty scoped payload — filter to granted scope; ≥1 non-null field remains.
    scope = latest_row.get("scope") or []
    scoped = {
        field: profile.get(field)
        for field in ALLOWED_SCOPE_FIELDS
        if field in scope and profile.get(field) not in (None, "")
    }
    if not scoped:
        return None
    return scoped


def _validate_scope(body: dict) -> tuple[list | None, str | None]:
    scope = body.get("scope")
    if not isinstance(scope, list) or len(scope) == 0:
        return None, "scope must be a non-empty array"
    cleaned = []
    for item in scope:
        if not isinstance(item, str) or item not in ALLOWED_SCOPE_FIELDS:
            return None, f"scope items must be one of {ALLOWED_SCOPE_FIELDS}"
        if item not in cleaned:
            cleaned.append(item)
    return cleaned, None


def _validate_preferences(body: dict) -> tuple[dict | None, str | None]:
    if not isinstance(body, dict) or len(body) == 0:
        return None, "at least one preference field is required"
    updates: dict = {}
    for key, value in body.items():
        if key not in ALLOWED_SCOPE_FIELDS:
            return None, f"unknown field '{key}'"
        if value is None:
            updates[key] = None
            continue
        if key == "notes":
            if not isinstance(value, str) or len(value) > NOTES_MAX_LEN:
                return None, f"notes must be a string of at most {NOTES_MAX_LEN} characters"
            updates[key] = value
        else:
            if value not in PREFERENCE_ENUMS[key]:
                return None, f"{key} must be one of {PREFERENCE_ENUMS[key]}"
            updates[key] = value
    return updates, None


async def _json_body(request: Request) -> tuple[dict | None, JSONResponse | None]:
    try:
        body = await request.json()
    except Exception:
        return None, _bad_request("request body must be valid JSON")
    if not isinstance(body, dict):
        return None, _bad_request("request body must be a JSON object")
    return body, None


# ---- 1. grantConsent — POST /api/comfort-profile/consent -> 201 | 400 | 401 ---------
@router.post("/comfort-profile/consent")
async def grant_consent(request: Request):
    patient_id = await _patient_id(request)
    if not patient_id:
        return _unauthorized()
    body, err = await _json_body(request)
    if err:
        return err
    scope, detail = _validate_scope(body)
    if detail:
        return _bad_request(detail)
    row = {
        "id": str(uuid.uuid4()),
        "patientId": patient_id,
        "status": "ACTIVE",
        "scope": scope,
        "createdAt": _now_iso(),
        "ts": time.time_ns(),  # monotonic-enough ordering key for latest-row selection
    }
    await consents.insert_one(dict(row))
    return JSONResponse(
        status_code=201,
        content={
            "consentId": row["id"],
            "status": row["status"],
            "scope": row["scope"],
            "createdAt": row["createdAt"],
        },
    )


# ---- 2. withdrawConsent — POST /api/comfort-profile/consent/withdraw -> 200|404|401 -
@router.post("/comfort-profile/consent/withdraw")
async def withdraw_consent(request: Request):
    patient_id = await _patient_id(request)
    if not patient_id:
        return _unauthorized()
    latest = await _latest_consent_row(patient_id)
    if latest is None:
        # §2.1 — 404 when no consent record exists at all
        return JSONResponse(status_code=404, content={"error": "NO_CONSENT_RECORD"})
    row = {
        "id": str(uuid.uuid4()),
        "patientId": patient_id,
        "status": "WITHDRAWN",
        "scope": [],
        "createdAt": _now_iso(),
        "ts": time.time_ns(),
    }
    # Withdraw HIDES (append-only status row). It never touches comfort_profiles.
    await consents.insert_one(dict(row))
    return JSONResponse(
        status_code=200,
        content={"consentId": row["id"], "status": row["status"], "createdAt": row["createdAt"]},
    )


# ---- 3. deleteComfortProfile — DELETE /api/comfort-profile -> 204 | 404 | 401 -------
@router.delete("/comfort-profile")
async def delete_comfort_profile(request: Request):
    patient_id = await _patient_id(request)
    if not patient_id:
        return _unauthorized()
    result = await profiles.delete_one({"patientId": patient_id})
    if result.deleted_count == 0:
        return JSONResponse(status_code=404, content={"error": "NO_PROFILE"})
    return Response(status_code=204)


# ---- 4. getComfortProfile — GET /api/comfort-profile -> 200 | 401 -------------------
@router.get("/comfort-profile")
async def get_comfort_profile(request: Request):
    patient_id = await _patient_id(request)
    if not patient_id:
        return _unauthorized()
    latest = await _latest_consent_row(patient_id)
    profile = await profiles.find_one({"patientId": patient_id})
    preferences = None
    if profile is not None:
        preferences = {field: profile.get(field) for field in ALLOWED_SCOPE_FIELDS}
    return JSONResponse(
        status_code=200,
        content={
            "isConsentActive": _is_consent_active(latest),
            "hasProfile": profile is not None,
            "preferences": preferences,
        },
    )


# ---- 5. updateComfortPreferences — PUT /api/comfort-profile/preferences -------------
#      -> 200 | 400 | 409 | 401
@router.put("/comfort-profile/preferences")
async def update_comfort_preferences(request: Request):
    patient_id = await _patient_id(request)
    if not patient_id:
        return _unauthorized()
    body, err = await _json_body(request)
    if err:
        return err
    updates, detail = _validate_preferences(body)
    if detail:
        return _bad_request(detail)
    latest = await _latest_consent_row(patient_id)
    if not _is_consent_active(latest):
        # §1.4 — PUT returns 409 when consent is not active
        return JSONResponse(status_code=409, content={"error": "CONSENT_NOT_ACTIVE"})
    now = _now_iso()
    await profiles.update_one(
        {"patientId": patient_id},
        {
            "$set": {**updates, "updatedAt": now},
            "$setOnInsert": {"id": str(uuid.uuid4()), "patientId": patient_id, "createdAt": now},
        },
        upsert=True,
    )
    profile = await profiles.find_one({"patientId": patient_id})
    return JSONResponse(
        status_code=200,
        content={
            "preferences": {field: profile.get(field) for field in ALLOWED_SCOPE_FIELDS},
            "updatedAt": profile.get("updatedAt"),
        },
    )


# ---- 6. getProviderProjection — GET /api/provider/comfort-projection/{patientId} ----
#      -> 200 | 404-only (never 403) | 401
@router.get("/provider/comfort-projection/{patient_id}")
async def get_provider_projection(patient_id: str, request: Request):
    if not await _provider_identity(request):
        return _unauthorized()
    latest = await _latest_consent_row(patient_id)
    profile = await profiles.find_one({"patientId": patient_id})
    projection = build_provider_projection(latest, profile)
    if projection is None:
        # 404-only design — reveals nothing beyond absence-of-share; NO 403 path exists.
        return JSONResponse(status_code=404, content={"error": "NOT_FOUND"})
    return JSONResponse(status_code=200, content={"patientId": patient_id, "projection": projection})
