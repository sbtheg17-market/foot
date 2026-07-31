import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatBookingTime } from "../../lib/format";
import { StatusChip } from "./StatusChip";
import { ROUTES } from "../../lib/routes";

/**
 * Lightweight read-only "Today" strip. Renders confirmed + completed bookings for today
 * on a 6 AM → 10 PM ruler so gaps between visits are visible at a glance.
 * No drag/scheduling, no route optimization — just a workload map.
 */
const START_HOUR = 6;
const END_HOUR = 22;
const WINDOW = END_HOUR - START_HOUR; // 16 hours

const _startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const TodayTimeline = ({ bookings }) => {
  const todays = useMemo(() => {
    if (!bookings) return [];
    const todayStart = _startOfDay(new Date());
    return bookings.filter((b) => {
      const d = new Date(b.scheduled_at);
      return (
        _startOfDay(d).getTime() === todayStart.getTime() &&
        ["confirmed", "completed"].includes(b.status)
      );
    });
  }, [bookings]);

  if (todays.length === 0) return null;

  return (
    <section
      className="rounded-2xl bg-card border border-black/5 p-4"
      data-testid="today-timeline"
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Today's flow
        </h2>
        <p className="text-xs text-muted-foreground">
          {todays.length} {todays.length === 1 ? "visit" : "visits"}
        </p>
      </div>

      <div className="relative h-8 rounded-full bg-muted/60 mb-2">
        {todays.map((b) => {
          const d = new Date(b.scheduled_at);
          const hours = d.getHours() + d.getMinutes() / 60;
          const left = Math.max(0, Math.min(100, ((hours - START_HOUR) / WINDOW) * 100));
          const width = Math.min(
            100 - left,
            ((b.service?.duration_minutes || 30) / 60 / WINDOW) * 100,
          );
          const color = b.status === "completed" ? "bg-emerald-500" : "bg-primary";
          return (
            <Link
              key={b.id}
              to={ROUTES.provider.bookingDetail(b.id)}
              className={`absolute top-1 bottom-1 rounded-full ${color} hover:brightness-110 transition-all`}
              style={{ left: `${left}%`, width: `${Math.max(width, 3)}%` }}
              title={`${formatBookingTime(b.scheduled_at)} · ${b.client?.name}`}
              data-testid={`timeline-block-${b.id}`}
            />
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
        <span>6 AM</span>
        <span>10 AM</span>
        <span>2 PM</span>
        <span>6 PM</span>
        <span>10 PM</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {todays.map((b) => (
          <Link
            key={b.id}
            to={ROUTES.provider.bookingDetail(b.id)}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted hover:bg-accent px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors"
            data-testid={`timeline-chip-${b.id}`}
          >
            {formatBookingTime(b.scheduled_at)} · {b.client?.name?.split(" ")[0]}
            <StatusChip status={b.status} />
          </Link>
        ))}
      </div>
    </section>
  );
};
