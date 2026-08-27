/**
 * Dependency-free CSS horizontal bar chart for acquisition-source
 * attribution. Accessible: each row is a list item whose label and count are
 * plain text — the colored bar is decorative (aria-hidden).
 */
import React from 'react';
import type { ProviderSourceAttribution } from '@workspace/api-client-react';

const SOURCE_ROWS: Array<{
  key: keyof ProviderSourceAttribution;
  label: string;
  bar: string;
}> = [
  { key: 'instagram', label: 'Instagram', bar: 'bg-primary' },
  { key: 'qrCard', label: 'QR card', bar: 'bg-emerald-500' },
  { key: 'text', label: 'Text message', bar: 'bg-sky-500' },
  { key: 'facebook', label: 'Facebook', bar: 'bg-indigo-500' },
  { key: 'website', label: 'Website', bar: 'bg-amber-500' },
  { key: 'other', label: 'Other', bar: 'bg-muted-foreground' },
  { key: 'unknown', label: 'Direct / unknown', bar: 'bg-border' },
];

export default function SourceAttributionChart({
  sources,
}: {
  sources: ProviderSourceAttribution;
}) {
  const total = SOURCE_ROWS.reduce((sum, row) => sum + sources[row.key], 0);
  if (total === 0) {
    return (
      <p data-testid="source-attribution-empty" className="text-sm text-muted-foreground">
        Once bookings arrive, you'll see where they came from — Instagram, your QR card, texts and
        more.
      </p>
    );
  }

  const max = Math.max(...SOURCE_ROWS.map((row) => sources[row.key]));
  return (
    <ul
      data-testid="source-attribution-chart"
      aria-label="Bookings by source"
      className="space-y-1"
    >
      {SOURCE_ROWS.filter((row) => sources[row.key] > 0).map((row) => {
        const count = sources[row.key];
        return (
          <li
            key={row.key}
            data-testid={`source-bar-${row.key}`}
            className="flex items-center gap-3 py-1"
          >
            <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
              {row.label}
            </span>
            <span className="flex-1 h-3 rounded-full bg-secondary overflow-hidden" aria-hidden="true">
              <span
                className={`block h-full rounded-full ${row.bar}`}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="w-8 text-right text-xs font-bold text-foreground">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}
