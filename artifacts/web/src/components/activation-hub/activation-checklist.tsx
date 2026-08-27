/**
 * Activation checklist — true milestones in journey order. Completed steps
 * are grouped compactly so the page never feels bureaucratic; remaining
 * steps show why they matter and link straight to the existing destination.
 * Steps that require approval are labeled as locked — no fake progress and
 * no links that would land on a 403.
 */
import React from 'react';
import { Link } from 'wouter';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import type { ProviderActivationStatus } from '@workspace/api-client-react';
import { MILESTONE_DEFS, type MilestoneDef } from '@/lib/activation-hub';

function stepHref(def: MilestoneDef, activation: ProviderActivationStatus): string | null {
  if (activation.applicationStatus === 'approved') return def.approvedHref;
  if (activation.applicationStatus === 'draft') return def.draftHref;
  return null;
}

export default function ActivationChecklist({
  activation,
}: {
  activation: ProviderActivationStatus;
}) {
  const done = MILESTONE_DEFS.filter((d) => activation.milestones[d.key]);
  const remaining = MILESTONE_DEFS.filter((d) => !activation.milestones[d.key]);

  return (
    <section aria-labelledby="activation-checklist-heading" data-testid="activation-checklist">
      <h2 id="activation-checklist-heading" className="font-serif text-xl font-bold text-foreground">
        Your activation checklist
      </h2>

      {done.length > 0 && (
        <div
          className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
          data-testid="activation-checklist-done"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
            Completed
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {done.map((d) => (
              <li
                key={d.key}
                className="inline-flex items-center gap-1.5 text-sm text-emerald-900"
                data-testid={`activation-step-done-${d.key}`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                {d.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {remaining.length > 0 && (
        <ul className="mt-3 space-y-3">
          {remaining.map((d) => {
            const href = stepHref(d, activation);
            const locked = !href && !activation.milestones['approved'] && d.key !== 'approved' && d.key !== 'firstBookingReceived';
            return (
              <li
                key={d.key}
                className="rounded-2xl border border-border bg-card p-4"
                data-testid={`activation-step-${d.key}`}
              >
                <div className="flex items-start gap-3">
                  {locked ? (
                    <Lock className="mt-0.5 w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <Circle className="mt-0.5 w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {d.label}
                      <span className="sr-only">{locked ? ' (available after approval)' : ' (not complete yet)'}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{d.why}</p>
                    {locked && (
                      <p className="mt-1 text-xs font-medium text-muted-foreground" data-testid={`activation-step-locked-${d.key}`}>
                        Available after approval
                      </p>
                    )}
                  </div>
                  {href && d.actionLabel && (
                    href.startsWith('#') ? (
                      <a
                        href={href}
                        data-testid={`activation-step-action-${d.key}`}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:border-primary/50"
                      >
                        {d.actionLabel}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        data-testid={`activation-step-action-${d.key}`}
                        className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:border-primary/50"
                      >
                        {d.actionLabel}
                      </Link>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
