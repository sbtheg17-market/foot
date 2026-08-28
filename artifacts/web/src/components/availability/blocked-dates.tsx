import React, { useState } from 'react';
import {
  useListMyAvailabilityExceptions,
  useCreateMyAvailabilityException,
  useDeleteMyAvailabilityException,
} from '@workspace/api-client-react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const EXCEPTIONS_QUERY_KEY = ['my-availability-exceptions'];

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: string } } | null)?.data;
  return typeof data?.error === 'string' && data.error ? data.error : fallback;
}

/** "YYYY-MM-DD" → human label; anchored at local noon to avoid TZ day shift. */
export function blockedDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BlockedDates() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyAvailabilityExceptions({
    query: { queryKey: EXCEPTIONS_QUERY_KEY },
  });
  const createException = useCreateMyAvailabilityException();
  const deleteException = useDeleteMyAvailabilityException();

  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const exceptions = data?.exceptions ?? [];
  const pending = createException.isPending || deleteException.isPending;

  const handleAdd = () => {
    if (!date) {
      toast.error('Pick a date to block');
      return;
    }
    createException.mutate(
      { data: { date, ...(reason.trim() ? { reason: reason.trim() } : {}) } },
      {
        onSuccess: () => {
          toast.success('Date blocked');
          setDate('');
          setReason('');
          queryClient.invalidateQueries({ queryKey: EXCEPTIONS_QUERY_KEY });
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Failed to block date')),
      }
    );
  };

  const handleDelete = (exceptionId: number) => {
    deleteException.mutate(
      { exceptionId },
      {
        onSuccess: () => {
          toast.success('Blocked date removed');
          queryClient.invalidateQueries({ queryKey: EXCEPTIONS_QUERY_KEY });
        },
        onError: (err) => toast.error(apiErrorMessage(err, 'Failed to remove blocked date')),
      }
    );
  };

  return (
    <section data-testid="blocked-dates-section" className="mt-10 bg-card border border-border rounded-3xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <CalendarOff className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="font-serif font-semibold text-lg">Blocked dates</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4" data-testid="blocked-dates-explainer">
        Block days off (vacation, courses, personal days). Clients can't book you on a
        blocked date. Existing bookings are not cancelled — reschedule or cancel them
        separately.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <label className="flex-1">
          <span className="sr-only">Date to block</span>
          <input
            type="date"
            value={date}
            min={localToday()}
            onChange={(e) => setDate(e.target.value)}
            data-testid="blocked-date-input"
            className="bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium w-full outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </label>
        <label className="flex-[2]">
          <span className="sr-only">Reason (optional, private)</span>
          <input
            type="text"
            value={reason}
            maxLength={200}
            placeholder="Reason (optional, only you see this)"
            onChange={(e) => setReason(e.target.value)}
            data-testid="blocked-date-reason-input"
            className="bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium w-full outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={pending}
          data-testid="blocked-date-add-btn"
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold shadow-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-50 shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Block date
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-3" data-testid="blocked-dates-loading">
          Loading blocked dates…
        </div>
      ) : exceptions.length === 0 ? (
        <div
          data-testid="blocked-dates-empty"
          className="text-sm font-medium text-muted-foreground bg-secondary/30 rounded-2xl py-4 text-center border border-dashed border-border"
        >
          No blocked dates — your weekly schedule applies as usual.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="blocked-dates-list">
          {exceptions.map((ex) => (
            <li
              key={ex.id}
              data-testid={`blocked-date-row-${ex.id}`}
              className="flex items-center gap-3 bg-secondary/50 p-3 rounded-2xl border border-border/50"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{blockedDateLabel(ex.date)}</div>
                {ex.reason ? (
                  <div className="text-xs text-muted-foreground truncate">{ex.reason}</div>
                ) : null}
              </div>
              <button
                onClick={() => handleDelete(ex.id)}
                disabled={pending}
                aria-label={`Remove blocked date ${ex.date}`}
                data-testid={`blocked-date-delete-btn-${ex.id}`}
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
