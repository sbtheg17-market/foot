/**
 * Personal performance metrics (conversion-first, supportive tone).
 * Color is never the only signal: every metric carries a text status chip.
 * Thresholds follow docs/provider-dashboard.md.
 */
import React from 'react';
import type { ProviderPerformanceMetrics } from '@workspace/api-client-react';

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const TONE_STYLES: Record<Tone, { chip: string; bar: string; label: string }> = {
  good: { chip: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', label: 'On track' },
  warn: { chip: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', label: 'Worth a look' },
  bad: { chip: 'bg-rose-100 text-rose-800', bar: 'bg-rose-500', label: 'Needs attention' },
  neutral: { chip: 'bg-sky-100 text-sky-800', bar: 'bg-sky-500', label: 'Growing' },
};

function MetricRow({
  testId,
  label,
  percent,
  tone,
  message,
}: {
  testId: string;
  label: string;
  percent: number;
  tone: Tone;
  message: string;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div data-testid={testId} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-serif font-bold text-foreground">{percent}%</span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${styles.chip}`}
          >
            {styles.label}
          </span>
        </div>
      </div>
      <div
        className="h-2 rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${label}: ${percent} percent`}
      >
        <div
          className={`h-full rounded-full ${styles.bar}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

export default function PerformanceMetrics({ metrics }: { metrics: ProviderPerformanceMetrics }) {
  if (metrics.resolvedBookings === 0) {
    return (
      <section
        data-testid="performance-metrics-section"
        aria-labelledby="metrics-heading"
        className="bg-card border border-border rounded-3xl p-6"
      >
        <h2 id="metrics-heading" className="text-xl font-serif font-semibold mb-2">
          Your performance
        </h2>
        <p className="text-sm text-muted-foreground" data-testid="metrics-empty">
          Your stats will appear here after your first completed visit. Share your booking link to
          get started!
        </p>
      </section>
    );
  }

  const completion = Math.round(metrics.completionRate * 100);
  const cancellation = Math.round(metrics.cancellationRate * 100);
  const noShow = Math.round(metrics.noShowRate * 100);
  const repeat = Math.round(metrics.repeatClientRate * 100);

  const completionTone: Tone = completion >= 85 ? 'good' : completion >= 70 ? 'warn' : 'bad';
  const cancellationTone: Tone = cancellation <= 20 ? 'good' : cancellation <= 30 ? 'warn' : 'bad';
  const noShowTone: Tone = noShow <= 10 ? 'good' : noShow <= 20 ? 'warn' : 'bad';
  const repeatTone: Tone = repeat >= 40 ? 'good' : 'neutral';

  return (
    <section
      data-testid="performance-metrics-section"
      aria-labelledby="metrics-heading"
      className="bg-card border border-border rounded-3xl p-6"
    >
      <h2 id="metrics-heading" className="text-xl font-serif font-semibold">
        Your performance
      </h2>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        Based on {metrics.resolvedBookings} completed, cancelled or missed visit
        {metrics.resolvedBookings === 1 ? '' : 's'}.
      </p>
      <div className="space-y-5">
        <MetricRow
          testId="metric-completion"
          label="Completion rate"
          percent={completion}
          tone={completionTone}
          message={
            completionTone === 'good'
              ? `Your completion rate is ${completion}% — clients can count on you!`
              : completionTone === 'warn'
                ? "You're close to target — a little consistency goes a long way."
                : 'Completed visits build trust. Reach out to support if something is getting in the way.'
          }
        />
        <MetricRow
          testId="metric-cancellation"
          label="Cancellation rate"
          percent={cancellation}
          tone={cancellationTone}
          message={
            cancellationTone === 'good'
              ? 'Nice and low — clients love your reliability.'
              : 'A quick confirmation message the day before can bring this down.'
          }
        />
        <MetricRow
          testId="metric-no-show"
          label="No-show rate"
          percent={noShow}
          tone={noShowTone}
          message={
            noShowTone === 'good'
              ? "Your clients show up — that's trust."
              : 'Tip: a reminder text 24 hours before cuts no-shows.'
          }
        />
        <MetricRow
          testId="metric-repeat"
          label="Repeat clients"
          percent={repeat}
          tone={repeatTone}
          message={
            repeatTone === 'good'
              ? `${repeat}% of your clients book again — they trust you!`
              : 'Repeat visits grow with every great appointment.'
          }
        />
      </div>
    </section>
  );
}
