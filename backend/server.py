"""
OnCall Foot — FARM-container bridge.

This FastAPI app exists ONLY to adapt the fixed supervisor entrypoint
(uvicorn on :8001) to the real OnCall Foot Express API (Node, :4001).

Responsibilities:
  1. Ensure local PostgreSQL 15 cluster is online.
  2. Ensure the built Express API (artifacts/api-server/dist/index.mjs)
     is running on :4001 (spawned detached so it survives reloads).
  3. Reverse-proxy every /api/* request (incl. SSE streams) to :4001.

No product logic lives here. Canonical product code: /app/foot (git).
"""

import os
import socket
import subprocess
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.background import BackgroundTask

FOOT_DIR = Path("/app/foot")
API_PORT = 4001
UPSTREAM = f"http://127.0.0.1:{API_PORT}"
API_DIST = FOOT_DIR / "artifacts" / "api-server" / "dist" / "index.mjs"
NODE_LOG = "/var/log/foot-api.log"

# Hop-by-hop / recomputed headers that must not be forwarded verbatim.
_SKIP_RESPONSE_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "content-encoding",
}


def _port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _foot_env() -> dict:
    """Merge /app/foot/.env (untracked secrets) into a child environment."""
    env = os.environ.copy()
    env_file = FOOT_DIR / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip()
    env["PORT"] = str(API_PORT)
    env.setdefault("NODE_ENV", "development")
    return env


def ensure_postgres() -> None:
    """Start postgres; if binaries/config were wiped by a pod restart, run the
    self-heal script which reinstalls and re-registers the persistent cluster."""
    try:
        result = subprocess.run(
            ["pg_lsclusters"], capture_output=True, text=True, timeout=15
        )
        if "online" in result.stdout:
            return
        subprocess.run(["pg_ctlcluster", "15", "main", "start"], timeout=60)
        result = subprocess.run(
            ["pg_lsclusters"], capture_output=True, text=True, timeout=15
        )
        if "online" in result.stdout:
            return
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        print(f"[bridge] postgres not directly startable: {exc}")
    # Full self-heal (apt install, cluster re-registration, deps, build).
    try:
        subprocess.run(
            ["bash", "/app/scripts/bootstrap_env.sh"], timeout=600
        )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[bridge] bootstrap_env failed: {exc}")


def ensure_foot_api() -> None:
    if _port_open(API_PORT):
        return
    if not API_DIST.exists():
        print(f"[bridge] missing API build at {API_DIST}")
        return
    log_handle = open(NODE_LOG, "ab")
    subprocess.Popen(
        ["node", "--enable-source-maps", str(API_DIST)],
        cwd=str(FOOT_DIR),
        env=_foot_env(),
        stdout=log_handle,
        stderr=log_handle,
        start_new_session=True,  # survive uvicorn reloads / group kills
    )
    for _ in range(60):
        if _port_open(API_PORT):
            print("[bridge] foot API online on :%d" % API_PORT)
            return
        time.sleep(0.25)
    print("[bridge] foot API failed to open port — see " + NODE_LOG)


@asynccontextmanager
async def lifespan(application: FastAPI):
    ensure_postgres()
    ensure_foot_api()
    application.state.client = httpx.AsyncClient(
        base_url=UPSTREAM,
        timeout=httpx.Timeout(connect=10.0, read=None, write=60.0, pool=None),
    )
    yield
    await application.state.client.aclose()


app = FastAPI(lifespan=lifespan)


@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
)
async def proxy(request: Request, path: str):
    if not _port_open(API_PORT):
        ensure_postgres()
        ensure_foot_api()

    client: httpx.AsyncClient = request.app.state.client
    headers = {
        k: v for k, v in request.headers.items() if k.lower() != "host"
    }
    body = await request.body()

    upstream_request = client.build_request(
        request.method,
        f"/api/{path}",
        params=request.query_params,
        headers=headers,
        content=body,
    )
    try:
        upstream = await client.send(upstream_request, stream=True)
    except httpx.ConnectError:
        return JSONResponse(
            status_code=502,
            content={"error": "API server unavailable — restarting, retry shortly"},
        )

    response_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in _SKIP_RESPONSE_HEADERS
    }
    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=response_headers,
        background=BackgroundTask(upstream.aclose),
    )
