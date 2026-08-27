/**
 * Activation hub hero — current status, one-sentence explanation, truthful
 * progress, and the single server-derived next best action.
 */
import React from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { ProviderActivationStatus } from '@workspace/api-client-react';
import { Progress } from '@/components/ui/progress';
import SupportContactLink from '@/components/support-contact-link';
import { APPROVED_TITLES, NEXT_ACTION_COPY, STATUS_COPY } from '@/lib/activation-hub';

export default function ActivationHero({
  firstName,
  activation,
}: {
  firstName?: string;
  activation: ProviderActivationStatus;
}) {
  const copy = STATUS_COPY[activation.applicationStatus];
  const title =
    activation.applicationStatus === 'approved'
      ? (APPROVED_TITLES[activation.nextAction] ?? copy.title)
      : copy.title;
  const next = NEXT_ACTION_COPY[activation.nextAction];
  const percent = Math.round(
    (activation.milestonesCompleted / activation.milestonesTotal) * 100,
  );

  return (
    <header data-testid="activation-hero">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {firstName ? `${firstName} — application status` : 'Application status'}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-bold text-foreground break-words" data-testid="activation-title">
          {title}
        </h1>
        <span
          data-testid="activation-status-pill"
          className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
        >
          {copy.label}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground" data-testid="activation-explanation">
        {copy.explanation}
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-sm font-semibold text-foreground">Setup progress</span>
          <span className="text-sm font-bold text-foreground" data-testid="activation-progress-count">
            {activation.milestonesCompleted} of {activation.milestonesTotal} steps complete
          </span>
        </div>
        <Progress
          value={percent}
          aria-label={`Setup progress: ${activation.milestonesCompleted} of ${activation.milestonesTotal} steps complete`}
        />
      </div>

      <section
        aria-label="Next step"
        data-testid="activation-next-action"
        className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Next step</p>
        <p className="mt-1 text-sm leading-6 text-foreground">{next.reason}</p>
        {next.support ? (
          <SupportContactLink
            testId="activation-next-action-support"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4"
          />
        ) : next.label && next.href ? (
          next.href.startsWith('#') ? (
            <a
              href={next.href}
              data-testid="activation-next-action-link"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {next.label} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          ) : (
            <Link
              href={next.href}
              data-testid="activation-next-action-link"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {next.label} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )
        ) : null}
      </section>
    </header>
  );
}
