import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Clock, StickyNote, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { ROUTES } from "../../lib/routes";
import { formatApiErrorDetail } from "../../lib/api";
import { formatBookingDateTime, formatMoney } from "../../lib/format";
import { StatusChip, BOOKING_STATUS_LABEL } from "./StatusChip";
import { useBooking, useUpdateBookingStatus } from "./hooks";

const ACTIONS_BY_STATUS = {
  pending: [
    { target: "accepted", label: "Accept", variant: "primary" },
    { target: "cancelled", label: "Decline", variant: "danger", reason: "declined_by_provider" },
  ],
  accepted: [
    { target: "confirmed", label: "Confirm", variant: "primary" },
    { target: "cancelled", label: "Cancel", variant: "danger", reason: "cancelled_by_provider" },
  ],
  confirmed: [
    { target: "completed", label: "Mark completed", variant: "primary" },
    { target: "no_show", label: "No-show", variant: "muted" },
    { target: "cancelled", label: "Cancel", variant: "danger", reason: "cancelled_by_provider" },
  ],
};

const ActionButton = ({ action, onClick, disabled }) => {
  const base = "h-12 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200 flex-1 min-w-[120px]";
  const cls =
    action.variant === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : action.variant === "danger"
      ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
      : "bg-muted text-foreground hover:bg-accent";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${cls} disabled:opacity-60`}
      data-testid={`booking-action-${action.target}`}
    >
      {action.label}
    </button>
  );
};

const Row = ({ icon: Icon, label, value, href, mono }) => {
  const content = (
    <>
      <div className="h-9 w-9 rounded-xl bg-secondary text-primary flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p
          className={`text-sm ${href ? "text-primary font-semibold" : "text-foreground"} ${mono ? "font-mono" : ""} whitespace-pre-wrap break-words`}
        >
          {value || "—"}
        </p>
      </div>
    </>
  );
  const base = "flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg";
  if (href && value) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
        className={`${base} hover:bg-muted transition-colors duration-200 active:scale-[0.98]`}
        data-testid={`booking-row-${label.toLowerCase()}`}
      >
        {content}
      </a>
    );
  }
  return (
    <div className={base} data-testid={`booking-row-${label.toLowerCase()}`}>
      {content}
    </div>
  );
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: b, isLoading, isError } = useBooking(id);
  const update = useUpdateBookingStatus();

  const runAction = async (action) => {
    try {
      await update.mutateAsync({ id, status: action.target, reason: action.reason });
      toast.success(`Booking ${action.target.replace("_", " ")}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
  };

  const actions = b ? ACTIONS_BY_STATUS[b.status] || [] : [];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          data-testid="booking-back-btn"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-foreground">Booking</h1>
      </header>

      <main className="px-5 py-6 space-y-6" data-testid="booking-detail">
        {isLoading && (
          <div className="rounded-2xl bg-card border border-black/5 p-6 space-y-3 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-6 w-3/4 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Couldn't load this booking. It may have been removed.
            <Link to={ROUTES.provider.bookings} className="ml-2 underline font-semibold">Back to inbox</Link>
          </div>
        )}

        {b && (
          <>
            <section className="rounded-2xl bg-card border border-black/5 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {formatBookingDateTime(b.scheduled_at)}
                </p>
                <StatusChip status={b.status} size="lg" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground" data-testid="booking-service-name">
                {b.service?.name}
              </h2>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock size={14} /> {b.service?.duration_minutes} min
                </span>
                <span className="font-semibold text-foreground">
                  {formatMoney(b.service?.price_cents, b.service?.currency)}
                </span>
              </div>
            </section>

            {actions.length > 0 && (
              <section className="flex flex-wrap gap-2" data-testid="booking-actions">
                {actions.map((a) => (
                  <ActionButton key={a.target} action={a} onClick={() => runAction(a)} disabled={update.isPending} />
                ))}
              </section>
            )}

            <section className="rounded-2xl bg-card border border-black/5 p-3">
              <Row icon={User} label="Client" value={b.client?.name} />
              <Row
                icon={Phone}
                label="Phone"
                value={b.client?.phone}
                href={b.client?.phone ? `tel:${(b.client.phone || "").replace(/[^\d+]/g, "")}` : null}
                mono
              />
              <Row
                icon={MapPin}
                label="Address"
                value={[b.client?.address, b.client?.pincode].filter(Boolean).join(" · ")}
                href={
                  b.client?.address
                    ? `https://maps.google.com/?q=${encodeURIComponent([b.client.address, b.client.pincode].filter(Boolean).join(", "))}`
                    : null
                }
              />
              <Row icon={StickyNote} label="Notes" value={b.notes} />
            </section>

            <section className="rounded-2xl bg-card border border-black/5 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Status history
              </h3>
              <ol className="space-y-3" data-testid="booking-history">
                {(b.status_history || []).map((h, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {BOOKING_STATUS_LABEL[h.status] || h.status}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.at).toLocaleString("en-US", {
                          month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                        {h.reason ? ` · ${h.reason.replace(/_/g, " ")}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </main>
    </>
  );
}
