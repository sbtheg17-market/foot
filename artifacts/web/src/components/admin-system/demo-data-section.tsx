import React, { useState } from 'react';
import { useGetAdminDemoData, usePurgeAdminDemoData } from '@workspace/api-client-react';
import { Trash2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

const CONFIRM_PHRASE = 'DELETE DEMO DATA';

/** Admin-only: shows seed/demo data still present and lets the admin purge it. */
export default function DemoDataSection() {
  const { data, isLoading, refetch } = useGetAdminDemoData();
  const purge = usePurgeAdminDemoData();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0;

  const onPurge = () => {
    purge.mutate(
      { data: { confirm: typed } },
      {
        onSuccess: (res) => {
          toast.success(`Removed ${res.removed.counts.users} demo accounts and ${res.removed.counts.bookings} sample bookings.`);
          setOpen(false);
          setTyped('');
          refetch();
        },
        onError: (err) => toast.error((err as { message?: string }).message ?? 'Purge failed.'),
      },
    );
  };

  return (
    <section data-testid="system-demo-data" className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
      <h2 className="flex items-center gap-2 font-serif font-bold text-lg text-foreground">
        <FlaskConical className="w-5 h-5 text-primary" aria-hidden="true" /> Demo data
      </h2>
      <p className="text-xs text-muted-foreground">
        Seed accounts (sarah, mike, jane, tom @oncallfoot.com and the QA provider) and everything they own. Admin accounts are never removed.
      </p>
      {isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="demo-data-loading">Checking…</p>
      ) : !data || data.counts.users === 0 ? (
        <p className="text-sm font-medium text-foreground" data-testid="demo-data-clean">No demo data present — the database only contains real accounts.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm" data-testid="demo-data-counts">
            {Object.entries(data.counts).map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</dt>
                <dd className="font-medium" data-testid={`demo-count-${k}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-wrap gap-2 text-xs" data-testid="demo-data-users">
            {data.users.map((u) => (
              <li key={u.id} className="rounded-full bg-secondary px-2.5 py-1 text-muted-foreground">{u.email} · {u.role}</li>
            ))}
          </ul>
          {!open ? (
            <button type="button" data-testid="demo-purge-open-btn" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5">
              <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove demo accounts &amp; sample bookings
            </button>
          ) : (
            <div role="alertdialog" aria-labelledby="demo-purge-title" data-testid="demo-purge-dialog" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
              <p id="demo-purge-title" className="text-sm font-semibold text-foreground">
                This permanently deletes {total} demo records across {data.counts.users} accounts. It cannot be undone.
              </p>
              <label className="block text-xs text-muted-foreground">
                Type <code className="font-mono bg-white px-1 rounded">{CONFIRM_PHRASE}</code> to confirm
                <input data-testid="demo-purge-confirm-input" value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-mono text-foreground" autoComplete="off" />
              </label>
              <div className="flex gap-2">
                <button type="button" data-testid="demo-purge-confirm-btn" disabled={typed !== CONFIRM_PHRASE || purge.isPending} onClick={onPurge} className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-40">
                  {purge.isPending ? 'Removing…' : 'Delete demo data'}
                </button>
                <button type="button" data-testid="demo-purge-cancel-btn" onClick={() => { setOpen(false); setTyped(''); }} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
