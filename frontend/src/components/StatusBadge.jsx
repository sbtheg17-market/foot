import React from "react";
import { cn } from "../lib/utils";

const MAP = {
  requested: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  declined: "bg-rose-100 text-rose-800",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
        MAP[status] || "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {status}
    </span>
  );
}
