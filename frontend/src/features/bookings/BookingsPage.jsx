import { useMemo, useState } from "react";
import { CalendarCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useBookings, useSeedBookings } from "./hooks";
import { BookingCard } from "./BookingCard";
import { TodayTimeline } from "./TodayTimeline";
import { formatBookingDate, isBookingToday } from "../../lib/format";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "history", label: "History" },
];

const FILTERS_BY_TAB = {
  upcoming: [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "accepted", label: "Accepted" },
    { value: "confirmed", label: "Confirmed" },
  ],
  history: [
    { value: "all", label: "All" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "no_show", label: "No-show" },
  ],
};

const EmptyState = ({ tab, hasFilter, onSeed, seeding, onClearFilter }) => (
  <div
    className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 flex flex-col items-start gap-4"
    data-testid="bookings-empty-state"
  >
    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
      <CalendarCheck size={22} />
    </div>
    <div>
      <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">
        {hasFilter ? "Nothing matches this filter" : tab === "history" ? "No past bookings" : "Your inbox is quiet"}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {hasFilter
          ? "Try 'All' to see everything in this tab."
          : tab === "history"
          ? "Completed and cancelled bookings will land here."
          : "Booking requests will show up here once your profile is discoverable. Preview the flow with demo data."}
      </p>
    </div>
    {hasFilter ? (
      <Button
        variant="outline"
        onClick={onClearFilter}
        className="h-11 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200"
        data-testid="bookings-clear-filter-btn"
      >
        Show all
      </Button>
    ) : tab === "upcoming" ? (
      <Button
        onClick={onSeed}
        disabled={seeding}
        className="h-11 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200"
        data-testid="bookings-seed-btn"
      >
        <Sparkles size={16} className="mr-1.5" />
        {seeding ? "Loading…" : "Load demo bookings"}
      </Button>
    ) : null}
  </div>
);

const groupByDay = (bookings) => {
  const groups = new Map();
  bookings.forEach((b) => {
    const label = isBookingToday(b.scheduled_at) ? "Today" : formatBookingDate(b.scheduled_at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(b);
  });
  return Array.from(groups.entries());
};

const SkeletonCard = () => (
  <div className="rounded-2xl border border-black/5 bg-card p-4 space-y-3 animate-pulse">
    <div className="h-3 w-24 bg-muted rounded" />
    <div className="h-5 w-2/3 bg-muted rounded" />
    <div className="h-3 w-1/2 bg-muted rounded" />
  </div>
);

export default function BookingsPage() {
  const [tab, setTab] = useState("upcoming");
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useBookings(tab);
  const seed = useSeedBookings();

  const counts = useMemo(() => {
    const map = { all: (data || []).length };
    (data || []).forEach((b) => {
      map[b.status] = (map[b.status] || 0) + 1;
    });
    return map;
  }, [data]);

  const filtered = useMemo(
    () => (filter === "all" ? data || [] : (data || []).filter((b) => b.status === filter)),
    [data, filter],
  );

  const onSeed = async () => {
    try {
      const res = await seed.mutateAsync();
      toast.success(`Loaded ${res.seeded} demo bookings`);
    } catch (err) {
      toast.error(err.message || "Couldn't load demo data");
    }
  };

  const switchTab = (t) => {
    setTab(t);
    setFilter("all");
  };

  const filterOptions = FILTERS_BY_TAB[tab];
  const grouped = tab === "upcoming" ? groupByDay(filtered) : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 pt-4 pb-3">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Inbox
          </p>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Bookings</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-muted mb-3" data-testid="bookings-tabs">
          {TABS.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`h-9 rounded-full text-sm font-semibold transition-colors duration-200 ${
                  selected ? "bg-white text-foreground shadow-sm" : "text-muted-foreground"
                }`}
                data-testid={`bookings-tab-${t.key}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div
          className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none"
          data-testid="bookings-filters"
        >
          {filterOptions.map((opt) => {
            const selected = filter === opt.value;
            const count = counts[opt.value] || 0;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold border transition-colors duration-200 ${
                  selected
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                }`}
                data-testid={`bookings-filter-${opt.value}`}
              >
                {opt.label}
                {count > 0 && (
                  <span className={`ml-1.5 ${selected ? "opacity-70" : "opacity-60"}`}>
                    · {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-5 py-6 space-y-4" data-testid="bookings-page">
        {tab === "upcoming" && filter === "all" && data && (
          <TodayTimeline bookings={data} />
        )}

        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!isLoading && filtered.length === 0 && (
          <EmptyState
            tab={tab}
            hasFilter={filter !== "all"}
            onSeed={onSeed}
            seeding={seed.isPending}
            onClearFilter={() => setFilter("all")}
          />
        )}

        {!isLoading && grouped && grouped.length > 0 && (
          <div className="space-y-6" data-testid="bookings-list">
            {grouped.map(([label, items]) => (
              <section key={label}>
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  {label}
                </h2>
                <div className="space-y-3">
                  {items.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isLoading && tab === "history" && filtered.length > 0 && (
          <div className="space-y-3" data-testid="bookings-list">
            {filtered.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
