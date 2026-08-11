#!/usr/bin/env python3
"""Pass 3 (final): full location + classification matrix.
For every manifest entry:
  - locate every blob whose SHA-256 matches, across ALL commits of ALL branches
  - record source branch(es), path(s), introducing commit, blob SHA-1
  - classify: VERIFIED_PRESENT (at expected rel-path on a snapshot branch, tip or history)
              FOUND_ON_OTHER_SNAPSHOT (byte-identical content at another path/branch only)
              CHECKSUM_MISMATCH (expected path exists somewhere, content never matches)
              NOT_FOUND (no content match, no path match anywhere in any history)
Read-only."""
import subprocess, hashlib, json, os
from collections import defaultdict

GIT_DIR = "/app/recovery/foot.git"
INC = "/app/recovery/incoming"
OUT = "/app/recovery/report"
PRIORITY = ["conflict_100826_2113", "conflict_100826_1941",
            "conflict_100826_1738", "conflict_100826_2258"]

def git(*args):
    r = subprocess.run(["git", "--git-dir", GIT_DIR] + list(args),
                       capture_output=True, text=True)
    return r.stdout

# ---- refs of interest (22 conflict + mains) ----
refs = {}
for line in git("show-ref").splitlines():
    sha, ref = line.split()
    if "conflict_" in ref:
        refs[ref.split("/")[-1]] = ref
refs["origin/main"] = "refs/remotes/origin/main"
refs["main(local)"] = "refs/heads/main"

# ---- build blob -> set of (branch, path) across FULL history of each ref ----
# enumerate every commit per ref, ls-tree each unique tree once
commit_branches = defaultdict(set)
for name, ref in refs.items():
    for c in git("rev-list", ref).splitlines():
        commit_branches[c].add(name)

tree_cache = {}
blob_locs = defaultdict(set)     # blob -> {(branch, path, commit)} (first-seen commit per branch/path)
seen_pair = set()
# iterate commits in topological (newest first); to keep volume sane record (branch,path,blob) once
for c, branches in commit_branches.items():
    troot = git("rev-parse", f"{c}^{{tree}}").strip()
    if troot in tree_cache:
        entries = tree_cache[troot]
    else:
        entries = []
        for line in git("ls-tree", "-r", troot).splitlines():
            meta, path = line.split("\t", 1)
            mode, otype, blob = meta.split()
            if otype == "blob":
                entries.append((path, blob))
        tree_cache[troot] = entries
    for path, blob in entries:
        for br in branches:
            key = (blob, br, path)
            if key not in seen_pair:
                seen_pair.add(key)
                blob_locs[blob].add((br, path, c))

print(f"commits: {len(commit_branches)}; unique trees: {len(tree_cache)}; "
      f"blob-branch-path tuples: {len(seen_pair)}")

# ---- sha256 of all blobs present in locations ----
all_blobs = list(blob_locs.keys())
blob_sha256 = {}
proc = subprocess.Popen(["git", "--git-dir", GIT_DIR, "cat-file", "--batch"],
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE)
for b in all_blobs:
    proc.stdin.write((b + "\n").encode()); proc.stdin.flush()
    hdr = proc.stdout.readline().decode().split()
    size = int(hdr[2])
    data = proc.stdout.read(size); proc.stdout.read(1)
    blob_sha256[b] = hashlib.sha256(data).hexdigest()
proc.stdin.close(); proc.wait()

sha_to_blob = defaultdict(list)
for b, h in blob_sha256.items():
    sha_to_blob[h].append(b)

# path index for mismatch detection
path_index = defaultdict(list)   # path -> [(branch, blob)]
for b, locs in blob_locs.items():
    for br, p, c in locs:
        path_index[p].append((br, b))

def load_manifest(fname):
    out = []
    with open(os.path.join(INC, fname)) as f:
        for line in f:
            if not line.strip(): continue
            h, p = line.rstrip("\n").split(None, 1)
            p = p.strip().lstrip("*")
            if p.startswith("./"): p = p[2:]
            out.append((h, p))
    return out

def suffix(rp, rel):
    return rp == rel or rp.endswith("/" + rel)

def classify(entries, mname):
    rows = []
    for h, rel in entries:
        content_hits = []
        for b in sha_to_blob.get(h, []):
            for br, p, c in sorted(blob_locs[b]):
                content_hits.append({"branch": br, "path": p, "commit": c,
                                     "blob": b, "path_match": suffix(p, rel)})
        if content_hits:
            pm = [x for x in content_hits if x["path_match"]]
            chosen = pm or content_hits
            status = "VERIFIED_PRESENT" if pm else "FOUND_ON_OTHER_SNAPSHOT"
            pr = sorted({x["branch"] for x in chosen if x["branch"] in PRIORITY})
            rows.append({"manifest": mname, "sha256": h, "entry_path": rel,
                         "status": status,
                         "priority_branches": pr,
                         "locations": chosen[:40],
                         "alt_locations": (content_hits if pm else [])[:0]})
            continue
        # no content match anywhere in any history
        mism = []
        for p, brs in path_index.items():
            if suffix(p, rel):
                for br, b in brs:
                    mism.append({"branch": br, "path": p, "blob": b,
                                 "sha256": blob_sha256[b]})
        status = "CHECKSUM_MISMATCH" if mism else "NOT_FOUND"
        rows.append({"manifest": mname, "sha256": h, "entry_path": rel,
                     "status": status, "priority_branches": [],
                     "mismatched": mism[:15]})
    return rows

m149 = load_manifest("handoff-MANIFEST-149.sha256")
m80  = load_manifest("handoff-MANIFEST-80.sha256")
rows = classify(m149, "149") + classify(m80, "80")

with open(os.path.join(OUT, "recovery-matrix-full.json"), "w") as f:
    json.dump(rows, f, indent=1)

from collections import Counter
for label in ("149", "80"):
    sub = [r for r in rows if r["manifest"] == label]
    c = Counter(r["status"] for r in sub)
    print(f"MANIFEST-{label}: total={len(sub)} {dict(c)}")

# TSV matrix
with open(os.path.join(OUT, "recovery-matrix.tsv"), "w") as f:
    f.write("manifest\tstatus\tentry_path\tsha256\tsource_branch\tsource_path\tblob_sha1\tcommit\tbyte_identical\n")
    for r in rows:
        locs = r.get("locations") or []
        if locs:
            l0 = locs[0]
            f.write(f"{r['manifest']}\t{r['status']}\t{r['entry_path']}\t{r['sha256']}\t"
                    f"{l0['branch']}\t{l0['path']}\t{l0['blob']}\t{l0['commit'][:12]}\tYES\n")
        else:
            f.write(f"{r['manifest']}\t{r['status']}\t{r['entry_path']}\t{r['sha256']}\t-\t-\t-\t-\tNO\n")
print("wrote recovery-matrix-full.json and recovery-matrix.tsv")
