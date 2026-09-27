import React from 'react';
import { Link } from 'wouter';
import { ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

export type QueueTone = 'ok' | 'attention' | 'warn' | 'neutral';

const TONE_RING: Record<QueueTone, string> = {
  ok: 'border-primary/30 bg-primary/5',
  attention: 'border-amber-300 bg-amber-50',
  warn: 'border-destructive/30 bg-destructive/5',
  neutral: 'border-border bg-white',
};

const TONE_COUNT: Record<QueueTone, string> = {
  ok: 'text-primary',
  attention: 'text-amber-700',
  warn: 'text-destructive',
  neutral: 'text-foreground',
};

export interface QueueCardProps {
  testId: string;
  icon: React.ReactNode;
  title: string;
  /** Headline figure. `null` while loading; string for non-numeric states. */
  headline: number | string | null;
  headlineLabel: string;
  tone: QueueTone;
  /** "What happened" */
  what: string;
  /** "Why it matters" */
  why: string;
  /** "What can I do next" */
  next: { href: string; label: string; testId: string };
  /** "How we'll know it worked" */
  success: string;
  loading?: boolean;
  error?: string | null;
  children?: React.ReactNode;
}

/**
 * One operational card. Every card answers, in order: what happened, why it
 * matters, what the admin can do next, and how we will know it worked.
 */
export default function QueueCard(props: QueueCardProps) {
  const { testId, icon, title, headline, headlineLabel, tone, what, why, next, success, loading, error, children } = props;
  const ring = error ? TONE_RING.warn : TONE_RING[tone];

  return (
    <section data-testid={testId} data-tone={error ? 'error' : tone} className={`min-w-0 rounded-2xl border p-5 shadow-sm flex flex-col gap-4 ${ring}`}>
      <header className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/80 border border-border flex items-center justify-center flex-shrink-0 text-primary" aria-hidden="true">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif font-bold text-lg text-foreground leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{headlineLabel}</p>
        </div>
        <div className="text-right">
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Loading" data-testid={`${testId}-loading`} />
          ) : error ? (
            <AlertTriangle className="w-6 h-6 text-destructive" aria-label="Error" />
          ) : (
            <p data-testid={`${testId}-headline`} className={`text-3xl font-bold tabular-nums leading-none ${TONE_COUNT[tone]}`}>{headline ?? '—'}</p>
          )}
        </div>
      </header>

      {error ? (
        <p role="alert" data-testid={`${testId}-error`} className="text-sm text-destructive">{error}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground pt-0.5">What</dt>
          <dd className="text-foreground" data-testid={`${testId}-what`}>{what}</dd>
          <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground pt-0.5">Why</dt>
          <dd className="text-muted-foreground">{why}</dd>
          <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground pt-0.5">Done when</dt>
          <dd className="text-muted-foreground">{success}</dd>
        </dl>
      )}

      {children}

      <Link
        href={next.href}
        data-testid={next.testId}
        className="mt-auto inline-flex items-center justify-between gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 active:scale-[0.99] transition-colors"
      >
        {next.label}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
