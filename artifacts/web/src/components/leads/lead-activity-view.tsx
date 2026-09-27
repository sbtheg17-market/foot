import React from 'react';
import { Inbox } from 'lucide-react';
import type { LeadActivityResponse, LeadActivityItem } from '@workspace/api-client-react';

export interface LeadActivityViewProps {
  title: string;
  subtitle: string;
  data?: LeadActivityResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  testId: string;
}

/**
 * Shared read-only presentational component for the Today's Leads views
 * (provider `/provider/leads` and admin `/admin/ground-game`).
 *
 * Read-only by design: there are NO action controls (no reply/transfer/assign/
 * status-change). When no lead source is connected the list is empty and the
 * view states the honest reason. It never renders fabricated leads, counts,
 * traction or source attribution.
 */
export default function LeadActivityView({
  title,
  subtitle,
  data,
  isLoading,
  isError,
  onRetry,
  testId,
}: LeadActivityViewProps) {
  if (isLoading) {
    return (
      <div
        className="p-6 pt-10 pb-32 max-w-4xl mx-auto space-y-6"
        data-testid={`${testId}-loading`}
        aria-busy="true"
        aria-label="Loading leads"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-secondary/60 rounded-3xl animate-pulse h-24" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div
        className="p-6 pt-20 max-w-md mx-auto text-center space-y-4"
        data-testid={`${testId}-error`}
      >
        <h1 className="text-xl font-serif font-semibold text-foreground">
          We couldn't load leads
        </h1>
        <p className="text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
        <button
          type="button"
          data-testid={`${testId}-retry`}
          onClick={onRetry}
          className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    );
  }

  const items: LeadActivityItem[] = data.items ?? [];

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto space-y-8" data-testid={testId}>
      <header className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-foreground">{title}</h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </header>

      {items.length === 0 ? (
        <div
          data-testid={`${testId}-empty`}
          className="text-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-3xl space-y-2"
        >
          <Inbox className="w-8 h-8 mx-auto opacity-30" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            Lead activity isn't connected yet.
          </p>
          <p className="text-xs">
            When a lead source is connected, incoming interest will appear here.
            Nothing is tracked or measured yet.
          </p>
        </div>
      ) : (
        <ul
          className="divide-y divide-border rounded-3xl border border-border bg-card"
          data-testid={`${testId}-list`}
        >
          {items.map((item) => (
            <li key={item.id} data-testid={`lead-row-${item.id}`} className="p-4 space-y-1">
              <p className="text-sm font-medium text-foreground">{item.needSummary}</p>
              <p className="text-xs text-muted-foreground">
                {item.attribution === 'unknown' ? 'Source unknown' : item.source.name}
                {' · '}
                {item.status}
              </p>
              <p className="text-xs text-muted-foreground">Next: {item.nextAction.label}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
