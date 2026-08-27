/**
 * Verification section — safe, status-level verification information only.
 * Raw document references, reviewer identity, and reviewer-private notes are
 * never present in the payload, so they can never render here.
 */
import React from 'react';
import { Link } from 'wouter';
import { ShieldCheck } from 'lucide-react';
import type { ProviderActivationStatus } from '@workspace/api-client-react';
import SupportContactLink from '@/components/support-contact-link';
import { ROUTES } from '@/lib/routes';
import { VERIFICATION_COPY } from '@/lib/activation-hub';

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
  } catch {
    return value;
  }
}

export default function VerificationCard({
  activation,
}: {
  activation: ProviderActivationStatus;
}) {
  const v = activation.verification;
  const copy = VERIFICATION_COPY[v.status];
  const submitted = formatDate(v.submittedAt);
  const resubmitHref =
    activation.applicationStatus === 'approved'
      ? ROUTES.provider.credentials
      : ROUTES.onboarding.provider;

  return (
    <section
      aria-labelledby="activation-verification-heading"
      data-testid="activation-verification"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 id="activation-verification-heading" className="font-serif text-lg font-semibold text-foreground">
          Verification
        </h2>
        <span
          data-testid="activation-verification-status"
          className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
        >
          {copy.label}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground" data-testid="activation-verification-body">
        {copy.body}
      </p>
      {submitted && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Submitted:</span>{' '}
          <span data-testid="activation-verification-submitted-at">{submitted}</span>
        </p>
      )}
      {v.canResubmit && (
        <Link
          href={resubmitHref}
          data-testid="activation-verification-resubmit"
          className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Update and submit again
        </Link>
      )}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        We use your verification information only to review your provider
        application. We do not show it on your public booking page.
      </p>
      <div className="mt-2">
        <SupportContactLink
          testId="activation-verification-support"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
        />
      </div>
    </section>
  );
}
