import React from 'react';
import type { PilotProviderMetrics } from '@workspace/api-client-react';
import RetentionControl from './retention-control';
import {
  ACTIVATION_STATUS_LABELS,
  formatPercent,
  formatPilotDate,
  riskFlagLabel,
} from './pilot-format';

const HEADERS = [
  'Provider',
  'Activation status',
  'Booking page',
  'First booking',
  'Bookings',
  'Completed',
  'Cancelled',
  'No-shows',
  'Completion rate',
  'Retention intent',
  'Follow-up signal',
];

/** Internal provider health table — never a ranking or public comparison. */
export default function ProviderHealthTable({ providers }: { providers: PilotProviderMetrics[] }) {
  return (
    <section aria-labelledby="pilot-provider-health-heading" className="space-y-3">
      <div>
        <h2 id="pilot-provider-health-heading" className="text-sm font-semibold text-foreground">
          Provider health
        </h2>
        <p className="text-xs text-muted-foreground">
          Setup progress and booking outcomes per pilot provider. Follow-up signals are prompts to
          offer help — never a ranking.
        </p>
      </div>
      {providers.length === 0 ? (
        <p
          data-testid="provider-table-empty"
          className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground"
        >
          No pilot providers yet — approved providers appear here as they join the pilot.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
          <table data-testid="provider-health-table" className="w-full min-w-[960px] text-left text-xs">
            <caption className="sr-only">
              Pilot provider health: activation, booking outcomes, retention intent, and follow-up
              signals
            </caption>
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                {HEADERS.map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p.providerId}
                  data-testid={`provider-row-${p.providerId}`}
                  className="border-b border-border/60 last:border-0 align-top"
                >
                  <th scope="row" className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                    {p.providerName}
                  </th>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {ACTIVATION_STATUS_LABELS[p.activationStatus]}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.bookingPagePublished ? 'Published' : 'Not published'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.firstBookingAt ? formatPilotDate(p.firstBookingAt) : 'None yet'}
                  </td>
                  <td className="px-3 py-2.5">{p.bookings}</td>
                  <td className="px-3 py-2.5">{p.completions}</td>
                  <td className="px-3 py-2.5">{p.cancellations}</td>
                  <td className="px-3 py-2.5">{p.noShows}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatPercent(p.completionRate) ?? 'No outcomes yet'}
                  </td>
                  <td className="px-3 py-2.5">
                    <RetentionControl
                      providerId={p.providerId}
                      providerName={p.providerName}
                      value={p.retentionIntent}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {p.riskFlags.length === 0 ? (
                      <span className="text-muted-foreground">Nothing flagged</span>
                    ) : (
                      <ul
                        aria-label={`Follow-up signals for ${p.providerName}`}
                        className="flex flex-wrap gap-1 list-none"
                      >
                        {p.riskFlags.map((flag) => (
                          <li
                            key={flag}
                            data-testid={`risk-flag-${p.providerId}-${flag}`}
                            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 whitespace-nowrap"
                          >
                            {riskFlagLabel(flag)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
