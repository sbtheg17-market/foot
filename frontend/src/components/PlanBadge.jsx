import React from "react";
import { cn } from "../lib/utils";
import { Sparkles, Award, Leaf } from "lucide-react";

const MAP = {
  free: { label: "Free", cls: "bg-gray-100 text-gray-700", Icon: Leaf },
  pro: { label: "Pro", cls: "bg-blue-100 text-blue-800", Icon: Award },
  premium: { label: "Premium", cls: "bg-orange-100 text-orange-800", Icon: Sparkles },
};

export default function PlanBadge({ plan, className }) {
  const { label, cls, Icon } = MAP[plan] || MAP.free;
  return (
    <span
      data-testid={`plan-badge-${plan}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
        cls,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
