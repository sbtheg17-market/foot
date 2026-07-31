import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ChevronRight, TrendingUp } from "lucide-react";
import { useEarnings } from "./hooks";
import { formatMoney, formatBookingDate } from "../../lib/format";
import { ROUTES } from "../../lib/routes";

const PERIOD_TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

export default function EarningsPage() {
  const [period, setPeriod] = useState("week");
  const { data, isLoading } = useEarnings();
  const p = data?.[period] || { total_cents: 0, count: 0 };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Money in</p>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Earnings</h1>
        </div>
        <Link
          to={ROUTES.provider.invoices}
          className="h-11 rounded-full px-4 flex items-center gap-1.5 bg-secondary text-primary font-semibold text-sm active:scale-95 transition-transform duration-200"
          data-testid="earnings-invoices-link"
        >
          <FileText size={16} /> Invoices
        </Link>
      </header>

      <main className="px-5 py-6 space-y-6" data-testid="earnings-page">
        <div className="grid grid-cols-3 gap-2 p-1 rounded-full bg-muted" data-testid="earnings-period-tabs">
          {PERIOD_TABS.map((t) => {
            const selected = period === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setPeriod(t.key)}
                className={`h-9 rounded-full text-sm font-semibold transition-colors duration-200 ${
                  selected ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                }`}
                data-testid={`earnings-tab-${t.key}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <section className="rounded-2xl bg-primary text-primary-foreground p-6" data-testid="earnings-hero">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80 mb-2">
            {PERIOD_TABS.find((t) => t.key === period)?.label}
          </p>
          <p className="text-4xl font-bold tracking-tight mb-1" data-testid="earnings-total">
            {formatMoney(p.total_cents)}
          </p>
          <p className="text-sm opacity-90 flex items-center gap-1.5">
            <TrendingUp size={14} />
            {p.count} completed booking{p.count === 1 ? "" : "s"}
          </p>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Recent completions
          </h3>
          {isLoading && (
            <div className="rounded-2xl bg-card border border-black/5 p-4 h-16 animate-pulse" />
          )}
          {!isLoading && (data?.recent || []).length === 0 && (
            <p className="text-sm text-muted-foreground italic" data-testid="earnings-empty">
              Completed bookings will show here as they roll in.
            </p>
          )}
          {!isLoading && (data?.recent || []).length > 0 && (
            <div className="space-y-2" data-testid="earnings-recent">
              {data.recent.map((b) => (
                <Link
                  key={b.booking_id}
                  to={ROUTES.provider.bookingDetail(b.booking_id)}
                  className="flex items-center gap-3 rounded-2xl bg-card border border-black/5 p-4 hover:shadow-md hover:-translate-y-0.5 transition-shadow duration-200"
                  data-testid={`earnings-item-${b.booking_id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{b.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {b.service_name} · {formatBookingDate(b.scheduled_at)}
                    </p>
                  </div>
                  <p className="font-bold text-foreground">{formatMoney(b.price_cents)}</p>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
