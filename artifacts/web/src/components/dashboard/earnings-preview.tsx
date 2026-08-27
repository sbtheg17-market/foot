/**
 * Earnings preview — clearly marked "coming soon" (payments are not enabled;
 * no money moves through the platform). Shows an honest estimate derived from
 * completed visits × service price when available.
 */
import React from 'react';
import { Sparkles } from 'lucide-react';
import type { ProviderEarningsPreview } from '@workspace/api-client-react';

export default function EarningsPreview({ preview }: { preview: ProviderEarningsPreview }) {
  const hasEstimate = preview.estimatedMonthlyCents !== null;
  return (
    <section
      data-testid="earnings-preview-section"
      aria-labelledby="earnings-preview-heading"
      className="bg-card border border-border rounded-3xl p-6 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="earnings-preview-heading" className="text-xl font-serif font-semibold">
          Earnings
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
          Coming soon
        </span>
      </div>

      {hasEstimate && (
        <p className="text-3xl font-serif font-bold text-foreground" data-testid="earnings-estimate">
          ${((preview.estimatedMonthlyCents ?? 0) / 100).toFixed(2)}
          <span className="text-sm font-sans font-normal text-muted-foreground">
            {' '}
            estimated this month
          </span>
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {hasEstimate
          ? 'Based on completed visits × your service prices. During the pilot you keep 100% — collect payment directly from your clients.'
          : 'Once payments are enabled, your weekly and monthly earnings will appear here. During the pilot you keep 100% of what you charge.'}
      </p>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Earnings tracking is on the way — we're building this for your business.
      </p>
    </section>
  );
}
