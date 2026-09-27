import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  useApproveProviderApplication,
  useRejectProviderApplication,
  type AdminProviderApplicationListItem,
  type AdminProviderApplicationResponse,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Lock, ShieldAlert, UserCheck, UserX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ROUTES } from '@/lib/routes';
import { timeAgo, daysSince } from '@/lib/time-ago';

export type Decision = 'approve' | 'reject';

export interface ApplicationDecisionDialogProps {
  item: AdminProviderApplicationListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pending verification documents for this applicant's provider profile (from the queue feed). */
  pendingDocs: number;
  /** True when the applicant is a seed/demo account. */
  isDemo?: boolean;
  /** Called after the server confirmed the decision. */
  onDecided?: (decision: Decision, response: AdminProviderApplicationResponse) => void;
}

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  const status = errorStatus(error);
  if (status === 409) return 'This application is no longer under review — someone else may have decided it. The list has been refreshed.';
  if (status === 403) return 'You cannot review your own application.';
  if (status === 404) return 'This application no longer exists.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  const serverMsg = (error as { error?: unknown } | undefined)?.error;
  return typeof serverMsg === 'string' && serverMsg.length > 0 ? serverMsg : fallback;
}

const MAX_REASON = 1000;
const MAX_NOTES = 2000;

/**
 * Approve or reject a provider application from the command center.
 *
 * Honesty rules baked in:
 *  - the two-part activation gate is stated explicitly (application decision
 *    here, credential verification on the Verification page);
 *  - the rejection reason is labelled as provider-visible, reviewer notes as
 *    private, matching how the server stores them;
 *  - the server is the source of truth: 409/403/404 are surfaced verbatim in
 *    plain language and the queue is refreshed by the parent.
 */
export default function ApplicationDecisionDialog(props: ApplicationDecisionDialogProps) {
  const { item, open, onOpenChange, pendingDocs, isDemo = false, onDecided } = props;
  const [decision, setDecision] = useState<Decision>('approve');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset the form whenever a different application is opened.
  useEffect(() => {
    if (open) {
      setDecision('approve');
      setReason('');
      setNotes('');
      setServerError(null);
    }
  }, [open, item?.application.id]);

  const approve = useApproveProviderApplication();
  const reject = useRejectProviderApplication();
  const isPending = approve.isPending || reject.isPending;

  const trimmedReason = reason.trim();
  const reasonMissing = decision === 'reject' && trimmedReason.length === 0;
  const canSubmit = !!item && !isPending && !reasonMissing;

  const verificationApproved = item?.applicant.verificationStatus === 'approved';
  const waitedDays = useMemo(() => daysSince(item?.application.submittedAt), [item?.application.submittedAt]);

  const submit = () => {
    if (!item || !canSubmit) return;
    setServerError(null);
    const applicationId = item.application.id;
    const reviewerNotes = notes.trim() || undefined;
    const common = {
      onSuccess: (res: AdminProviderApplicationResponse) => {
        toast.success(decision === 'approve' ? 'Application approved' : 'Application rejected', {
          description:
            decision === 'approve' && !verificationApproved
              ? 'Next: approve their credentials on the Verification page so they can take bookings.'
              : decision === 'approve'
                ? 'Credentials are already approved — this provider can now operate.'
                : 'The provider will see your reason on their application status page.',
        });
        onDecided?.(decision, res);
        onOpenChange(false);
      },
      onError: (err: unknown) => {
        setServerError(errorMessage(err, 'The decision could not be saved. Please try again.'));
      },
    };
    if (decision === 'approve') {
      approve.mutate({ applicationId, data: reviewerNotes ? { reviewerNotes } : {} }, common);
    } else {
      reject.mutate({ applicationId, data: { rejectionReason: trimmedReason, reviewerNotes } }, common);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent data-testid="decision-dialog" className="rounded-2xl max-w-xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl" data-testid="decision-title">
                Decide application #{item.application.id}
              </DialogTitle>
              <DialogDescription>
                {item.applicant.firstName} {item.applicant.lastName}
                {isDemo && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo</span>}
                {' '}· submitted {timeAgo(item.application.submittedAt) ?? 'unknown'}{item.application.submittedAt ? ` (${waitedDays} day${waitedDays === 1 ? '' : 's'} waiting)` : ''}
              </DialogDescription>
            </DialogHeader>

            {/* Applicant facts */}
            <dl data-testid="decision-facts" className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-secondary/40 p-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate font-medium" title={item.applicant.email}>{item.applicant.email}</dd></div>
              <div><dt className="text-xs text-muted-foreground">City</dt><dd className="font-medium">{item.applicant.city || '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Application step</dt><dd className="font-medium capitalize">{item.application.currentStep.replace('_', ' ')}</dd></div>
              <div>
                <dt className="text-xs text-muted-foreground">Profile verification</dt>
                <dd className="font-medium capitalize" data-testid="decision-verification-status">{item.applicant.verificationStatus.replace('_', ' ')}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Credentials awaiting review</dt>
                <dd className="font-medium" data-testid="decision-pending-docs">
                  {pendingDocs} document{pendingDocs === 1 ? '' : 's'}{' '}
                  <Link href={ROUTES.admin.verification} className="text-primary hover:underline" data-testid="decision-verification-link">open verification queue</Link>
                </dd>
              </div>
            </dl>

            {/* Two-part gate — stated, not implied */}
            <p data-testid="decision-gate-note" className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${verificationApproved ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
              {verificationApproved ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />}
              <span>
                {verificationApproved
                  ? 'Credentials are already approved. Approving the application here makes this provider fully operable.'
                  : 'Approving here decides the application only. The provider can take bookings once their profile verification is also approved on the Verification page.'}
              </span>
            </p>

            {/* Decision selector */}
            <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={decision === 'approve'}
                data-testid="decision-choose-approve"
                onClick={() => setDecision('approve')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${decision === 'approve' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white hover:bg-secondary'}`}
              >
                <UserCheck className="h-4 w-4" aria-hidden="true" /> Approve
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={decision === 'reject'}
                data-testid="decision-choose-reject"
                onClick={() => setDecision('reject')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${decision === 'reject' ? 'border-destructive bg-destructive text-white' : 'border-border bg-white hover:bg-secondary'}`}
              >
                <UserX className="h-4 w-4" aria-hidden="true" /> Reject
              </button>
            </div>

            {decision === 'reject' && (
              <div className="space-y-1.5">
                <label htmlFor="decision-reason" className="text-sm font-medium text-foreground">
                  Reason shown to the provider <span className="text-destructive" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="decision-reason"
                  data-testid="decision-reason"
                  value={reason}
                  maxLength={MAX_REASON}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  aria-invalid={reasonMissing}
                  aria-describedby="decision-reason-help"
                  placeholder="e.g. Your insurance certificate has expired — please upload a current one and resubmit."
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p id="decision-reason-help" className="text-xs text-muted-foreground">Providers see this on their application status page and can fix it and resubmit. Be specific and kind.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="decision-notes" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Reviewer notes (private — never shown to the provider)
              </label>
              <textarea
                id="decision-notes"
                data-testid="decision-notes"
                value={notes}
                maxLength={MAX_NOTES}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional. What you checked, what to watch for."
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {serverError && (
              <p role="alert" data-testid="decision-error" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{serverError}</p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                data-testid="decision-cancel"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="decision-submit"
                onClick={submit}
                disabled={!canSubmit}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${decision === 'approve' ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90'}`}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {decision === 'approve' ? 'Approve application' : 'Reject application'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Recorded as an application event with your reviewer id; the provider is notified in-app.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
