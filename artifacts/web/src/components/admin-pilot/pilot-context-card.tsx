import React from 'react';
import { CalendarRange } from 'lucide-react';
import type { PilotMetricsResponsePilot } from '@workspace/api-client-react';
import { formatPilotDate } from './pilot-format';

/**
 * Pilot window context. "Southern Ontario" and the provider target are
 * display context only — never metric logic (Part 1 boundary).
 */
export default function PilotContextCard({ pilot }: { pilot: PilotMetricsResponsePilot }) {
  return (
    <section
      aria-labelledby="pilot-context-heading"
      data-testid="pilot-context-card"
      className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-sm space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="pilot-context-heading" className="text-sm font-semibold text-foreground">
          Southern Ontario provider pilot
        </h2>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {pilot.providerTarget}-provider target
        </span>
        {pilot.isProjected && (
          <span
            data-testid="pilot-window-projected-badge"
            className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800"
          >
            Projected window
          </span>
        )}
      </div>
      <p data-testid="pilot-window-dates" className="text-sm text-foreground">
        {formatPilotDate(pilot.startDate)} → {formatPilotDate(pilot.endDate)}
      </p>
      {pilot.isProjected && (
        <p data-testid="pilot-window-projected-note" className="text-xs text-amber-800">
          Projected pilot window — configure PILOT_START_DATE and PILOT_END_DATE when dates are
          confirmed.
        </p>
      )}
      {pilot.configWarning && (
        <p data-testid="pilot-config-warning" className="text-xs text-muted-foreground">
          {pilot.configWarning}
        </p>
      )}
      <p data-testid="pilot-generated-at" className="text-xs text-muted-foreground">
        Generated{' '}
        {new Date(pilot.generatedAt).toLocaleString('en-CA', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        })}
      </p>
    </section>
  );
}
