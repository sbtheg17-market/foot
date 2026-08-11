import { useEffect, useState } from "react";
import axios from "axios";
import { FileDiff, GitCommitHorizontal, Loader2, BadgeCheck, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * PatchIndex — meta-infrastructure page listing every published patch:
 * name, commit hash, files touched, and recorded test evidence.
 * Data comes from GET /api/patches, which parses the REAL patches/*.patch
 * files on disk and merges evidence from patches/INDEX.json.
 */
export default function PatchIndex() {
  const [patches, setPatches] = useState(null);
  const [error, setError] = useState(null);
  const [openFiles, setOpenFiles] = useState({});

  useEffect(() => {
    axios
      .get(`${API}/patches`)
      .then((res) => setPatches(res.data))
      .catch(() => setError("Could not load the patch index."));
  }, []);

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

        {patches && patches.length > 0 && (
          <ol data-testid="patch-index-list" className="space-y-4">
            {patches.map((p) => {
              const filesOpen = !!openFiles[p.name];
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
                          (p.approval.includes("CAVEAT")
                            ? "bg-amber-50 text-amber-800"
                            : "bg-emerald-50 text-emerald-800")
                        }
                      >
                        {p.approval.includes("CAVEAT") ? (
                          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                        ) : (
                          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
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
