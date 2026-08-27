import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMyVerification,
  useSubmitVerificationDoc,
} from '@workspace/api-client-react';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  XCircle,
  CheckCircle2,
  Plus,
  FileText,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

type DocType = 'license' | 'insurance' | 'certification' | 'other';
type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

const STATUS_CONFIG: Record<VerifStatus, { label: string; icon: React.ReactNode; className: string; description: string }> = {
  pending: {
    label: 'Not Started',
    icon: <Clock className="w-5 h-5" />,
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    description: 'Submit your credentials below to start the verification process.',
  },
  under_review: {
    label: 'Under Review',
    icon: <ShieldAlert className="w-5 h-5" />,
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
    description: "Our team is reviewing your documents. We'll notify you within 2–3 business days.",
  },
  approved: {
    label: 'Verified',
    icon: <ShieldCheck className="w-5 h-5" />,
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    description: 'Your credentials have been verified. You appear as a verified provider in search results.',
  },
  rejected: {
    label: 'Rejected',
    icon: <XCircle className="w-5 h-5" />,
    className: 'bg-red-50 text-red-700 border border-red-200',
    description: 'One or more documents were rejected. Please review the notes below and resubmit.',
  },
};

const DOC_TYPE_LABELS: Record<DocType, string> = {
  license: 'Professional License',
  insurance: 'Liability Insurance',
  certification: 'Certification / Training',
  other: 'Other Document',
};

const DOC_STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
};

export default function PortalCredentials() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMyVerification({
    query: { queryKey: ['my-verification'] },
  });

  const submitMutation = useSubmitVerificationDoc({
    mutation: {
      onSuccess: () => {
        toast.success('Credential submitted for review');
        queryClient.invalidateQueries({ queryKey: ['my-verification'] });
        setShowForm(false);
        setForm({ docType: 'license', fileName: '', notes: '' });
      },
      onError: (err: unknown) => {
        const e = err as { status?: number; data?: { error?: string } | null };
        if (e.status === 400) toast.error(e.data?.error ?? 'Please check the document details and try again.');
        else toast.error("We couldn't submit this document right now. Your information has not been lost. Please try again or contact support.");
      },
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ docType: DocType; fileName: string; notes: string }>({
    docType: 'license',
    fileName: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitMutation.isPending) return; // double-tap guard
    const reference = form.fileName.trim();
    if (!reference) {
      toast.error('Enter a document reference.');
      return;
    }
    if (reference.length > 200) {
      toast.error('Keep the reference within the allowed length (200 characters max).');
      return;
    }
    if (form.notes.trim().length > 1000) {
      toast.error('Keep reviewer notes within the allowed length (1000 characters max).');
      return;
    }
    submitMutation.mutate({
      data: { docType: form.docType, fileName: reference, notes: form.notes.trim() || undefined },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 pt-20 flex justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const verificationStatus = (data?.verificationStatus ?? 'pending') as VerifStatus;
  const docs = data?.docs ?? [];
  const statusCfg = STATUS_CONFIG[verificationStatus];

  return (
    <div className="p-6 pt-10 pb-32 max-w-2xl mx-auto space-y-8">
      <h1 className="text-3xl font-serif font-bold text-foreground">Credentials</h1>

      {/* Overall Status Banner */}
      <div className={`rounded-2xl p-5 flex gap-4 items-start ${statusCfg.className}`}>
        <div className="mt-0.5 flex-shrink-0">{statusCfg.icon}</div>
        <div>
          <p className="font-semibold text-base">{statusCfg.label}</p>
          <p className="text-sm mt-1 opacity-90">{statusCfg.description}</p>
        </div>
      </div>

      {/* Submitted Docs */}
      {docs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Submitted Documents</h2>
          <div className="space-y-3">
            {docs.map((doc) => {
              const docStatusCfg = DOC_STATUS_CONFIG[doc.status as keyof typeof DOC_STATUS_CONFIG];
              return (
                <div
                  key={doc.id}
                  className="bg-white border border-border rounded-2xl p-4 flex items-start gap-4 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-foreground">
                        {DOC_TYPE_LABELS[doc.docType as DocType] ?? doc.docType}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${docStatusCfg?.className}`}>
                        {docStatusCfg?.label ?? doc.status}
                      </span>
                    </div>
                    <a
                      href={doc.fileName.startsWith('http') ? doc.fileName : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary truncate block mt-1 flex items-center gap-1"
                    >
                      <span className="truncate">{doc.fileName}</span>
                      {doc.fileName.startsWith('http') && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
                    </a>
                    {doc.reviewerNotes && (
                      <p className="text-xs mt-2 bg-secondary/50 rounded-lg px-3 py-2 text-foreground">
                        <span className="font-medium">Reviewer note:</span> {doc.reviewerNotes}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted {new Date(doc.submittedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  {doc.status === 'approved' && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add New Doc */}
      {verificationStatus !== 'approved' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Add a Document</h2>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-full hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit Credential
              </button>
            )}
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-border rounded-2xl p-5 space-y-4 shadow-sm"
            >
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Document Type</label>
                <select
                  value={form.docType}
                  onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value as DocType }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="license">Professional License</option>
                  <option value="insurance">Liability Insurance</option>
                  <option value="certification">Certification / Training</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Document URL or Reference</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/... or 'Licence #ON-12345'"
                  value={form.fileName}
                  onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Paste a link to your document (Google Drive, Dropbox, etc.) or enter a licence number / reference.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">
                  Notes for reviewer <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Any context that helps our team review your submission..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium py-2.5 rounded-xl text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  ) : (
                    'Submit for Review'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!showForm && docs.length === 0 && (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No credentials submitted yet</p>
              <p className="text-xs mt-1">Tap "Submit Credential" to start your verification.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
