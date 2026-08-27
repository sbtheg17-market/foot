/**
 * Collapsible recent-activity list (last 10 outcomes). Collapsed by default
 * so the dashboard never overwhelms; status uses color + text.
 */
import React from 'react';
import { CheckCircle2, XCircle, UserX, CalendarClock } from 'lucide-react';
import type { ProviderActivityItem } from '@workspace/api-client-react';

const ACTIVITY_META: Record<
  string,
  { label: string; chip: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }> }
> = {
  booking: { label: 'Completed', chip: 'bg-emerald-100 text-emerald-800', Icon: CheckCircle2 },
  reschedule: { label: 'Rescheduled', chip: 'bg-sky-100 text-sky-800', Icon: CalendarClock },
  cancellation: { label: 'Cancelled', chip: 'bg-rose-100 text-rose-800', Icon: XCircle },
  no_show: { label: 'No-show', chip: 'bg-amber-100 text-amber-800', Icon: UserX },
};

export default function RecentActivity({ items }: { items: ProviderActivityItem[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <section
      data-testid="recent-activity-section"
      aria-labelledby="activity-heading"
      className="bg-card border border-border rounded-3xl p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="activity-heading" className="text-xl font-serif font-semibold">
          Recent activity
        </h2>
        <button
          type="button"
          data-testid="recent-activity-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      {open &&
        (items.length === 0 ? (
          <p data-testid="recent-activity-empty" className="text-sm text-muted-foreground mt-4">
            No activity yet — completed, rescheduled and cancelled visits will show here.
          </p>
        ) : (
          <ul className="space-y-3 mt-4">
            {items.map((item, index) => {
              const meta = ACTIVITY_META[item.type] ?? ACTIVITY_META['booking']!;
              const Icon = meta.Icon;
              return (
                <li
                  key={`${item.type}-${item.date}-${index}`}
                  data-testid={`recent-activity-item-${index}`}
                  className="flex items-center gap-3"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.clientName} · {item.serviceName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${meta.chip}`}
                  >
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
