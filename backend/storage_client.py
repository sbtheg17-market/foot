"""Emergent object storage helper for provider verification docs."""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

import requests

logger = logging.getLogger("footcare.storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "footcare-marketplace"
_storage_key: Optional[str] = None


def _emergent_key() -> Optional[str]:
    return os.environ.get("EMERGENT_LLM_KEY")


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    key = _emergent_key()
    if not key:
        logger.warning("EMERGENT_LLM_KEY missing — object storage disabled (uploads will 503)")
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": key}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:  # noqa: BLE001
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage unavailable")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise RuntimeError("Object storage unavailable")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


def upload_provider_doc(user_id: str, data: bytes, content_type: str, ext: str) -> str:
    """Upload a doc for a provider signup and return its canonical storage path."""
    path = f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.{ext.lstrip('.')}"
    result = put_object(path, data, content_type or "application/octet-stream")
    return result["path"]
