import { useState } from "react";
import { CalendarCheck, Briefcase, Wallet, Star, ChevronRight, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProviderSummary } from "../features/services/hooks";
import { VerificationSheet } from "../features/verification/VerificationSheet";
import { ProfileCompletionCard } from "../components/ProfileCompletionCard";
import { VerificationBadge } from "../components/VerificationBadge";
import { ROUTES } from "../lib/routes";
import { formatMoney } from "../lib/format";

const StatCard = ({ label, value, sub, testId }) => (
  <div
    className="rounded-2xl bg-card border border-black/5 p-4 flex-1 min-w-0"
    data-testid={testId}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-1">
      {label}
    </p>
    <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

export default function Home() {
  const { user } = useAuth();
  const { data: summary } = useProviderSummary();
  const [verifOpen, setVerifOpen] = useState(false);
  const firstName = user?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const activeServices = summary?.active_services ?? 0;
  const upcomingBookings = summary?.upcoming_bookings ?? 0;
  const earningsCents = summary?.earnings_week_cents ?? 0;
  const verification = summary?.verification_status || user?.verification_status || "draft";
  const hasAvailability = !!summary?.has_availability;
  const hasTravel = !!summary?.has_travel_zone;

  const quickLinks = [
    {
      to: ROUTES.provider.bookings,
      label: "Bookings inbox",
      desc: upcomingBookings > 0 ? `${upcomingBookings} upcoming` : "No requests yet",
      icon: CalendarCheck,
      testId: "home-link-bookings",
    },
    {
      to: ROUTES.provider.services,
      label: "My services",
      desc: activeServices > 0 ? `${activeServices} active` : "Add your first service",
      icon: Briefcase,
      testId: "home-link-services",
    },
    {
      to: ROUTES.provider.availability,
      label: "Availability & travel",
      desc: hasAvailability && hasTravel ? "Set" : hasAvailability ? "Add travel zone" : "Set your hours",
      icon: CalendarClock,
      testId: "home-link-availability",
    },
    {
      to: ROUTES.provider.earnings,
      label: "Earnings",
      desc: "Coming in Checkpoint 5",
      icon: Wallet,
      testId: "home-link-earnings",
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/5 px-5 py-4">
        <div className="flex items-center gap-3">
          {user?.photo ? (
            <img src={user.photo} alt={user.name} className="h-11 w-11 rounded-full object-cover" data-testid="home-avatar" />
          ) : (
            <div className="h-11 w-11 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold" data-testid="home-avatar">
              {firstName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{greeting}</p>
            <h1 className="text-lg font-bold tracking-tight text-foreground" data-testid="home-greeting">{firstName}</h1>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 space-y-6">
        <section className="rounded-2xl bg-primary text-primary-foreground p-6 relative overflow-hidden" data-testid="home-hero-card">
          <button
            type="button"
            onClick={() => setVerifOpen(true)}
            className="absolute top-4 right-4 z-10 active:scale-95 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 rounded-full"
            data-testid="home-verification-chip"
            aria-label="Verification details"
          >
            <VerificationBadge status={verification} />
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80 mb-2">Your practice</p>
          <h2 className="text-2xl font-bold tracking-tight mb-1">
            {upcomingBookings > 0
              ? `${upcomingBookings} upcoming booking${upcomingBookings === 1 ? "" : "s"}`
              : activeServices > 0
              ? "You're open for business"
              : "Finish setting up"}
          </h2>
          <p className="text-sm opacity-90 leading-relaxed">
            {upcomingBookings > 0
              ? "Head to the inbox to accept, confirm and complete your visits."
              : activeServices > 0
              ? "Booking requests will appear in the inbox as they come in."
              : "Add services next so clients know what you offer."}
          </p>
        </section>

        <ProfileCompletionCard completion={summary?.profile_completion} />

        <section className="flex gap-3" data-testid="home-stats">
          <StatCard label="Upcoming" value={upcomingBookings} sub={activeServices > 0 ? `${activeServices} active service${activeServices === 1 ? "" : "s"}` : ""} testId="stat-upcoming" />
          <StatCard label="This week" value={formatMoney(earningsCents)} sub="No completed bookings yet" testId="stat-earnings" />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Quick access</h3>
          {quickLinks.map(({ to, label, desc, icon: Icon, testId }) => (
            <Link
              key={to}
              to={to}
              data-testid={testId}
              className="flex items-center gap-4 rounded-2xl bg-card border border-black/5 p-4 hover:shadow-md hover:-translate-y-0.5 transition-shadow duration-200"
            >
              <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center text-primary shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{label}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </Link>
          ))}
        </section>

        <section className="rounded-2xl bg-card border border-black/5 p-5 flex items-center gap-4" data-testid="home-reviews-teaser">
          <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center text-primary shrink-0">
            <Star size={20} />
          </div>
          <div>
            <p className="font-semibold text-foreground">Reviews</p>
            <p className="text-sm text-muted-foreground">Client reviews will appear here once you complete bookings.</p>
          </div>
        </section>
      </main>

      <VerificationSheet open={verifOpen} onOpenChange={setVerifOpen} status={verification} />
    </>
  );
}
