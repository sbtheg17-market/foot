from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import hashlib
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# ---------------------------------------------------------------------------
# Transport patch package downloads (read-only file serving; no remote writes)
# ---------------------------------------------------------------------------
DOWNLOADS_DIR = Path("/app/handoff/downloads")

FILE_DESCRIPTIONS = {
    "A-prime-session063-traceability.patch": "A\u2032 Session 063 traceability \u2014 INTENDED FIRST publication candidate (commit f4a5dfec\u2026, parent 3e76114). Scope: .agents/LOG.md + NEXT_TASK.md.",
    "C-prime-lockfile-reproducibility.patch": "C\u2032 lockfile reproducibility (commit 2c6d0248\u2026). Apply SECOND \u2014 must be re-derived on the new main tip after A\u2032 lands.",
    "B-prime-provider-signout.patch": "B\u2032 provider sign-out (commit e6380bf7\u2026). Apply THIRD \u2014 re-derive after A\u2032+C\u2032; requires a real reviewed --approve-web-ui rationale.",
    "phase4c-nonschema-prep.patch": "Phase 4C non-schema preparation (commit 2dc23539\u2026). SEPARATE candidate \u2014 own review; no schema/codegen/storage.",
    "rule12-provenance-docs.patch": "Rule 12 provenance documentation (commit b85f71f3\u2026). SEPARATE candidate \u2014 never merge into A\u2032.",
    "MANIFEST.json": "Machine-readable package manifest: identities, trees, scopes, checksums, approval status.",
    "CHECKSUMS.sha256": "SHA-256 of every file inside the patch package.",
    "DOWNLOADS.sha256": "SHA-256 of every file on this download page.",
    "APPLICATION_GUIDE.md": "How and in what order to apply patches \u2014 read before touching GitHub.",
    "PROVENANCE_SUMMARY.md": "Human-readable evidence chain and candidate table.",
    "patch_package.tar.gz": "Whole patch package (patches + evidence + manifests) as tar.gz.",
    "patch_package.zip": "Whole patch package as zip.",
    "local-branches-2026-08-10.bundle": "Git bundle of all 5 local candidate branches (git clone <bundle> to restore).",
    "LEDGER.jsonl": "Append-only provenance ledger (54 records, secret-redacted).",
    "LEDGER_SUMMARY.md": "Human-readable ledger summary.",
}

APPLY_ORDER = [
    ("1", "A-prime-session063-traceability.patch", "Apply first \u2014 only after its individual approval + evidence exports."),
    ("2", "C-prime-lockfile-reproducibility.patch", "Re-derive on the new tip after A\u2032 lands (new identity) before pushing."),
    ("3", "B-prime-provider-signout.patch", "Re-derive after A\u2032+C\u2032; needs real reviewed --approve-web-ui rationale."),
    ("\u2014", "phase4c-nonschema-prep.patch", "Separate candidate \u2014 own review and approval."),
    ("\u2014", "rule12-provenance-docs.patch", "Separate candidate \u2014 do NOT merge into A\u2032."),
]

_sha_cache: dict = {}


def _file_sha256(path: Path) -> str:
    stat = path.stat()
    key = (str(path), stat.st_mtime_ns, stat.st_size)
    if key in _sha_cache:
        return _sha_cache[key]
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    value = digest.hexdigest()
    _sha_cache[key] = value
    return value


def _listing():
    files = []
    if DOWNLOADS_DIR.is_dir():
        for path in sorted(DOWNLOADS_DIR.iterdir()):
            if path.is_file():
                files.append({
                    "name": path.name,
                    "size_bytes": path.stat().st_size,
                    "sha256": _file_sha256(path),
                    "description": FILE_DESCRIPTIONS.get(path.name, ""),
                    "url": f"/api/downloads/file/{path.name}",
                })
    return files


@api_router.get("/downloads/index.json")
async def downloads_index():
    return JSONResponse({
        "package": "transport-only patch package \u2014 sbtheg17-market/foot",
        "baseline_main": "3e76114ce8ff8908a955d4beac38d6b3cde5dd6a",
        "transport_only": True,
        "applied_remotely": False,
        "note": "No patch may be applied until its individual publication approval exists. A\u2032 first; C\u2032/B\u2032 re-derived on the new tip.",
        "files": _listing(),
    })


@api_router.get("/downloads/file/{name}")
async def download_file(name: str):
    # strict whitelist: exact basename match against directory contents
    if "/" in name or "\\" in name or name.startswith("."):
        raise HTTPException(status_code=404, detail="Not found")
    path = DOWNLOADS_DIR / name
    if not path.is_file() or path.parent != DOWNLOADS_DIR:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path, media_type="application/octet-stream", filename=name)


@api_router.get("/downloads", response_class=HTMLResponse)
async def downloads_page():
    files = {f["name"]: f for f in _listing()}

    def row(f):
        size = f["size_bytes"]
        human = f"{size/1024:.1f} KB" if size < 1024 * 1024 else f"{size/1024/1024:.1f} MB"
        return (f"<tr><td><a href='{f['url']}' download>{f['name']}</a></td>"
                f"<td class='desc'>{f['description']}</td><td>{human}</td>"
                f"<td class='sha'>{f['sha256'][:16]}\u2026</td></tr>")

    order_rows = "".join(
        f"<tr><td class='num'>{n}</td><td><a href='/api/downloads/file/{fn}' download>{fn}</a></td><td class='desc'>{note}</td></tr>"
        for n, fn, note in APPLY_ORDER if fn in files
    )
    patch_names = [fn for _, fn, _ in APPLY_ORDER]
    other_rows = "".join(row(f) for name, f in files.items() if name not in patch_names)
    html = f"""<!doctype html><html><head><meta charset='utf-8'>
<meta name='viewport' content='width=device-width, initial-scale=1'>
<title>Patch Package Downloads \u2014 sbtheg17-market/foot</title>
<style>
  body{{margin:0;padding:32px 16px;background:#0f172a;color:#e2e8f0;font:15px/1.55 -apple-system,'Segoe UI',Roboto,sans-serif}}
  .wrap{{max-width:980px;margin:0 auto}}
  h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:16px;margin:28px 0 8px;color:#93c5fd}}
  .sub{{color:#94a3b8;margin:0 0 20px}}
  .warn{{background:#331b0e;border:1px solid #92400e;border-radius:10px;padding:12px 16px;margin:16px 0;color:#fcd34d}}
  table{{width:100%;border-collapse:collapse;background:#1e293b;border-radius:10px;overflow:hidden}}
  th,td{{text-align:left;padding:9px 12px;border-bottom:1px solid #334155;vertical-align:top}}
  th{{background:#111c30;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:.05em}}
  a{{color:#7dd3fc;text-decoration:none}} a:hover{{text-decoration:underline}}
  .desc{{color:#94a3b8;font-size:13px}} .sha{{font-family:ui-monospace,monospace;font-size:12px;color:#64748b}}
  .num{{font-weight:700;color:#fbbf24;width:28px}}
  .pill{{display:inline-block;background:#14532d;color:#86efac;border-radius:999px;padding:2px 10px;font-size:12px;margin-right:6px}}
  code{{background:#111c30;padding:1px 6px;border-radius:6px;font-size:13px}}
</style></head><body><div class='wrap'>
<h1>Transport Patch Package \u2014 sbtheg17-market/foot</h1>
<p class='sub'>Baseline <code>main = 3e76114ce8ff8908a955d4beac38d6b3cde5dd6a</code>
<span class='pill'>transport-only</span><span class='pill'>nothing applied remotely</span><span class='pill'>secret-scanned</span></p>
<div class='warn'><strong>Before you push anything to GitHub:</strong> patches are transport artifacts only.
Apply a patch only after its <em>individual</em> publication approval exists, plus the branch-protection export
and the 16:35Z\u201321:40Z audit export. A\u2032 goes first; C\u2032 and B\u2032 must be re-derived on the new main tip after A\u2032 lands;
B\u2032 also needs a real reviewed <code>--approve-web-ui</code> rationale. Full instructions: APPLICATION_GUIDE.md.</div>
<h2>Candidate patches \u2014 exact application order</h2>
<table><tr><th>#</th><th>Patch</th><th>Notes</th></tr>{order_rows}</table>
<h2>Manifests, guides, evidence &amp; archives</h2>
<table><tr><th>File</th><th>Description</th><th>Size</th><th>SHA-256</th></tr>{other_rows}</table>
<h2>Verify after download</h2>
<p class='desc'>Check integrity locally: <code>sha256sum -c DOWNLOADS.sha256</code> (individual files)
or <code>sha256sum -c CHECKSUMS.sha256</code> inside the extracted package. Machine index:
<a href='/api/downloads/index.json'>/api/downloads/index.json</a></p>
</div></body></html>"""
    return HTMLResponse(html)


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()