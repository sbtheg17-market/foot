#!/usr/bin/env python3
"""Pass 2: hash EVERY blob in the object database (all history, all branches),
match against both handoff manifests, and locate matches (branch, commit, path).
Read-only: cat-file / rev-list / log only."""
import subprocess, hashlib, json, os
from collections import defaultdict

GIT_DIR = "/app/recovery/foot.git"
INC = "/app/recovery/incoming"
OUT = "/app/recovery/report"
PRIORITY = ["conflict_100826_2113", "conflict_100826_1941",
            "conflict_100826_1738", "conflict_100826_2258"]

def load_manifest(fname):
    entries = []
    with open(os.path.join(INC, fname)) as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip(): continue
            h, p = line.split(None, 1)
            p = p.strip().lstrip("*")
            if p.startswith("./"): p = p[2:]
            entries.append((h, p))
    return entries

m149 = load_manifest("handoff-MANIFEST-149.sha256")
m80  = load_manifest("handoff-MANIFEST-80.sha256")
targets = {h for h, _ in m149} | {h for h, _ in m80}
print(f"unique target sha256s: {len(targets)}")

# hash every blob in ODB
proc = subprocess.Popen(
    ["git", "--git-dir", GIT_DIR, "cat-file", "--batch-all-objects",
     "--batch", "--unordered"],
    stdout=subprocess.PIPE)
blob_sha256 = {}
n = 0
while True:
    hdr = proc.stdout.readline()
    if not hdr: break
    sha1, otype, size = hdr.decode().split()
    size = int(size)
    data = proc.stdout.read(size)
    proc.stdout.read(1)
    if otype == "blob":
        blob_sha256[sha1] = hashlib.sha256(data).hexdigest()
    n += 1
proc.wait()
print(f"objects scanned: {n}; blobs hashed: {len(blob_sha256)}")

sha256_to_blobs = defaultdict(list)
for b, h in blob_sha256.items():
    sha256_to_blobs[h].append(b)

hits = {h: sha256_to_blobs.get(h, []) for h in targets}
found = {h: bs for h, bs in hits.items() if bs}
print(f"target sha256s found anywhere in ODB: {len(found)} / {len(targets)}")

with open(os.path.join(OUT, "pass2-odb-hits.json"), "w") as f:
    json.dump({"found": found,
               "missing": sorted(h for h in targets if not hits[h])}, f, indent=1)

# Locate each found blob: which refs contain it, at which path
def locate(blob):
    r = subprocess.run(
        ["git", "--git-dir", GIT_DIR, "log", "--all", f"--find-object={blob}",
         "--format=%H", "--name-only", "--diff-filter=A"],
        capture_output=True, text=True)
    return r.stdout
locations = {}
for h, blobs in found.items():
    for b in blobs:
        # branches whose tip history contains blob
        r = subprocess.run(["git", "--git-dir", GIT_DIR, "branch", "-a",
                            "--contains"], capture_output=True, text=True)
        locations[b] = None  # resolved in pass3 per-branch tree scan
print("done pass2")
