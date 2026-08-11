import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FileDiff, GitCommitHorizontal, Loader2, BadgeCheck, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Shield } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * PatchIndex — meta-infrastructure page listing every published patch:
 * name, commit hash, files touched, and recorded test evidence.
 * Data comes from GET /api/patches, which parses the REAL patches/*.patch
 * files on disk and merges evidence from patches/INDEX.json.
 *
 * Approval filters: patches can be filtered by approval status so caveated
 * patches stand out — production-safe (emerald), caveat (amber), pending or
 * process-recorded (slate).
 */

// Classify an approval string into a filter bucket.
export function classifyApproval(approval) {
  if (!approval) return "pending";
  if (approval.includes("CAVEAT")) return "caveat";
  if (approval.trim().startsWith("Approved")) return "approved";
  if (approval.trim().startsWith("Pending")) return "pending";
  return "recorded";
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Production-safe" },
  { key: "caveat", label: "Caveat" },
  { key: "pending", label: "Pending" },
  { key: "recorded", label: "Recorded" },
];

export default function PatchIndex() {
  const [patches, setPatches] = useState(null);
  const [error, setError] = useState(null);
  const [openFiles, setOpenFiles] = useState({});
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    axios
      .get(`${API}/patches`)
      .then((res) => setPatches(res.data))
      .catch(() => setError("Could not load the patch index."));
  }, []);

  const counts = useMemo(() => {
    const c = { all: patches?.length || 0, approved: 0, caveat: 0, pending: 0, recorded: 0 };
    (patches || []).forEach((p) => {
      c[classifyApproval(p.approval)] += 1;
    });
    return c;
  }, [patches]);

  const visible = useMemo(() => {
    if (!patches) return null;
    if (filter === "all") return patches;
    return patches.filter((p) => classifyApproval(p.approval) === filter);
  }, [patches, filter]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-left">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
            <FileDiff className="text-white" size={22} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Patch index</h1>
            <p className="text-sm text-slate-500">
              One task → one commit → one patch · parsed live from <code className="rounded bg-slate-100 px-1 text-xs">patches/</code>
            </p>
          </div>
        </header>

        {/* Approval filters */}
        {patches && patches.length > 0 && (
          <div data-testid="patch-index-filters" className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const disabled = f.key !== "all" && counts[f.key] === 0;
              return (
                <button
                  key={f.key}
                  type="button"
                  data-testid={`patch-filter-${f.key}`}
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => setFilter(f.key)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : disabled
                        ? "cursor-not-allowed border-slate-200 bg-white text-slate-300"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100")
                  }
                >
                  {f.label}
                  <span className={"ml-1.5 " + (active ? "text-slate-300" : "text-slate-400")}>
                    {counts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p data-testid="patch-index-error" className="text-sm text-red-600">{error}</p>
        )}

        {!patches && !error && (
          <div data-testid="patch-index-loading" className="flex items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={16} /> Loading patches…
          </div>
        )}

        {patches && patches.length === 0 && (
          <p data-testid="patch-index-empty" className="text-sm text-slate-500">
            No patches recorded yet.
          </p>
        )}

        {visible && visible.length === 0 && patches && patches.length > 0 && (
          <p data-testid="patch-index-filter-empty" className="text-sm text-slate-500">
            No patches match this filter.
          </p>
        )}

        {visible && visible.length > 0 && (
          <ol data-testid="patch-index-list" className="space-y-4">
            {visible.map((p) => {
              const filesOpen = !!openFiles[p.name];
              const bucket = classifyApproval(p.approval);
              return (
                <li
                  key={p.name}
                  data-testid="patch-index-item"
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-100 px-5 py-4">
                    <h2 className="text-sm font-semibold text-slate-900">{p.subject}</h2>
                    <p className="mt-1 font-mono text-xs text-slate-500">{p.name}</p>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <GitCommitHorizontal size={14} className="text-slate-400" />
                        <code className="font-mono" title={p.commit || ""}>
                          {p.commit ? p.commit.slice(0, 10) : "—"}
                        </code>
                      </span>
                      <span>{p.date}</span>
                      <button
                        type="button"
                        data-testid="patch-index-files-toggle"
                        onClick={() =>
                          setOpenFiles((s) => ({ ...s, [p.name]: !s[p.name] }))
                        }
                        className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                      >
                        {p.files.length} file{p.files.length === 1 ? "" : "s"} touched
                        {filesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>
                    {filesOpen && (
                      <ul className="space-y-1 rounded-lg bg-slate-50 px-3 py-2">
                        {p.files.map((f) => (
                          <li key={f} className="font-mono text-xs text-slate-600">
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    {p.evidence && (
                      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-teal-700">
                        <BadgeCheck size={14} className="mt-0.5 shrink-0" />
                        <span>{p.evidence}</span>
                      </p>
                    )}
                    {p.approval && (
                      <p
                        data-testid="patch-index-approval"
                        className={
                          "flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed " +
                          (bucket === "caveat"
                            ? "bg-amber-50 text-amber-800"
                            : bucket === "approved"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-slate-100 text-slate-600")
                        }
                      >
                        {bucket === "caveat" ? (
                          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                        ) : bucket === "approved" ? (
                          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                        ) : (
                          <Shield size={14} className="mt-0.5 shrink-0" />
                        )}
                        <span>{p.approval}</span>
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
