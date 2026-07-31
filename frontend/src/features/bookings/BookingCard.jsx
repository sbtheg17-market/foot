import { Link } from "react-router-dom";
import { ChevronRight, Clock } from "lucide-react";
import { ROUTES } from "../../lib/routes";
import { formatBookingDate, formatBookingTime, formatMoney, isBookingToday } from "../../lib/format";
import { StatusChip } from "./StatusChip";

export const BookingCard = ({ booking }) => {
  const today = isBookingToday(booking.scheduled_at);
  return (
    <Link
      to={ROUTES.provider.bookingDetail(booking.id)}
      className="block rounded-2xl bg-card border border-black/5 p-4 hover:shadow-md hover:-translate-y-0.5 transition-shadow duration-200"
      data-testid={`booking-card-${booking.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {today ? "Today" : formatBookingDate(booking.scheduled_at)}
            </p>
            <span className="text-xs text-muted-foreground">·</span>
            <p className="text-xs font-semibold text-foreground">
              {formatBookingTime(booking.scheduled_at)}
            </p>
          </div>
          <h3 className="text-base font-bold tracking-tight text-foreground truncate">
            {booking.client?.name || "Unnamed client"}
          </h3>
          <p className="text-sm text-muted-foreground truncate">{booking.service?.name}</p>
        </div>
        <StatusChip status={booking.status} />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {booking.service?.duration_minutes} min
          </span>
          <span className="font-semibold text-foreground">
            {formatMoney(booking.service?.price_cents, booking.service?.currency)}
          </span>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </div>
    </Link>
  );
};
