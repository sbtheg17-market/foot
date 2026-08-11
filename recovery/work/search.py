#!/usr/bin/env python3
"""Read-only artifact recovery search over the foot-all-refs.bundle mirror.

For every entry in handoff-MANIFEST-149.sha256 and handoff-MANIFEST-80.sha256:
  - find blobs (across all snapshot branches) whose content SHA-256 matches
  - record source branch, path, blob SHA-1, file SHA-256, manifest entry
  - classify VERIFIED_PRESENT / FOUND_ON_OTHER_SNAPSHOT / CHECKSUM_MISMATCH / NOT_FOUND
No repository state is modified: only ls-tree and cat-file are used.
"""
import subprocess, hashlib, json, os, sys
from collections import defaultdict

GIT_DIR = "/app/recovery/foot.git"
INC = "/app/recovery/incoming"
OUT = "/app/recovery/report"
os.makedirs(OUT, exist_ok=True)

PRIORITY = ["conflict_100826_2113", "conflict_100826_1941",
            "conflict_100826_1738", "conflict_100826_2258"]

def git(*args, binary=False):
    r = subprocess.run(["git", "--git-dir", GIT_DIR] + list(args),
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"git {args}: {r.stderr.decode()[:300]}")
    return r.stdout if binary else r.stdout.decode()

# 1. Enumerate refs to search: all 22 conflict branches (priority first), then main refs
all_refs = []
for line in git("show-ref").splitlines():
    sha, ref = line.split()
    if "conflict_" in ref or ref in ("refs/remotes/origin/main", "refs/heads/main"):
        all_refs.append((ref.split("/")[-1] if "conflict_" in ref else ref, ref, sha))
# order: priority conflicts, other conflicts, mains
def order_key(t):
    name = t[0]
    if name in PRIORITY: return (0, PRIORITY.index(name))
    if name.startswith("conflict_"): return (1, name)
    return (2, name)
all_refs.sort(key=order_key)

# 2. Build blob->[(branch, path)] map across all searched refs
blob_locs = defaultdict(list)   # blob sha1 -> list of (branch, path)
branch_paths = {}               # branch -> {path: blob}
for name, ref, tip in all_refs:
    paths = {}
    for line in git("ls-tree", "-r", ref).splitlines():
        meta, path = line.split("\t", 1)
        mode, otype, blob = meta.split()
        if otype != "blob":
            continue
        paths[path] = blob
        blob_locs[blob].append((name, path))
    branch_paths[name] = paths

unique_blobs = list(blob_locs.keys())
sys.stderr.write(f"refs searched: {len(all_refs)}; unique blobs: {len(unique_blobs)}\n")

# 3. SHA-256 every unique blob via cat-file --batch (streaming)
blob_sha256 = {}
proc = subprocess.Popen(["git", "--git-dir", GIT_DIR, "cat-file", "--batch"],
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE)
for i, b in enumerate(unique_blobs):
    proc.stdin.write((b + "\n").encode()); proc.stdin.flush()
    hdr = proc.stdout.readline().decode().strip()
    parts = hdr.split()
    size = int(parts[2])
    data = proc.stdout.read(size)
    proc.stdout.read(1)  # trailing newline
    blob_sha256[b] = hashlib.sha256(data).hexdigest()
proc.stdin.close(); proc.wait()

sha256_to_blobs = defaultdict(list)
for b, h in blob_sha256.items():
    sha256_to_blobs[h].append(b)

# 4. Load manifest targets
def load_manifest(fname):
    entries = []
    with open(os.path.join(INC, fname)) as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue
            h, p = line.split(None, 1)
            p = p.strip().lstrip("*")
            if p.startswith("./"): p = p[2:]
            entries.append((h, p))
    return entries

m149 = load_manifest("handoff-MANIFEST-149.sha256")
m80  = load_manifest("handoff-MANIFEST-80.sha256")

# 5. Classify each entry
def suffix_match(repo_path, rel_path):
    return repo_path == rel_path or repo_path.endswith("/" + rel_path)

def classify(entries, manifest_name):
    rows = []
    for h, rel in entries:
        matches = []   # (branch, path, blob, exact_path)
        for b in sha256_to_blobs.get(h, []):
            for (branch, path) in blob_locs[b]:
                matches.append({"branch": branch, "path": path, "blob": b,
                                "path_match": suffix_match(path, rel)})
        # path-existence probe (for CHECKSUM_MISMATCH)
        path_hits = []  # same rel path present but different content
        for branch, paths in branch_paths.items():
            for p, blob in paths.items():
                if suffix_match(p, rel) and blob_sha256.get(blob) != h:
                    path_hits.append({"branch": branch, "path": p, "blob": blob,
                                      "sha256": blob_sha256.get(blob)})
        if matches:
            pm = [m for m in matches if m["path_match"]]
            on_priority = any(m["branch"] in PRIORITY for m in (pm or matches))
            if pm:
                status = "VERIFIED_PRESENT"
            else:
                status = "FOUND_ON_OTHER_SNAPSHOT"  # content found, different path
        elif path_hits:
            status = "CHECKSUM_MISMATCH"
            on_priority = any(m["branch"] in PRIORITY for m in path_hits)
        else:
            status = "NOT_FOUND"
            on_priority = False
        rows.append({
            "manifest": manifest_name, "sha256": h, "entry_path": rel,
            "status": status, "on_priority_branch": on_priority,
            "matches": matches[:50], "mismatched_path_hits": path_hits[:20],
        })
    return rows

rows149 = classify(m149, "handoff-MANIFEST-149")
rows80  = classify(m80,  "handoff-MANIFEST-80")

with open(os.path.join(OUT, "recovery-matrix.json"), "w") as f:
    json.dump({"rows149": rows149, "rows80": rows80}, f, indent=1)

def summarize(rows, label):
    c = defaultdict(int)
    for r in rows: c[r["status"]] += 1
    print(f"{label}: total={len(rows)} " +
          " ".join(f"{k}={v}" for k, v in sorted(c.items())))
    for r in rows:
        if r["status"] != "VERIFIED_PRESENT":
            print(f"  [{r['status']}] {r['entry_path']} ({r['sha256'][:12]})")

summarize(rows149, "MANIFEST-149")
summarize(rows80, "MANIFEST-80")
