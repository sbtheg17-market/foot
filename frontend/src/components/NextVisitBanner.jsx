import { Link } from "react-router-dom";
import { Clock, ChevronRight } from "lucide-react";
import { ROUTES } from "../lib/routes";
import { formatBookingTime } from "../lib/format";

/**
 * Soft "next visit" banner. Only renders when there's a confirmed booking
 * scheduled between ~30 min ago and 2 hours from now.
 */
export const NextVisitBanner = ({ nextVisit }) => {
  if (!nextVisit) return null;
  const minutesUntil = Math.round((new Date(nextVisit.scheduled_at) - new Date()) / 60000);
  if (minutesUntil < -30 || minutesUntil > 120) return null;

  const primary =
    minutesUntil <= 0
      ? "Visit is now"
      : minutesUntil < 60
      ? `Next visit in ${minutesUntil} min`
      : `Next visit at ${formatBookingTime(nextVisit.scheduled_at)}`;

  return (
    <Link
      to={ROUTES.provider.bookingDetail(nextVisit.id)}
      className="flex items-center gap-3 rounded-2xl bg-primary/8 border border-primary/20 px-4 py-3 hover:bg-primary/12 transition-colors duration-200"
      data-testid="next-visit-banner"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Clock size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground" data-testid="next-visit-primary">
          {primary}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {nextVisit.client_name} · {nextVisit.service_name}
        </p>
      </div>
      <ChevronRight size={18} className="text-muted-foreground shrink-0" />
    </Link>
  );
};
