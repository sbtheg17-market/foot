import React from 'react';
import type { PilotMetricsResponseSummary } from '@workspace/api-client-react';

/**
 * Factual weekly review prompts derived from current numbers. Cautious
 * "review / check / assess" language only — never automated diagnosis,
 * never implied causation.
 */
export default function ReviewPrompts({ summary }: { summary: PilotMetricsResponseSummary }) {
  const prompts: Array<{ id: string; text: string }> = [];

  if (summary.approvedProviders > 0 && summary.providersWithPublishedBookingPage === 0) {
    prompts.push({
      id: 'no-published',
      text: 'No providers have published yet — prioritize setup and booking-link sharing support.',
    });
  }
  if (summary.providersWithPublishedBookingPage > 0 && summary.totalBookings === 0) {
    prompts.push({
      id: 'no-bookings',
      text: 'Published providers have no bookings — check whether links were shared and which channel was used.',
    });
  }
  if (summary.noShowRate !== null && summary.noShowRate > 0.1) {
    prompts.push({
      id: 'no-show',
      text: 'No-show rate is elevated — assess whether appointment reminders should be the next pilot investment.',
    });
  }
  if (summary.cancellationRate !== null && summary.cancellationRate > 0.2) {
    prompts.push({
      id: 'cancellation',
      text: 'Cancellation rate is elevated — review policy clarity and booking-fit expectations.',
    });
  }
  if (summary.supportEscalations > 0) {
    prompts.push({
      id: 'escalations',
      text: 'Support escalations are present — review response time and recurring issue themes.',
    });
  }

  return (
    <section aria-labelledby="pilot-review-heading" className="space-y-3">
      <div>
        <h2 id="pilot-review-heading" className="text-sm font-semibold text-foreground">
          Weekly review prompts
        </h2>
        <p className="text-xs text-muted-foreground">
          Reminders based on current numbers — for review, not automated diagnosis.
        </p>
      </div>
      {prompts.length === 0 ? (
        <p
          data-testid="review-prompts-empty"
          className="rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground shadow-sm"
        >
          Nothing needs review right now — check back after the next batch of bookings.
        </p>
      ) : (
        <ul
          data-testid="review-prompts"
          className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2 list-disc pl-8"
        >
          {prompts.map((prompt) => (
            <li
              key={prompt.id}
              data-testid={`review-prompt-${prompt.id}`}
              className="text-sm text-foreground"
            >
              {prompt.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
