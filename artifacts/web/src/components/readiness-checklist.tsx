/**
 * ReadinessChecklist — renders the C1–C7 provider activation requirements.
 *
 * Purely presentational: every satisfied/unsatisfied state comes from the
 * server-provided `readiness.criteria` booleans and `readiness.missing`
 * reason codes. Nothing is re-derived on the client.
 */
import React from 'react';
import { Link } from 'wouter';
import { CheckCircle2, Circle, ArrowRight, AlertCircle } from 'lucide-react';
import type { ProviderReadiness } from '@workspace/api-client-react';
import { READINESS_ITEMS, labelForCode, unknownCodes } from '@/lib/readiness';

export default function ReadinessChecklist({ readiness }: { readiness: ProviderReadiness }) {
  const extras = unknownCodes(readiness);

  return (
    <ul className="space-y-3" data-testid="readiness-checklist">
      {READINESS_ITEMS.map((item) => {
        const done = readiness.criteria[item.criterion] === true;
        return (
          <li
            key={item.code}
            className={`bg-card border rounded-2xl p-4 flex items-start gap-4 transition-colors ${
              done ? 'border-border/60' : 'border-amber-200 bg-amber-50/40'
            }`}
            data-testid={`readiness-item-${item.code}`}
          >
            <div
              className={`mt-0.5 shrink-0 ${done ? 'text-emerald-600' : 'text-amber-500'}`}
              data-testid={`readiness-item-${item.code}-status`}
              data-status={done ? 'done' : 'missing'}
            >
              {done ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${done ? 'text-foreground' : 'text-foreground'}`}>
                  {item.title}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                  {item.ordinal}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {done ? item.doneDescription : item.missingDescription}
              </p>
              {!done && (
                <Link
                  href={item.fixHref}
                  className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
                  data-testid={`readiness-fix-${item.code}`}
                >
                  {item.fixLabel}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </li>
        );
      })}

      {/* Forward-compatibility: show any server-reported codes this build
          doesn't have metadata for, instead of silently dropping them. */}
      {extras.map((code) => {
        const label = labelForCode(code);
        return (
          <li
            key={code}
            className="bg-card border border-amber-200 bg-amber-50/40 rounded-2xl p-4 flex items-start gap-4"
            data-testid={`readiness-item-${code}`}
          >
            <div className="mt-0.5 shrink-0 text-amber-500" data-status="missing">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">{label.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{label.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
