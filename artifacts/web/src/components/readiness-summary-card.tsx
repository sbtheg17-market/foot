/**
 * Compact dashboard card summarizing provider activation readiness.
 *
 * Links to the canonical /provider/readiness page. All values are taken
 * verbatim from the owner-scoped GET /providers/me/readiness response —
 * nothing is recomputed client-side.
 */
import React from 'react';
import { Link } from 'wouter';
import { ListChecks, CheckCircle2, ChevronRight } from 'lucide-react';
import { useGetMyProviderReadiness } from '@workspace/api-client-react';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/routes';
import { completedCount, unresolvedCount, TOTAL_CRITERIA } from '@/lib/readiness';

export default function ReadinessSummaryCard() {
  const { data, isLoading, isError } = useGetMyProviderReadiness();
  const readiness = data?.readiness;

  if (isLoading) {
    return (
      <div
        className="bg-card border border-border rounded-2xl p-4"
        data-testid="dashboard-readiness-card-loading"
        aria-hidden="true"
      >
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-2 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // On error (or an unexpectedly empty body) keep the entry point available
  // without inventing a status — the page itself renders the full error state.
  if (isError || !readiness) {
    return (
      <Link href={ROUTES.provider.readiness}>
        <div
          className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/40 transition-colors"
          data-testid="dashboard-readiness-card"
          data-state="unknown"
        >
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
            <ListChecks className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Setup checklist</h3>
            <p className="text-sm text-muted-foreground">View your activation readiness.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </div>
      </Link>
    );
  }

  if (readiness.activated) {
    return (
      <Link href={ROUTES.provider.readiness}>
        <div
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-emerald-100/70 transition-colors"
          data-testid="dashboard-readiness-card"
          data-state="ready"
        >
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-emerald-900">Ready for clients</h3>
            <p className="text-sm text-emerald-800/80">All setup requirements are complete.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
        </div>
      </Link>
    );
  }

  const done = completedCount(readiness);
  const remaining = unresolvedCount(readiness);

  return (
    <Link href={ROUTES.provider.readiness}>
      <div
        className="bg-card border border-amber-200 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-amber-50/60 transition-colors"
        data-testid="dashboard-readiness-card"
        data-state="incomplete"
      >
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
          <ListChecks className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-foreground">Finish your setup</h3>
            <span
              className="text-xs font-bold text-amber-700"
              data-testid="dashboard-readiness-count"
            >
              {done} of {TOTAL_CRITERIA}
            </span>
          </div>
          <Progress
            value={(done / TOTAL_CRITERIA) * 100}
            className="h-1.5 mt-2"
            aria-label={`Setup progress: ${done} of ${TOTAL_CRITERIA} complete`}
          />
          <p className="text-sm text-muted-foreground mt-1.5">
            {remaining} step{remaining === 1 ? '' : 's'} left before clients can book you.
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}
