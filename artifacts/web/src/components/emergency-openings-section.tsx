import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListMyEmergencyOpenings,
  useCreateEmergencyOpening,
  useDeleteEmergencyOpening,
  useListMyServices,
} from '@workspace/api-client-react';
import { CalendarPlus, Trash2, Zap, X } from 'lucide-react';
import { toast } from 'sonner';

const OPENINGS_QUERY_KEY = ['my-emergency-openings'];

/** Local YYYY-MM-DD for a Date (date-input default/min). */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "2026-07-05" → "Sun, Jul 5" without timezone drift. */
export function formatOpeningDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface ApiError {
  status?: number;
  data?: { error?: string } | null;
}

/**
 * Emergency openings — one-off extra slots outside the weekly schedule.
 * Truthful copy only: "urgent only" is a provider-set label; the booking
 * flow is unchanged (docs/emergency-openings-policy.md).
 */
export default function EmergencyOpeningsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyEmergencyOpenings({
    query: { queryKey: OPENINGS_QUERY_KEY },
  });
  const { data: servicesRes } = useListMyServices({
    query: { queryKey: ['my-services'] },
  });
  const createOpening = useCreateEmergencyOpening();
  const deleteOpening = useDeleteEmergencyOpening();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: toDateInput(new Date()),
    startTime: '18:00',
    endTime: '20:00',
    urgentOnly: false,
    serviceIds: [] as number[],
  });

  const openings = data?.openings ?? [];
  const services = (servicesRes?.services ?? []).filter((s) => s.isActive);

  const serviceLabel = (ids?: number[] | null) => {
    if (!ids || ids.length === 0) return 'All services';
    const titles = ids
      .map((id) => services.find((s) => s.id === id)?.title)
      .filter(Boolean);
    return titles.length > 0 ? titles.join(', ') : `${ids.length} selected service${ids.length === 1 ? '' : 's'}`;
  };

  const toggleService = (id: number) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createOpening.mutate(
      {
        data: {
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          urgentOnly: form.urgentOnly,
          ...(form.serviceIds.length > 0 ? { serviceIds: form.serviceIds } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Emergency opening added');
          setShowForm(false);
          setForm((f) => ({ ...f, urgentOnly: false, serviceIds: [] }));
          queryClient.invalidateQueries({ queryKey: OPENINGS_QUERY_KEY });
        },
        onError: (err: unknown) => {
          toast.error((err as ApiError).data?.error ?? 'Could not add the opening. Please try again.');
        },
      },
    );
  };

  const handleDelete = (openingId: number) => {
    deleteOpening.mutate(
      { openingId },
      {
        onSuccess: () => {
          toast.success('Emergency opening deleted');
          queryClient.invalidateQueries({ queryKey: OPENINGS_QUERY_KEY });
        },
        onError: (err: unknown) => {
          toast.error((err as ApiError).data?.error ?? 'Could not delete the opening. Please try again.');
        },
      },
    );
  };

  return (
    <section className="mt-10" data-testid="emergency-openings-section" aria-labelledby="emergency-openings-heading">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 id="emergency-openings-heading" className="text-2xl font-serif font-bold text-foreground">
            Emergency openings
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            One-off extra time slots outside your weekly hours. Clients see them as regular bookable times.
          </p>
        </div>
        <button
          type="button"
          data-testid="emergency-opening-add-btn"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          className="shrink-0 bg-primary/10 text-primary px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-primary/20 transition-colors active:scale-[0.98]"
        >
          {showForm ? <X className="w-4 h-4" aria-hidden="true" /> : <CalendarPlus className="w-4 h-4" aria-hidden="true" />}
          {showForm ? 'Close' : 'Add opening'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          data-testid="emergency-opening-form"
          className="bg-card border border-border rounded-3xl p-5 shadow-sm mb-5 space-y-4"
        >
          <div>
            <label htmlFor="emergency-opening-date" className="block text-sm font-semibold text-foreground mb-1.5">
              Date
            </label>
            <input
              id="emergency-opening-date"
              data-testid="emergency-opening-date-input"
              type="date"
              required
              min={toDateInput(new Date())}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label htmlFor="emergency-opening-start" className="block text-sm font-semibold text-foreground mb-1.5">
                From
              </label>
              <input
                id="emergency-opening-start"
                data-testid="emergency-opening-start-input"
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="emergency-opening-end" className="block text-sm font-semibold text-foreground mb-1.5">
                To
              </label>
              <input
                id="emergency-opening-end"
                data-testid="emergency-opening-end-input"
                type="time"
                required
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full bg-card border border-border px-3 py-2.5 rounded-xl text-sm font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
          </div>

          {services.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold text-foreground mb-1.5">
                Limit to services <span className="font-normal text-muted-foreground">(optional — none selected = all)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {services.map((s) => {
                  const checked = form.serviceIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                        checked ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/40 text-foreground'
                      }`}
                    >
                      <input
                        type="checkbox"
                        data-testid={`emergency-opening-service-${s.id}`}
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleService(s.id)}
                      />
                      {s.title}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label className="flex items-start gap-3 bg-secondary/40 border border-border/60 rounded-2xl p-3 cursor-pointer">
            <input
              type="checkbox"
              data-testid="emergency-opening-urgent-checkbox"
              checked={form.urgentOnly}
              onChange={(e) => setForm((f) => ({ ...f, urgentOnly: e.target.checked }))}
              className="mt-0.5 w-4 h-4 accent-[var(--primary,#000)]"
            />
            <span className="text-sm">
              <span className="font-semibold text-foreground">Mark as urgent only</span>
              <span className="block text-muted-foreground mt-0.5">
                Adds an "urgent" label so clients know these times are meant for urgent visits. Booking works the same.
              </span>
            </span>
          </label>

          <button
            type="submit"
            data-testid="emergency-opening-submit-btn"
            disabled={createOpening.isPending}
            className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-semibold shadow-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {createOpening.isPending ? 'Adding…' : 'Add emergency opening'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center" data-testid="emergency-openings-loading">
          <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : openings.length === 0 ? (
        <div
          data-testid="emergency-openings-empty"
          className="text-sm font-medium text-muted-foreground bg-secondary/30 rounded-2xl py-5 text-center border border-dashed border-border"
        >
          No upcoming emergency openings.
        </div>
      ) : (
        <ul className="space-y-3" data-testid="emergency-openings-list">
          {openings.map((opening) => (
            <li
              key={opening.id}
              data-testid={`emergency-opening-row-${opening.id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">
                  {formatOpeningDate(opening.date)}
                  <span className="text-muted-foreground font-medium"> · {opening.startTime}–{opening.endTime}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{serviceLabel(opening.serviceIds)}</span>
                  {opening.urgentOnly && (
                    <span
                      data-testid={`emergency-opening-urgent-badge-${opening.id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-semibold"
                    >
                      <Zap className="w-3 h-3" aria-hidden="true" />
                      Urgent only
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                data-testid={`emergency-opening-delete-${opening.id}`}
                aria-label={`Delete emergency opening on ${formatOpeningDate(opening.date)}`}
                disabled={deleteOpening.isPending}
                onClick={() => handleDelete(opening.id)}
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
