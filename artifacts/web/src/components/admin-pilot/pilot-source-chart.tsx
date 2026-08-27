import React from 'react';
import type { PilotMetricsResponseSourceAttributionItem } from '@workspace/api-client-react';
import { formatPercent, sourceLabel } from './pilot-format';

const BAR_COLORS = [
  'bg-primary',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-rose-400',
  'bg-muted-foreground',
];

/**
 * Dependency-free CSS horizontal bar chart for pilot source attribution.
 * Values are shown as text (label, count, percentage); bars are decorative.
 */
export default function PilotSourceChart({
  items,
}: {
  items: PilotMetricsResponseSourceAttributionItem[];
}) {
  const visible = items.filter((item) => item.bookings > 0);

  return (
    <section aria-labelledby="pilot-sources-heading" className="space-y-3">
      <div>
        <h2 id="pilot-sources-heading" className="text-sm font-semibold text-foreground">
          Bookings by source
        </h2>
        <p className="text-xs text-muted-foreground">
          Which sharing channels bring pilot bookings. Unattributed bookings group under
          Direct&nbsp;/&nbsp;unknown.
        </p>
      </div>
      {visible.length === 0 ? (
        <p
          data-testid="pilot-source-chart-empty"
          className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground"
        >
          No bookings in the pilot window yet — once bookings arrive you'll see which sources bring
          them.
        </p>
      ) : (
        <ul
          data-testid="pilot-source-chart"
          aria-label="Pilot bookings by source"
          className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-1 list-none"
        >
          {visible.map((item, index) => {
            const max = Math.max(...visible.map((v) => v.bookings));
            const bar =
              item.source === 'unknown' ? 'bg-border' : BAR_COLORS[index % BAR_COLORS.length];
            return (
              <li
                key={item.source}
                data-testid={`pilot-source-bar-${item.source}`}
                className="flex items-center gap-3 py-1"
              >
                <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground">
                  {sourceLabel(item.source)}
                </span>
                <span
                  className="flex-1 h-3 rounded-full bg-secondary overflow-hidden"
                  aria-hidden="true"
                >
                  <span
                    className={`block h-full rounded-full ${bar}`}
                    style={{ width: `${(item.bookings / max) * 100}%` }}
                  />
                </span>
                <span className="w-20 text-right text-xs font-bold text-foreground">
                  {item.bookings}
                  {item.percentage !== null && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({formatPercent(item.percentage)})
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
