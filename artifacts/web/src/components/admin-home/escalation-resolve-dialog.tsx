import React, { useEffect, useState } from 'react';
import {
  useUpdateSupportEscalation,
  type AdminSupportEscalation,
  type EscalationResponse,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, MessageSquare, Timer } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { timeAgo, daysSince } from '@/lib/time-ago';

export type EscalationOutcome = 'in_progress' | 'resolved';

export interface EscalationResolveDialogProps {
  item: AdminSupportEscalation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecided?: (outcome: EscalationOutcome, response: EscalationResponse) => void;
}

function errorMessage(error: unknown, fallback: string): string {
  const status = (error as { status?: unknown } | undefined)?.status;
  if (status === 404) return 'This request no longer exists — the list has been refreshed.';
  if (status === 403) return 'Only platform administrators can work support requests.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  const serverMsg = (error as { error?: unknown } | undefined)?.error;
  return typeof serverMsg === 'string' && serverMsg.length > 0 ? serverMsg : fallback;
}

const MAX_NOTE = 2000;

/**
 * Work a support request from the command center over the existing
 * PATCH /support/escalations/:ticketId. Resolving requires a written outcome
 * (recorded as a support message attributed to the admin). Booking
 * corrections and suspensions stay on the API — not offered here.
 */
export default function EscalationResolveDialog(props: EscalationResolveDialogProps) {
  const { item, open, onOpenChange, onDecided } = props;
  const [outcome, setOutcome] = useState<EscalationOutcome>('resolved');
  const [note, setNote] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOutcome('resolved');
      setNote('');
      setServerError(null);
    }
  }, [open, item?.id]);

  const update = useUpdateSupportEscalation();
  const isPending = update.isPending;
  const trimmed = note.trim();
  const noteMissing = outcome === 'resolved' && trimmed.length === 0;
  const canSubmit = !!item && !isPending && !noteMissing;
  const waited = daysSince(item?.createdAt);

  const submit = () => {
    if (!item || !canSubmit) return;
    setServerError(null);
    update.mutate(
      { ticketId: item.id, data: { status: outcome, ...(trimmed ? { resolutionNote: trimmed } : {}) } },
      {
        onSuccess: (res) => {
          toast.success(outcome === 'resolved' ? 'Request resolved' : 'Marked in progress', {
            description: outcome === 'resolved' ? 'Your outcome note is recorded on the ticket.' : 'The request stays on this list until you resolve it.',
          });
          onDecided?.(outcome, res);
          onOpenChange(false);
        },
        onError: (err) => setServerError(errorMessage(err, 'The update could not be saved. Please try again.')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent data-testid="escalation-dialog" className="rounded-2xl max-w-xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl" data-testid="escalation-title">Support request #{item.id}</DialogTitle>
              <DialogDescription>
                {item.requester.firstName} {item.requester.lastName} · <span className="capitalize">{item.requester.role}</span> · opened {timeAgo(item.createdAt) ?? 'unknown'} ({waited} day{waited === 1 ? '' : 's'} waiting)
              </DialogDescription>
            </DialogHeader>

            <dl data-testid="escalation-facts" className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-secondary/40 p-3 text-sm">
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">Subject</dt><dd className="font-medium" data-testid="escalation-subject">{item.subject}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="font-medium capitalize" data-testid="escalation-status">{item.status.replace('_', ' ')}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Linked booking</dt><dd className="font-medium">{item.bookingId ? `#${item.bookingId}` : 'none'}</dd></div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" aria-hidden="true" /> Latest message ({item.messageCount} total)</dt>
                <dd className="text-sm" data-testid="escalation-latest-message">
                  {item.latestMessage ? <>{item.latestMessage.fromAdmin && <span className="mr-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase">admin</span>}{item.latestMessage.message}</> : <span className="text-muted-foreground">No message was attached.</span>}
                </dd>
              </div>
            </dl>

            <div role="radiogroup" aria-label="Outcome" className="grid grid-cols-2 gap-2">
              <button type="button" role="radio" aria-checked={outcome === 'in_progress'} data-testid="escalation-choose-progress" onClick={() => setOutcome('in_progress')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${outcome === 'in_progress' ? 'border-amber-500 bg-amber-500 text-white' : 'border-border bg-white hover:bg-secondary'}`}>
                <Timer className="h-4 w-4" aria-hidden="true" /> In progress
              </button>
              <button type="button" role="radio" aria-checked={outcome === 'resolved'} data-testid="escalation-choose-resolve" onClick={() => setOutcome('resolved')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${outcome === 'resolved' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white hover:bg-secondary'}`}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Resolve
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="escalation-note" className="text-sm font-medium text-foreground">
                {outcome === 'resolved' ? <>Outcome note <span className="text-destructive" aria-hidden="true">*</span></> : 'Working note (optional)'}
              </label>
              <textarea id="escalation-note" data-testid="escalation-note" value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} rows={3}
                required={outcome === 'resolved'} aria-invalid={noteMissing} aria-describedby="escalation-note-help"
                placeholder="What was decided and why — this is the record of the outcome."
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              <p id="escalation-note-help" className="text-xs text-muted-foreground">Stored as a support message under your admin account. Booking corrections and suspensions are not done from here.</p>
            </div>

            {serverError && <p role="alert" data-testid="escalation-error" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{serverError}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-testid="escalation-cancel" onClick={() => onOpenChange(false)} disabled={isPending} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">Cancel</button>
              <button type="button" data-testid="escalation-submit" onClick={submit} disabled={!canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {outcome === 'resolved' ? 'Resolve request' : 'Save as in progress'}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
