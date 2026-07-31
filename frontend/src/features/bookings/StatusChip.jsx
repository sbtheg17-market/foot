import { CheckCircle2, Clock, XCircle, AlertCircle, CircleDot, UserX } from "lucide-react";

const CONFIG = {
  pending: { label: "Pending", cls: "bg-amber-500/15 text-amber-800", icon: Clock },
  accepted: { label: "Accepted", cls: "bg-blue-500/15 text-blue-800", icon: CircleDot },
  confirmed: { label: "Confirmed", cls: "bg-primary/15 text-primary", icon: CheckCircle2 },
  completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-800", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", cls: "bg-destructive/10 text-destructive", icon: XCircle },
  no_show: { label: "No show", cls: "bg-muted text-muted-foreground", icon: UserX },
};

export const StatusChip = ({ status, size = "sm" }) => {
  const cfg = CONFIG[status] || { label: status, cls: "bg-muted text-muted-foreground", icon: AlertCircle };
  const Icon = cfg.icon;
  const px = size === "lg" ? "px-3 py-1" : "px-2 py-0.5";
  const text = size === "lg" ? "text-xs" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${px} ${text} ${cfg.cls}`}
      data-testid={`booking-status-chip-${status}`}
    >
      <Icon size={size === "lg" ? 12 : 11} />
      {cfg.label}
    </span>
  );
};

export const BOOKING_STATUS_LABEL = Object.fromEntries(
  Object.entries(CONFIG).map(([k, v]) => [k, v.label]),
);
