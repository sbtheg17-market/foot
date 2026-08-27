/**
 * Static hub sections: honest value reinforcement (existing functionality
 * only — no reminders, payments, demand, or revenue claims) and the help &
 * trust section with the existing support contact path.
 */
import React from 'react';
import { HeartHandshake, LifeBuoy } from 'lucide-react';
import SupportContactLink from '@/components/support-contact-link';

const VALUE_POINTS = [
  'Keep bookable times accurate',
  'Check service-area fit before clients choose a slot',
  'Include practical travel/setup time in availability',
  'Give clients a clear way to reschedule or cancel',
  'Keep your booking link professional and easy to share',
];

export function ValueSection() {
  return (
    <section
      aria-labelledby="activation-value-heading"
      data-testid="activation-value"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2">
        <HeartHandshake className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 id="activation-value-heading" className="font-serif text-lg font-semibold text-foreground">
          What Foot handles for you
        </h2>
      </div>
      <ul className="mt-3 space-y-1.5">
        {VALUE_POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            {point}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HelpSection() {
  return (
    <section
      aria-labelledby="activation-help-heading"
      data-testid="activation-help"
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2">
        <LifeBuoy className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 id="activation-help-heading" className="font-serif text-lg font-semibold text-foreground">
          Help and trust
        </h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Our review process exists to protect trust between providers and
        clients. This page always shows your real status and the next action —
        we don't publish approval timelines we can't stand behind.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        We use your verification information only to review your provider
        application. We do not show it on your public booking page.
      </p>
      <div className="mt-3">
        <SupportContactLink
          testId="activation-help-support"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline underline-offset-4"
        />
      </div>
    </section>
  );
}
