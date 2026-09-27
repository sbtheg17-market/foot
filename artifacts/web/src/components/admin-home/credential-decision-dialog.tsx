import React, { useEffect, useState } from 'react';
import {
  useReviewVerificationDoc,
  type AdminVerificationQueueItem,
  type VerificationDocResponse,
} from '@workspace/api-client-react';
import { toast } from 'sonner';
import { CheckCircle2, FileCheck2, Loader2, Lock, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { timeAgo, daysSince } from '@/lib/time-ago';

export type CredentialDecision = 'approved' | 'rejected';

export interface CredentialDecisionDialogProps {
  item: AdminVerificationQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Other documents from the same provider still pending (excluding this one). */
  otherPendingDocs: number;
  isDemo?: boolean;
  onDecided?: (decision: CredentialDecision, response: VerificationDocResponse) => void;
}

function errorMessage(error: unknown, fallback: string): string {
  const status = (error as { status?: unknown } | undefined)?.status;
  if (status === 404) return 'This document no longer exists — the queue has been refreshed.';
  if (status === 403) return 'Only platform administrators can review credentials.';
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  const serverMsg = (error as { error?: unknown } | undefined)?.error;
  return typeof serverMsg === 'string' && serverMsg.length > 0 ? serverMsg : fallback;
}

const MAX_NOTES = 1000;

/**
 * Approve or reject one uploaded credential from the command center, over the
 * existing PATCH /admin/verification/docs/:docId. The profile-level
 * verification flip is an explicit, labelled choice — never implied.
 */
export default function CredentialDecisionDialog(props: CredentialDecisionDialogProps) {
  const { item, open, onOpenChange, otherPendingDocs, isDemo = false, onDecided } = props;
  const [decision, setDecision] = useState<CredentialDecision>('approved');
  const [notes, setNotes] = useState('');
  const [flipProfile, setFlipProfile] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDecision('approved');
      setNotes('');
      setFlipProfile(true);
      setServerError(null);
    }
  }, [open, item?.doc.id]);

  const review = useReviewVerificationDoc();
  const isPending = review.isPending;
  const profileApproved = item?.provider.verificationStatus === 'approved';
  const waited = daysSince(item?.doc.submittedAt);

  const profileTarget: 'approved' | 'rejected' | undefined =
    !flipProfile || profileApproved ? undefined : decision;

  const submit = () => {
    if (!item || isPending) return;
    setServerError(null);
    review.mutate(
      {
        docId: item.doc.id,
        data: {
          status: decision,
          reviewerNotes: notes.trim() || undefined,
          updateProviderStatus: profileTarget,
        },
      },
      {
        onSuccess: (res) => {
          toast.success(decision === 'approved' ? 'Credential approved' : 'Credential rejected', {
            description:
              profileTarget === 'approved'
                ? 'Profile verification is now approved — once their application is approved too, this provider can take bookings.'
                : profileTarget === 'rejected'
                  ? 'Profile verification set to rejected; the provider can upload a corrected document and resubmit.'
                  : otherPendingDocs > 0
                    ? `${otherPendingDocs} more document${otherPendingDocs === 1 ? '' : 's'} from this provider still need${otherPendingDocs === 1 ? 's' : ''} a decision.`
                    : 'Recorded on the document. Profile verification was left unchanged.',
          });
          onDecided?.(decision, res);
          onOpenChange(false);
        },
        onError: (err) => setServerError(errorMessage(err, 'The decision could not be saved. Please try again.')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent data-testid="credential-dialog" className="rounded-2xl max-w-xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-xl" data-testid="credential-title">
                Review credential #{item.doc.id}
              </DialogTitle>
              <DialogDescription>
                {item.provider.firstName} {item.provider.lastName}
                {isDemo && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo</span>}
                {' '}· uploaded {timeAgo(item.doc.submittedAt) ?? 'unknown'} ({waited} day{waited === 1 ? '' : 's'} waiting)
              </DialogDescription>
            </DialogHeader>

            <dl data-testid="credential-facts" className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-secondary/40 p-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Document type</dt><dd className="font-medium capitalize" data-testid="credential-doc-type">{item.doc.docType}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Profile verification</dt><dd className="font-medium capitalize" data-testid="credential-profile-status">{item.provider.verificationStatus.replace('_', ' ')}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-muted-foreground">File / reference</dt><dd className="break-all font-mono text-xs" data-testid="credential-file">{item.doc.fileName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate font-medium" title={item.provider.email}>{item.provider.email}</dd></div>
              <div><dt className="text-xs text-muted-foreground">City</dt><dd className="font-medium">{item.provider.city || '—'}</dd></div>
              {item.doc.reviewerNotes && (
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Provider's note on upload</dt><dd className="text-sm" data-testid="credential-upload-note">{item.doc.reviewerNotes}</dd></div>
              )}
            </dl>

            <div role="radiogroup" aria-label="Decision" className="grid grid-cols-2 gap-2">
              <button type="button" role="radio" aria-checked={decision === 'approved'} data-testid="credential-choose-approve" onClick={() => setDecision('approved')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${decision === 'approved' ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white hover:bg-secondary'}`}>
                <FileCheck2 className="h-4 w-4" aria-hidden="true" /> Approve
              </button>
              <button type="button" role="radio" aria-checked={decision === 'rejected'} data-testid="credential-choose-reject" onClick={() => setDecision('rejected')}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${decision === 'rejected' ? 'border-destructive bg-destructive text-white' : 'border-border bg-white hover:bg-secondary'}`}>
                <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Reject
              </button>
            </div>

            {profileApproved ? (
              <p data-testid="credential-profile-note" className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>This provider's profile verification is already approved. This decision is recorded on the document only.</span>
              </p>
            ) : (
              <label data-testid="credential-flip-profile" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                <input type="checkbox" data-testid="credential-flip-checkbox" className="mt-0.5" checked={flipProfile} onChange={(e) => setFlipProfile(e.target.checked)} />
                <span>
                  {decision === 'approved'
                    ? <>Also mark this provider's <strong>profile verification as approved</strong>. Together with an approved application this lets them take bookings.{otherPendingDocs > 0 && ` (${otherPendingDocs} other document${otherPendingDocs === 1 ? '' : 's'} still pending — untick to wait.)`}</>
                    : <>Also set this provider's <strong>profile verification to rejected</strong> so they are prompted to upload a corrected document.</>}
                </span>
              </label>
            )}

            <div className="space-y-1.5">
              <label htmlFor="credential-notes" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Reviewer notes (stored on the document; the provider sees them on their verification page)
              </label>
              <textarea id="credential-notes" data-testid="credential-notes" value={notes} maxLength={MAX_NOTES} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder={decision === 'rejected' ? 'Recommended: say what is wrong so they can fix it.' : 'Optional. What you checked.'}
                className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            {serverError && <p role="alert" data-testid="credential-error" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{serverError}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" data-testid="credential-cancel" onClick={() => onOpenChange(false)} disabled={isPending} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">Cancel</button>
              <button type="button" data-testid="credential-submit" onClick={submit} disabled={isPending}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${decision === 'approved' ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90'}`}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {decision === 'approved' ? 'Approve credential' : 'Reject credential'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Recorded on the document with the review time; it appears under recent credential decisions.</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
