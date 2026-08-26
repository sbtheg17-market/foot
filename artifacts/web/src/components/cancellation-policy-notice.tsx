import React from 'react';
import { Info } from 'lucide-react';

/**
 * Cancellation policy notice (roadmap #13). Plain-language, server-provided
 * copy — this component never computes policy outcomes itself.
 */
export default function CancellationPolicyNotice({
  noticeHours,
  summary,
  variant = 'client',
}: {
  noticeHours: number;
  summary?: string;
  variant?: 'client' | 'provider';
}) {
  const text =
    summary ??
    (variant === 'provider'
      ? `Cancelling a booking requires a reason and is recorded for the client. No-shows can be marked only after the scheduled time. Clients cancel free until ${noticeHours} hours before a visit; later cancellations are recorded as late.`
      : `Free cancellation until ${noticeHours} hours before the visit. Later cancellations are recorded as late — no fee is charged. If the provider cancels, it never counts against you.`);

  return (
    <section
      role="note"
      aria-label="Cancellation policy"
      data-testid="cancellation-policy-notice"
      className="rounded-2xl bg-secondary/60 p-4"
    >
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold mb-1 text-sm">Cancellation policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="cancellation-policy-text">
            {text}
          </p>
        </div>
      </div>
    </section>
  );
}
