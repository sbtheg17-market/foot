"""Preview-only shim: supervisor expects a uvicorn app on 8001. It boots the
real Node API server on an internal port and transparently proxies to it."""
import os
import subprocess
import atexit
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

ROOT = Path(__file__).resolve().parent.parent
NODE_PORT = "8011"
UPSTREAM = f"http://127.0.0.1:{NODE_PORT}"

env = {**os.environ, "PORT": NODE_PORT}
for line in (ROOT / ".env").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()

node = subprocess.Popen(
    ["node", "--enable-source-maps", str(ROOT / "artifacts/api-server/dist/index.mjs")],
    env=env,
    cwd=str(ROOT / "artifacts/api-server"),
)
atexit.register(node.terminate)

app = FastAPI()
client = httpx.AsyncClient(base_url=UPSTREAM, timeout=None)


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}
    req = client.build_request(
        request.method,
        f"/{path}",
        params=request.query_params,
        headers=headers,
        content=await request.body(),
    )
    upstream = await client.send(req, stream=True)
    resp_headers = {
        k: v
        for k, v in upstream.headers.items()
        if k.lower() not in ("content-length", "transfer-encoding", "content-encoding")
    }
    return StreamingResponse(
        upstream.aiter_raw(),
        status_code=upstream.status_code,
        headers=resp_headers,
        background=None,
    )
