import React from 'react';
import type { PilotProviderMetrics } from '@workspace/api-client-react';
import { MILESTONE_STEPS } from './pilot-format';

/**
 * Provider journey ladder: how many pilot providers have completed each
 * setup step. Shows where onboarding is getting stuck so the platform
 * administrator can offer help — read-only, never mutates provider setup.
 */
export default function ActivationOverview({ providers }: { providers: PilotProviderMetrics[] }) {
  const total = providers.length;
  return (
    <section aria-labelledby="pilot-activation-heading" className="space-y-3">
      <div>
        <h2 id="pilot-activation-heading" className="text-sm font-semibold text-foreground">
          Activation &amp; readiness
        </h2>
        <p className="text-xs text-muted-foreground">
          Where providers are in setup — so you can spot who could use a hand.
        </p>
      </div>
      {total === 0 ? (
        <p
          data-testid="activation-overview-empty"
          className="rounded-2xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground"
        >
          No pilot providers yet — the journey fills in as providers join.
        </p>
      ) : (
        <ol
          data-testid="activation-overview"
          className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2 list-none"
        >
          {MILESTONE_STEPS.map((step) => {
            const count = providers.filter((p) => p.onboardingMilestones[step.key]).length;
            return (
              <li
                key={step.key}
                data-testid={`milestone-${step.key}`}
                className="flex items-center gap-3"
              >
                <span className="w-44 shrink-0 text-xs font-medium text-muted-foreground">
                  {step.label}
                </span>
                <span
                  className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </span>
                <span className="w-14 text-right text-xs font-bold text-foreground">
                  {count} of {total}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
