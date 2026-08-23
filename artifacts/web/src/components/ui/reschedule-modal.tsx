import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  useGetProviderSlots,
  useUpdateBookingStatus,
  useCreateRescheduleRequest,
} from '@workspace/api-client-react';
import { X, CalendarDays, Clock, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface Service {
  id: number;
  title: string;
  priceCents: number;
  durationMinutes: number;
}

interface RescheduleModalProps {
  bookingId: number;
  providerId: number;
  /** Name shown in the header subtitle — the provider's name in the client
   *  flow, the client's name in the provider (portal) flow. */
  providerName: string;
  service: Service;
  /** ISO datetime of the current appointment — never reusable as the new time. */
  currentScheduledAt: string;
  /**
   * Which side of the booking is rescheduling. Copy-only switch — the server
   * enforces every rule identically for both roles. Defaults to 'client' so
   * existing usage is unchanged.
   */
  perspective?: 'client' | 'provider';
  onClose: () => void;
  /** Called after the server accepts the new time. */
  onSuccess: () => void;
}

/** Local YYYY-MM-DD for a Date (used for the date picker default + bounds). */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Client reschedule flow — mirrors the canonical BookingModal slot-selection
 * pattern (real server-provided slots only; no arbitrary datetime entry).
 * The server remains authoritative: every safety rule (authorization, state,
 * availability, overlap, duplicates, service status) is re-checked by the
 * rescheduling endpoint; this UI only provides friendly paths and recovery.
 */
export default function RescheduleModal({
  bookingId,
  providerId,
  providerName,
  service,
  currentScheduledAt,
  perspective = 'client',
  onClose,
  onSuccess,
}: RescheduleModalProps) {
  const isProvider = perspective === 'provider';
  const today = useMemo(() => toDateInput(new Date()), []);
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const {
    data: slotsRes,
    isLoading: loadingSlots,
    refetch: refetchSlots,
  } = useGetProviderSlots(
    providerId,
    { serviceId: service.id, date },
    { query: { queryKey: ['reschedule-slots', providerId, service.id, date] } },
  );

  const timezone = slotsRes?.timezone;
  const slots = slotsRes?.slots ?? [];
  const currentMs = useMemo(() => Date.parse(currentScheduledAt), [currentScheduledAt]);

  const updateStatus = useUpdateBookingStatus();
  // Provider path: consent-first PROPOSAL — the client's confirmed time is
  // never changed here. One idempotency key per modal open, so a network
  // retry can never create a second proposal.
  const createProposal = useCreateRescheduleRequest();
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [reason, setReason] = useState('');
  const submitting = updateStatus.isPending || createProposal.isPending;

  // Accessibility: focus enters the dialog on open; Escape closes it (but
  // never mid-submit, so a double-press cannot orphan an in-flight request).
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, submitting]);

  const slotLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone } : {}),
    });

  const currentLabel = useMemo(
    () =>
      new Date(currentScheduledAt).toLocaleString('en-CA', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        ...(timezone ? { timeZone: timezone } : {}),
      }),
    [currentScheduledAt, timezone],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Duplicate-submit protection: the button is disabled while pending, and
    // this guard covers keyboard/Enter re-entry.
    if (submitting) return;
    if (!selectedSlot) {
      toast.error('Please choose an available time slot.');
      return;
    }
    // The old appointment time is never submittable as the new time.
    if (Date.parse(selectedSlot) === currentMs) {
      toast.error('That is your current appointment time. Please pick a different slot.');
      setSelectedSlot(null);
      return;
    }

    if (isProvider) {
      // Consent-first: create a pending proposal — the client must accept it.
      createProposal.mutate(
        {
          bookingId,
          data: {
            proposedScheduledAt: selectedSlot,
            idempotencyKey,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          },
        },
        {
          onSuccess: () => {
            toast.success('Time proposed — the client has been asked to confirm it. Their current appointment stays until they do.');
            onSuccess();
          },
          onError: (err: unknown) => {
            const apiError = err as { status?: number; data?: { error?: string } | null };
            const statusCode = apiError.status;
            const serverMessage = apiError.data?.error ?? '';
            if (
              serverMessage.includes('overlaps another appointment') ||
              serverMessage.includes("outside this provider's availability")
            ) {
              toast.info('That time is no longer available. Please choose another slot.');
              setSelectedSlot(null);
              void refetchSlots();
              return;
            }
            if (serverMessage.includes('already have an active request')) {
              toast.info('This client already has a booking for that exact time. Please pick a different slot.');
              setSelectedSlot(null);
              return;
            }
            if (serverMessage.includes("already awaiting the client's response")) {
              toast.info('A proposal is already awaiting this client — they need to respond first.');
              onClose();
              return;
            }
            if (serverMessage.includes('limit of provider time-change proposals')) {
              toast.error(serverMessage);
              onClose();
              return;
            }
            if (serverMessage.includes('no longer offered')) {
              toast.error('This service is no longer offered, so the booking cannot be rescheduled.');
              onClose();
              return;
            }
            if (statusCode === 409) {
              toast.info('This booking can no longer be rescheduled — refreshing.');
              onClose();
              return;
            }
            if (statusCode === 400 && serverMessage) {
              toast.error(serverMessage);
              setSelectedSlot(null);
              void refetchSlots();
              return;
            }
            toast.error('Could not propose a new time. Please try again.');
          },
        },
      );
      return;
    }

    updateStatus.mutate(
      {
        bookingId,
        data: { status: 'rescheduled', scheduledAt: selectedSlot },
      },
      {
        onSuccess: () => {
          toast.success('New time requested — your provider will confirm the change.');
          onSuccess();
        },
        onError: (err: unknown) => {
          const apiError = err as { status?: number; data?: { error?: string } | null };
          const statusCode = apiError.status;
          const serverMessage = apiError.data?.error ?? '';

          // The slot was just taken (another client), or the exact time now
          // collides with one of your own active bookings, or availability
          // changed. Recover in place: clear the pick and refresh the grid.
          if (
            serverMessage.includes('overlaps another appointment') ||
            serverMessage.includes("outside this provider's availability")
          ) {
            toast.info('That time is no longer available. Please choose another slot.');
            setSelectedSlot(null);
            void refetchSlots();
            return;
          }
          if (serverMessage.includes('already have an active request')) {
            toast.info(
              isProvider
                ? 'This client already has a booking for that exact time. Please pick a different slot.'
                : 'You already have a booking for that exact time. Please pick a different slot.',
            );
            setSelectedSlot(null);
            return;
          }
          // Service was deactivated, or the booking state changed underneath
          // us (e.g. the provider cancelled). Close and let the detail page
          // refresh to the safe, current state.
          if (serverMessage.includes('no longer offered')) {
            toast.error('This service is no longer offered, so the booking cannot be rescheduled.');
            onClose();
            return;
          }
          if (statusCode === 409) {
            toast.info('This booking can no longer be rescheduled — refreshing.');
            onClose();
            return;
          }
          if (statusCode === 403) {
            toast.error('You do not have access to this booking.');
            onClose();
            return;
          }
          if (statusCode === 400 && serverMessage) {
            toast.error(serverMessage);
            setSelectedSlot(null);
            void refetchSlots();
            return;
          }
          toast.error('Could not reschedule. Please try again.');
        },
      },
    );
  };

  return (
    <div
      data-testid="reschedule-modal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-modal-title"
        className="w-full max-w-[500px] bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[90dvh]"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-border" />
        </div>

        <div className="px-6 pt-3 pb-4 flex items-start justify-between border-b border-border">
          <div>
            <h2 id="reschedule-modal-title" className="text-xl font-serif font-bold text-foreground">
              Reschedule appointment
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {providerName} · {service.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1" data-testid="reschedule-current-time">
              Currently {currentLabel}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            data-testid="reschedule-modal-close"
            aria-label="Close reschedule dialog"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors mt-1 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Date */}
          <div>
            <label
              htmlFor="reschedule-date-input"
              className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"
            >
              <CalendarDays className="w-4 h-4 text-primary" aria-hidden="true" />
              Choose a new date <span className="text-destructive">*</span>
            </label>
            <input
              id="reschedule-date-input"
              data-testid="reschedule-date-input"
              type="date"
              required
              min={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSelectedSlot(null);
              }}
              className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
            />
            {timezone && (
              <p
                className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2"
                data-testid="reschedule-timezone-label"
              >
                <Globe className="w-3.5 h-3.5" aria-hidden="true" />
                Times shown in {timezone.replace(/_/g, ' ')}
              </p>
            )}
          </div>

          {/* Slot grid — real server-provided slots only */}
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2" id="reschedule-slots-label">
              <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
              Available times <span className="text-destructive">*</span>
            </p>
            {loadingSlots ? (
              <div className="py-6 flex justify-center" data-testid="reschedule-slots-loading" role="status" aria-label="Loading available times">
                <div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4" data-testid="reschedule-no-slots">
                No available times on this date. Try another day.
              </p>
            ) : (
              <div
                className="grid grid-cols-3 gap-2"
                data-testid="reschedule-slot-grid"
                role="group"
                aria-labelledby="reschedule-slots-label"
              >
                {slots.map((slot) => {
                  const isCurrent = Date.parse(slot.start) === currentMs;
                  const disabled = !slot.available || isCurrent;
                  const selected = selectedSlot === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      data-testid={`reschedule-slot-${slot.start}`}
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={
                        isCurrent
                          ? `${slotLabel(slot.start)} — current appointment time, unavailable`
                          : `${slotLabel(slot.start)}${slot.available ? '' : ' — unavailable'}`
                      }
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`px-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isCurrent
                          ? 'border-border bg-secondary text-muted-foreground/70 cursor-not-allowed'
                          : !slot.available
                            ? 'border-border bg-secondary text-muted-foreground/50 line-through cursor-not-allowed'
                            : selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-foreground hover:border-primary/50'
                      }`}
                    >
                      {slotLabel(slot.start)}
                      {isCurrent && <span className="block text-[10px] font-normal">current</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isProvider && (
            <div>
              <label
                htmlFor="reschedule-reason-input"
                className="text-sm font-semibold text-foreground mb-2 block"
              >
                Reason shared with the client (optional)
              </label>
              <textarea
                id="reschedule-reason-input"
                data-testid="reschedule-reason-input"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. An earlier visit ran long — would this time work instead?"
                className="w-full border border-border rounded-xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm resize-none"
              />
            </div>
          )}

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{service.title}</span>
              <span className="font-semibold text-foreground">${(service.priceCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {service.durationMinutes} minutes · {isProvider ? 'the address stays the same' : 'your address stays the same'}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border">
          <button
            data-testid="reschedule-submit-button"
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || !selectedSlot}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg shadow-md disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {submitting ? (
              <>
                <span
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                {isProvider ? 'Proposing new time…' : 'Requesting new time…'}
              </>
            ) : (
              isProvider ? 'Propose new time' : 'Confirm new time'
            )}
          </button>
          <p className="text-center text-xs text-muted-foreground mt-3">
            {isProvider
              ? 'The client must accept before anything changes — their current appointment stays until they do.'
              : 'Your provider will confirm the new time. Your current appointment stays until they do.'}
          </p>
        </div>
      </div>
    </div>
  );
}
