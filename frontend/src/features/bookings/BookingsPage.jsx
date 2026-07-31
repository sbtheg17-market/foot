import { useState } from "react";
import { CalendarCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { useBookings, useSeedBookings } from "./hooks";
import { BookingCard } from "./BookingCard";
import { formatBookingDate, isBookingToday } from "../../lib/format";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "history", label: "History" },
];

const EmptyState = ({ tab, onSeed, seeding }) => (
  <div
    className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 flex flex-col items-start gap-4"
    data-testid="bookings-empty-state"
  >
    <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-primary">
      <CalendarCheck size={22} />
    </div>
    <div>
      <h3 className="text-xl font-bold tracking-tight text-foreground mb-1">
        {tab === "history" ? "No past bookings" : "Your inbox is quiet"}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {tab === "history"
          ? "Completed and cancelled bookings will land here."
          : "Booking requests will show up here once your profile is discoverable. Preview the flow with demo data."}
      </p>
    </div>
    {tab === "upcoming" && (
      <Button
        onClick={onSeed}
        disabled={seeding}
        className="h-11 rounded-full px-5 font-semibold active:scale-95 transition-transform duration-200"
        data-testid="bookings-seed-btn"
      >
        <Sparkles size={16} className="mr-1.5" />
        {seeding ? "Loading…" : "Load demo bookings"}
      </Button>
    )}
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
  const { data, isLoading } = useBookings(tab);
  const seed = useSeedBookings();

  const onSeed = async () => {
    try {
      const res = await seed.mutateAsync();
      toast.success(`Loaded ${res.seeded} demo bookings`);
    } catch (err) {
      toast.error(err.message || "Couldn't load demo data");
    }
  };

  const grouped = tab === "upcoming" && data ? groupByDay(data) : null;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 pt-4 pb-3">
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Inbox
          </p>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Bookings</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-muted" data-testid="bookings-tabs">
          {TABS.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
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
      </header>

      <main className="px-5 py-6 space-y-4" data-testid="bookings-page">
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <EmptyState tab={tab} onSeed={onSeed} seeding={seed.isPending} />
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

        {!isLoading && tab === "history" && data && data.length > 0 && (
          <div className="space-y-3" data-testid="bookings-list">
            {data.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
