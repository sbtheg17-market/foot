/**
 * Provider scorecard — exact counts from the provider's own bookings and
 * reviews (last 30 days by scheduled time, and all time), rates only once
 * enough visits are resolved, and one practical next step per gap. Every
 * figure comes from GET /providers/me/scorecard; copy makes no causal or
 * revenue claims.
 */
import React from 'react';
import { useGetMyProviderScorecard, type ProviderScorecardCounts } from '@workspace/api-client-react';
import { Star, ClipboardCheck, Lightbulb } from 'lucide-react';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function CountColumn({ title, counts, minimum, testId }: { title: string; counts: ProviderScorecardCounts; minimum: number; testId: string }) {
  const rows: Array<[string, React.ReactNode]> = [
    ['Completed', counts.completed],
    ['Cancelled', counts.cancelled],
    ['No-shows', counts.noShow],
    ['Awaiting outcome', counts.awaitingOutcome],
    ['Repeat clients', counts.distinctClients === 0 ? '—' : `${counts.repeatClients} of ${counts.distinctClients}`],
    ['Reviews', counts.reviews.count === 0 ? '0' : <>{counts.reviews.count} · {counts.reviews.averageRating}<Star className="inline w-3 h-3 ml-0.5 -mt-0.5 fill-current" aria-label="average rating" /></>],
  ];
  return (
    <div data-testid={testId} className="min-w-0 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{title}</h3>
      <dl className="divide-y divide-border/60 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums text-foreground" data-testid={`${testId}-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground" data-testid={`${testId}-rates`}>
        {counts.rates
          ? `Of ${counts.resolved} resolved visits: ${pct(counts.rates.completion)} completed · ${pct(counts.rates.cancellation)} cancelled · ${pct(counts.rates.noShow)} no-show`
          : `Rates appear after ${minimum} resolved visits (${counts.resolved} of ${minimum} so far).`}
      </p>
    </div>
  );
}

export default function ScorecardCard() {
  const { data, isLoading, isError } = useGetMyProviderScorecard({ query: { queryKey: ['my-scorecard'] } });

  return (
    <section data-testid="scorecard-section" aria-labelledby="scorecard-heading" className="bg-card border border-border rounded-3xl p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 id="scorecard-heading" className="text-xl font-serif font-semibold">Your scorecard</h2>
        {data?.isDemo && (
          <span data-testid="scorecard-demo-badge" className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo account</span>
        )}
        <span className="basis-full sm:basis-auto sm:ml-auto text-xs text-muted-foreground">Exact counts from your own bookings and reviews</span>
      </div>

      {isLoading ? (
        <div role="status" data-testid="scorecard-loading" aria-label="Loading your scorecard" className="h-32 rounded-2xl bg-secondary/60 animate-pulse" />
      ) : isError || !data ? (
        <p role="alert" data-testid="scorecard-error" className="text-sm text-destructive">We couldn't load your scorecard. Refresh to try again.</p>
      ) : data.allTime.total === 0 ? (
        <p data-testid="scorecard-empty" className="text-sm text-muted-foreground">Your first booking starts this scorecard. Until then there is nothing to count — no estimates are shown.</p>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <CountColumn title={`Last ${data.windowDays} days`} counts={data.last30} minimum={data.minimumForRates} testId="scorecard-last30" />
            <CountColumn title="All time" counts={data.allTime} minimum={data.minimumForRates} testId="scorecard-alltime" />
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Lightbulb className="w-4 h-4 text-primary" aria-hidden="true" /> Next steps</h3>
            {data.suggestions.length === 0 ? (
              <p data-testid="scorecard-no-suggestions" className="text-sm text-muted-foreground">Nothing stands out in your numbers right now. Keep recording an outcome for every visit.</p>
            ) : (
              <ul data-testid="scorecard-suggestions" className="space-y-2">
                {data.suggestions.map((s) => (
                  <li key={s.gap} data-testid={`scorecard-suggestion-${s.gap.replace(/_/g, '-')}`} className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground">{s.message}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">Last {data.windowDays} days counts visits by their scheduled time; reviews by when they were written. No comparisons with other providers, no forecasts.</p>
        </>
      )}
    </section>
  );
}
