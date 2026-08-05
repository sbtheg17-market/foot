import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetAdminVerificationQueue,
  useReviewVerificationDoc,
  type ReviewVerificationDocRequestUpdateProviderStatus,
} from '@workspace/api-client-react';
import {
  ShieldCheck,
  ShieldAlert,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

type FilterStatus = 'pending' | 'approved' | 'rejected';

const PROVIDER_STATUS_OPTIONS = [
  { value: '', label: '— no change —' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved ✓' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminVerification() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterStatus>('pending');
  const [expandedDocId, setExpandedDocId] = useState<number | null>(null);
  const [notesByDoc, setNotesByDoc] = useState<Record<number, string>>({});
  const [providerStatusByDoc, setProviderStatusByDoc] = useState<Record<number, ReviewVerificationDocRequestUpdateProviderStatus | ''>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);

  const { data, isLoading } = useGetAdminVerificationQueue(
    { status: filter },
    { query: { queryKey: ['admin-verification', filter], refetchInterval: 30_000 } }
  );

  const reviewMutation = useReviewVerificationDoc({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['admin-verification'] });
        setPendingId(null);
        setExpandedDocId(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { error?: string })?.error ?? 'Action failed';
        toast.error(msg);
        setPendingId(null);
      },
    },
  });

  const handleReview = (docId: number, status: 'approved' | 'rejected') => {
    if (pendingId !== null) return;
    setPendingId(docId);
    reviewMutation.mutate({
      docId,
      data: {
        status,
        reviewerNotes: notesByDoc[docId]?.trim() || undefined,
        updateProviderStatus: (providerStatusByDoc[docId] as ReviewVerificationDocRequestUpdateProviderStatus) || undefined,
      },
    });
    toast.success(status === 'approved' ? 'Document approved' : 'Document rejected');
  };

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl shadow-sm">
          O
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Verification Queue</h1>
          <p className="text-sm text-muted-foreground">Admin · Provider Credentials</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-sm text-muted-foreground self-center">
            {data.total} document{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No {filter} documents</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(({ doc, provider }) => {
            const isExpanded = expandedDocId === doc.id;
            const isPending = pendingId === doc.id;

            return (
              <div
                key={doc.id}
                className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Row summary */}
                <button
                  className="w-full text-left p-4 flex items-start gap-4 hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground capitalize">
                        {doc.docType.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        doc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        doc.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {provider.firstName} {provider.lastName} · {provider.city}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted {new Date(doc.submittedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {/* Provider info */}
                    <div className="bg-secondary/40 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-medium text-foreground">Provider Info</p>
                      <p className="text-xs text-muted-foreground">{provider.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Overall status: <span className="font-medium capitalize">{provider.verificationStatus.replace('_', ' ')}</span>
                      </p>
                    </div>

                    {/* Document reference */}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-foreground">Document Reference</p>
                      {doc.fileName.startsWith('http') ? (
                        <a
                          href={doc.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {doc.fileName}
                        </a>
                      ) : (
                        <p className="text-xs text-foreground bg-secondary/30 rounded-lg px-3 py-2">{doc.fileName}</p>
                      )}
                    </div>

                    {/* Provider's own notes (stored in reviewerNotes pre-review) */}
                    {doc.reviewerNotes && doc.status === 'pending' && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Provider Notes</p>
                        <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">{doc.reviewerNotes}</p>
                      </div>
                    )}

                    {/* Reviewer notes after decision */}
                    {doc.reviewerNotes && doc.status !== 'pending' && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Reviewer Notes</p>
                        <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">{doc.reviewerNotes}</p>
                      </div>
                    )}

                    {/* Review actions (only for pending docs) */}
                    {doc.status === 'pending' && (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">
                            Reviewer Notes <span className="font-normal text-muted-foreground">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Reason for rejection, or approval notes..."
                            value={notesByDoc[doc.id] ?? ''}
                            onChange={(e) => setNotesByDoc((n) => ({ ...n, [doc.id]: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-foreground">
                            Update provider verification status <span className="font-normal text-muted-foreground">(optional)</span>
                          </label>
                          <select
                            value={providerStatusByDoc[doc.id] ?? ''}
                            onChange={(e) => setProviderStatusByDoc((p) => ({ ...p, [doc.id]: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {PROVIDER_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReview(doc.id, 'approved')}
                            disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
                          >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(doc.id, 'rejected')}
                            disabled={isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60"
                          >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            Reject
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
