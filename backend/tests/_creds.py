"""Preview-only test credential loader.

No password ever lives in this repository. Values come from environment
variables, optionally pre-loaded from the gitignored file
`memory/test_credentials.env` (KEY=VALUE lines). Tests that need an account
whose credentials are missing are skipped rather than failing.

Variables:
  TEST_BASE_URL          public preview origin (default: current Emergent preview)
  TEST_QA_EMAIL / TEST_QA_PASSWORD           QA provider account
  TEST_ORBITE_EMAIL / TEST_ORBITE_PASSWORD   the owner's real provider account
  TEST_DEMO_PASSWORD                         shared password of seed demo users
"""
import os
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _ROOT / "memory" / "test_credentials.env"


def _load_env_file() -> None:
    if not _ENV_FILE.exists():
        return
    for line in _ENV_FILE.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()

BASE_URL = os.environ.get("TEST_BASE_URL", "https://oncall-operations.preview.emergentagent.com").rstrip("/")

QA_EMAIL = os.environ.get("TEST_QA_EMAIL", "qa.provider@oncallfoot.test")
ORBITE_EMAIL = os.environ.get("TEST_ORBITE_EMAIL", "orbitetech12@gmail.com")

DEMO_EMAILS = {
    "admin": "admin@oncallfoot.com",
    "sarah": "sarah@oncallfoot.com",
    "mike": "mike@oncallfoot.com",
    "jane": "jane@oncallfoot.com",
}


def require(var: str) -> str:
    """Return the env var or skip the calling test with a clear reason."""
    value = os.environ.get(var)
    if not value:
        pytest.skip(f"{var} not set (see backend/tests/_creds.py); credentials are never committed")
    return value


def qa_credentials() -> tuple[str, str]:
    return QA_EMAIL, require("TEST_QA_PASSWORD")


def orbite_credentials() -> tuple[str, str]:
    return ORBITE_EMAIL, require("TEST_ORBITE_PASSWORD")


def demo_credentials(name: str) -> tuple[str, str]:
    return DEMO_EMAILS[name], require("TEST_DEMO_PASSWORD")
