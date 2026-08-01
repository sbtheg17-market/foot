import React from "react";
import { cn } from "../lib/utils";

export function EmptyState({ title, message, action, className }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed border-border bg-card/50 px-8 py-16 text-center",
        className
      )}
    >
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
      <span className="mr-3 inline-block h-2 w-2 animate-ping rounded-full bg-primary" />
      {label}
    </div>
  );
}

export function ErrorBlock({ error, retry }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-rose-800">
      <h3 className="font-heading text-base font-semibold">Something went wrong</h3>
      <p className="mt-1 text-sm">{String(error?.message || error || "Unexpected error")}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-4 rounded-full bg-rose-600 text-white px-4 h-10 text-sm font-medium hover:bg-rose-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
