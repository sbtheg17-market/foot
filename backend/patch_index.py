"""
Patch Index — meta-infrastructure endpoint.

GET /api/patches -> 200 [{name, commit, subject, date, files, evidence, task}]

Parses the REAL `patches/*.patch` files on disk (git format-patch mbox format):
  - commit hash from the 'From <sha>' line,
  - subject (RFC 2047 decoded, '[PATCH] ' prefix stripped),
  - author date,
  - exact changed-file list from 'diff --git' headers.
Test-evidence strings are merged from `patches/INDEX.json` (maintained per the
.agents/SETUP.md workflow). Nothing is invented: files that do not exist on disk
are not listed.
"""
import json
import re
from email import message_from_string
from email.header import decode_header
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

PATCHES_DIR = Path(__file__).parent.parent / "patches"

router = APIRouter(prefix="/api")

_FROM_RE = re.compile(r"^From ([0-9a-f]{40}) ", re.MULTILINE)
_DIFF_RE = re.compile(r"^diff --git a/(.+?) b/", re.MULTILINE)


def _decode_subject(raw: str) -> str:
    parts = decode_header(raw or "")
    out = ""
    for text, charset in parts:
        out += text.decode(charset or "utf-8") if isinstance(text, bytes) else text
    out = out.replace("\n", " ").strip()
    return out[len("[PATCH] "):] if out.startswith("[PATCH] ") else out


def _parse_patch(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    commit_match = _FROM_RE.search(text)
    msg = message_from_string(text)
    return {
        "name": path.name,
        "commit": commit_match.group(1) if commit_match else None,
        "subject": _decode_subject(msg.get("Subject", "")),
        "date": msg.get("Date", ""),
        "files": sorted(set(_DIFF_RE.findall(text))),
    }


def _load_index() -> dict:
    index_path = PATCHES_DIR / "INDEX.json"
    if not index_path.exists():
        return {}
    try:
        return json.loads(index_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


@router.get("/patches")
async def list_patches():
    if not PATCHES_DIR.exists():
        return JSONResponse(status_code=200, content=[])
    index = _load_index()
    entries = []
    for path in sorted(PATCHES_DIR.glob("*.patch")):
        entry = _parse_patch(path)
        meta = index.get(path.name, {})
        entry["evidence"] = meta.get("evidence", "")
        entry["task"] = meta.get("task", "")
        entries.append(entry)
    # chronological by author date where possible, fallback name
    entries.sort(key=lambda e: (e["date"], e["name"]))
    return JSONResponse(status_code=200, content=entries)
