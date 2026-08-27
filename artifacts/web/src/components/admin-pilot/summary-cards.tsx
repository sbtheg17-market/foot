import React from 'react';
import type { PilotMetricsResponseSummary } from '@workspace/api-client-react';
import { formatPercent } from './pilot-format';

type Tone = 'ok' | 'watch';

type Card = {
  key: string;
  label: string;
  value?: string;
  emptyCopy?: string;
  note?: string;
  status?: { text: string; tone: Tone };
};

function rateStatus(
  rate: number | null,
  predicate: (r: number) => boolean,
  okText: string,
  watchText: string,
): Card['status'] {
  if (rate === null) return undefined;
  return predicate(rate) ? { text: okText, tone: 'ok' } : { text: watchText, tone: 'watch' };
}

/** Thresholds are quiet operating aids for the platform administrator — never rankings. */
export default function SummaryCards({
  summary,
  providerTarget,
  providersWithFirstBooking,
}: {
  summary: PilotMetricsResponseSummary;
  providerTarget: number;
  providersWithFirstBooking: number;
}) {
  const cards: Card[] = [
    {
      key: 'approved',
      label: 'Approved providers',
      value: String(summary.approvedProviders),
      note: `Pilot target: ${providerTarget} providers`,
    },
    {
      key: 'activation',
      label: 'Activated providers',
      value: formatPercent(summary.activationRate) ?? undefined,
      emptyCopy: summary.activationRate === null ? 'No approved providers yet' : undefined,
      note: `${summary.activatedProviders} of ${summary.approvedProviders} · Target 80%`,
      status: rateStatus(summary.activationRate, (r) => r >= 0.8, 'At target', 'Below target'),
    },
    {
      key: 'published',
      label: 'Published booking pages',
      value: String(summary.providersWithPublishedBookingPage),
      note: 'Ready to receive bookings',
    },
    {
      key: 'first-booking',
      label: 'Providers with first booking',
      value: String(providersWithFirstBooking),
      note: 'At least one booking received',
    },
    {
      key: 'total-bookings',
      label: 'Total bookings',
      value: String(summary.totalBookings),
      note: 'In the pilot window',
    },
    {
      key: 'completion',
      label: 'Completion rate',
      value: formatPercent(summary.completionRate) ?? undefined,
      emptyCopy: summary.completionRate === null ? 'No completed appointments yet' : undefined,
      note: 'Target 85%',
      status: rateStatus(summary.completionRate, (r) => r >= 0.85, 'At target', 'Below target'),
    },
    {
      key: 'cancellation',
      label: 'Cancellation rate',
      value: formatPercent(summary.cancellationRate) ?? undefined,
      emptyCopy: summary.cancellationRate === null ? 'No booking outcomes yet' : undefined,
      note: 'Guardrail: 20% or lower',
      status: rateStatus(
        summary.cancellationRate,
        (r) => r <= 0.2,
        'Within guardrail',
        'Above guardrail',
      ),
    },
    {
      key: 'no-show',
      label: 'No-show rate',
      value: formatPercent(summary.noShowRate) ?? undefined,
      emptyCopy: summary.noShowRate === null ? 'No booking outcomes yet' : undefined,
      note: 'Guardrail: 10% or lower',
      status: rateStatus(summary.noShowRate, (r) => r <= 0.1, 'Within guardrail', 'Above guardrail'),
    },
    {
      key: 'escalations',
      label: 'Support escalations',
      value: String(summary.supportEscalations),
      note: 'Guardrail: 3 or fewer',
      status:
        summary.supportEscalations <= 3
          ? { text: 'Within guardrail', tone: 'ok' }
          : { text: 'Above guardrail', tone: 'watch' },
    },
    {
      key: 'retention',
      label: 'Retention intent',
      value: `${summary.retentionYes} yes · ${summary.retentionNo} no · ${summary.retentionUnknown} unknown`,
      note: 'Provider intent to continue',
    },
  ];

  return (
    <section aria-labelledby="pilot-summary-heading" className="space-y-3">
      <h2 id="pilot-summary-heading" className="text-sm font-semibold text-foreground">
        Pilot summary
      </h2>
      <ul
        data-testid="pilot-summary-cards"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 list-none"
      >
        {cards.map((card) => (
          <li
            key={card.key}
            data-testid={`summary-card-${card.key}`}
            className="rounded-2xl border border-border bg-white p-3.5 shadow-sm space-y-1"
          >
            <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
            {card.value !== undefined ? (
              <p className="text-lg font-bold text-foreground leading-tight">{card.value}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">{card.emptyCopy}</p>
            )}
            {card.note && <p className="text-[11px] text-muted-foreground">{card.note}</p>}
            {card.status && (
              <p
                className={`text-[11px] font-semibold ${
                  card.status.tone === 'ok' ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {card.status.text}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
