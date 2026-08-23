import React from 'react';
import {
  useListRescheduleRequests,
  useAcceptRescheduleRequest,
  useDeclineRescheduleRequest,
  useGetReschedulingHistory,
} from '@workspace/api-client-react';
import { CalendarClock, Check, History, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  bookingId: number;
  /** Client sees accept/decline; the provider sees a read-only pending state. */
  isClient: boolean;
  /** Authoritative marketplace timezone when known. */
  timezone?: string;
  /** Refetch the booking after a proposal is accepted/declined. */
  onChanged: () => void;
  /** Client-only: open the standard reschedule flow to pick another time. */
  onPickAnother?: () => void;
}

function formatInstant(iso: string, timezone?: string) {
  return new Date(iso).toLocaleString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

/**
 * Consent-first rescheduling: shows the pending provider proposal (original
 * time stays authoritative until the client accepts) and a compact
 * append-only history of accepted time changes.
 */
export default function RescheduleProposalCard({
  bookingId,
  isClient,
  timezone,
  onChanged,
  onPickAnother,
}: Props) {
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useListRescheduleRequests(bookingId, {
    query: { queryKey: ['reschedule-proposals', bookingId] },
  });
  const { data: historyData } = useGetReschedulingHistory(
    bookingId,
    { limit: 5 },
    { query: { queryKey: ['reschedule-history', bookingId] } },
  );

  const accept = useAcceptRescheduleRequest();
  const decline = useDeclineRescheduleRequest();
  const busy = accept.isPending || decline.isPending;

  const pending = data?.proposals.find((p) => p.status === 'pending');
  const history = historyData?.history ?? [];

  const handleMutationError = (err: unknown) => {
    const statusCode = (err as { status?: number }).status;
    if (statusCode === 409) {
      toast.info('This proposal was already resolved — refreshing.');
    } else {
      toast.error('Could not update the proposal. Please try again.');
    }
    void refetch();
    onChanged();
  };

  const handleAccept = () => {
    if (!pending || busy) return;
    accept.mutate(
      { requestId: pending.id },
      {
        onSuccess: () => {
          toast.success('New time confirmed — your appointment has been updated.');
          void refetch();
          onChanged();
        },
        onError: handleMutationError,
      },
    );
  };

  const handleDecline = () => {
    if (!pending || busy) return;
    decline.mutate(
      { requestId: pending.id },
      {
        onSuccess: (res) => {
          if (res.originalTimeFeasible) {
            toast.success('Proposal declined — your original appointment is unchanged.');
          } else {
            toast.warning(
              res.supportMessage ??
                'Your original time may no longer be available. Please contact support.',
            );
          }
          void refetch();
          onChanged();
        },
        onError: handleMutationError,
      },
    );
  };

  if (isLoading) return null;
  if (isError) {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"
        data-testid="reschedule-proposal-error"
      >
        Could not load reschedule proposals.{' '}
        <button className="font-semibold text-primary hover:underline" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (!pending && history.length === 0) return null;

  return (
    <div className="space-y-3">
      {pending && (
        <section
          role="region"
          aria-label="Pending reschedule proposal"
          data-testid="reschedule-proposal-card"
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
            {isClient ? 'Your provider proposed a new time' : 'Awaiting the client’s response'}
          </div>
          <p className="mt-2 text-sm text-foreground" data-testid="proposal-proposed-time">
            Proposed: <strong>{formatInstant(pending.proposedScheduledAt, timezone)}</strong>
          </p>
          <p className="text-xs text-muted-foreground" data-testid="proposal-original-time">
            Your current appointment ({formatInstant(pending.originalScheduledAt, timezone)}) stays
            until {isClient ? 'you respond' : 'the client responds'}.
          </p>
          {pending.reason && (
            <p className="mt-1 text-xs italic text-muted-foreground" data-testid="proposal-reason">
              “{pending.reason}”
            </p>
          )}
          <p className="mt-1 text-xs font-medium text-foreground/80" data-testid="proposal-deadline">
            Respond by {formatInstant(pending.deadlineAt, timezone)} — no change happens automatically.
          </p>
          {isClient && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleAccept}
                disabled={busy}
                data-testid="proposal-accept-button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {accept.isPending ? 'Accepting…' : 'Accept new time'}
              </button>
              <button
                onClick={handleDecline}
                disabled={busy}
                data-testid="proposal-decline-button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                {decline.isPending ? 'Declining…' : 'Keep my time'}
              </button>
              {onPickAnother && (
                <button
                  onClick={onPickAnother}
                  disabled={busy}
                  data-testid="proposal-pick-another"
                  className="inline-flex items-center rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Pick a different time
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section
          role="region"
          aria-label="Rescheduling history"
          data-testid="reschedule-history"
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            Time changes
          </div>
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.id} className="text-xs text-muted-foreground" data-testid={`history-entry-${h.id}`}>
                <span className="font-medium text-foreground/80">
                  {h.requesterRole === 'provider' ? 'Provider' : h.requesterRole === 'client' ? 'Client' : 'Support'}
                </span>{' '}
                moved {formatInstant(h.originalScheduledAt, timezone)} →{' '}
                {formatInstant(h.newScheduledAt, timezone)}
                {h.reason ? ` — “${h.reason}”` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
