import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMyBlockedRanges,
  useCreateBlockedRange,
  useDeleteBlockedRange,
} from '@workspace/api-client-react';
import { CalendarOff, Trash2, Lock, X } from 'lucide-react';
import { toast } from 'sonner';

const RANGES_QUERY_KEY = ['my-blocked-ranges'];

/** Local YYYY-MM-DD for a Date (date-input default/min). */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-07-05" → "Sun, Jul 5" without timezone drift. */
function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Inclusive range label: single day or "start – end". */
export function formatRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) return formatDay(startDate);
  return `${formatDay(startDate)} – ${formatDay(endDate)}`;
}

interface ApiError {
  status?: number;
  data?: { error?: string } | null;
}

/**
 * Blocked ranges (vacation / time off) — block a continuous date range in
 * one step. Clients cannot book any day in the range; the note stays
 * private (docs/availability-exceptions-policy.md).
 */
export default function BlockedRangesSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyBlockedRanges({
    query: { queryKey: RANGES_QUERY_KEY },
  });
  const createRange = useCreateBlockedRange();
  const deleteRange = useDeleteBlockedRange();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    startDate: toDateInput(new Date()),
    endDate: toDateInput(new Date()),
    reason: '',
  });

  const ranges = data?.ranges ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const reason = form.reason.trim();
    createRange.mutate(
      {
        data: {
          startDate: form.startDate,
          endDate: form.endDate,
          ...(reason.length > 0 ? { reason } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Time off blocked');
          setShowForm(false);
          setForm((f) => ({ ...f, reason: '' }));
          queryClient.invalidateQueries({ queryKey: RANGES_QUERY_KEY });
        },
        onError: (err: unknown) => {
          toast.error((err as ApiError).data?.error ?? 'Could not block this time off. Please try again.');
        },
      },
    );
  };

  const handleDelete = (rangeId: number) => {
    deleteRange.mutate(
      { rangeId },
      {
        onSuccess: () => {
          toast.success('Time off deleted — those days are bookable again');
          queryClient.invalidateQueries({ queryKey: RANGES_QUERY_KEY });
        },
        onError: (err: unknown) => {
          toast.error((err as ApiError).data?.error ?? 'Could not delete this time off. Please try again.');
        },
      },
    );
  };

  return (
    <section className="mt-10" data-testid="blocked-ranges-section" aria-labelledby="blocked-ranges-heading">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 id="blocked-ranges-heading" className="text-2xl font-serif font-bold text-foreground">
            Time off
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Block a date range in one step — vacation, a course, family time. Clients can't book any day in the range.
          </p>
        </div>
        <button
          type="button"
          data-testid="blocked-range-add-btn"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="shrink-0 bg-primary/10 text-primary px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors active:scale-[0.98]"
        >
          {showForm ? <X className="w-4 h-4" aria-hidden="true" /> : <CalendarOff className="w-4 h-4" aria-hidden="true" />}
          {showForm ? 'Close' : 'Block time off'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          data-testid="blocked-range-form"
          className="bg-card border border-border rounded-3xl p-5 shadow-sm mb-5 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="blocked-range-start" className="block text-sm font-semibold text-foreground mb-1.5">
                First day off
              </label>
              <input
                id="blocked-range-start"
                data-testid="blocked-range-start-input"
                type="date"
                required
                min={toDateInput(new Date())}
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="blocked-range-end" className="block text-sm font-semibold text-foreground mb-1.5">
                Last day off
              </label>
              <input
                id="blocked-range-end"
                data-testid="blocked-range-end-input"
                type="date"
                required
                min={form.startDate}
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          <div>
            <label htmlFor="blocked-range-reason" className="block text-sm font-semibold text-foreground mb-1.5">
              Private note <span className="font-normal text-muted-foreground">(optional — only you see this)</span>
            </label>
            <input
              id="blocked-range-reason"
              data-testid="blocked-range-reason-input"
              type="text"
              maxLength={200}
              placeholder="e.g. Vacation, training course"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="w-full bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <p className="text-xs text-muted-foreground bg-secondary/40 border border-border/60 rounded-2xl p-3">
            Both days are included. If appointments or emergency openings already sit inside the range, blocking is
            refused with an honest message — nothing is ever cancelled for you.
          </p>

          <button
            type="submit"
            data-testid="blocked-range-submit-btn"
            disabled={createRange.isPending}
            className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-semibold shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {createRange.isPending ? 'Blocking…' : 'Block these days'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center" data-testid="blocked-ranges-loading">
          <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : ranges.length === 0 ? (
        <div
          data-testid="blocked-ranges-empty"
          className="text-sm font-medium text-muted-foreground bg-secondary/30 rounded-2xl py-5 text-center border border-dashed border-border"
        >
          No upcoming time off.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="blocked-ranges-list">
          {ranges.map((range) => (
            <li
              key={range.id}
              data-testid={`blocked-range-row-${range.id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">
                  {formatRangeLabel(range.startDate, range.endDate)}
                </p>
                {range.reason && (
                  <p
                    data-testid={`blocked-range-reason-${range.id}`}
                    className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5"
                  >
                    <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{range.reason}</span>
                    <span className="shrink-0 text-muted-foreground/70">· private</span>
                  </p>
                )}
              </div>
              <button
                type="button"
                data-testid={`blocked-range-delete-${range.id}`}
                aria-label={`Delete time off ${formatRangeLabel(range.startDate, range.endDate)}`}
                disabled={deleteRange.isPending}
                onClick={() => handleDelete(range.id)}
                className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
