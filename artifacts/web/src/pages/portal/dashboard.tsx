import React from 'react';
import { useGetMyProviderProfile, useListBookings, useGetMyEarnings } from '@workspace/api-client-react';
import { Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'wouter';
import ReadinessSummaryCard from '@/components/readiness-summary-card';
import FirstBookingCard from '@/components/first-booking-card';
import { Eye } from 'lucide-react';

export default function PortalDashboard() {
  const { data: profileRes, isLoading: loadingProfile } = useGetMyProviderProfile({
    query: { queryKey: ['my-profile'] }
  });
  
  const { data: bookingsRes, isLoading: loadingBookings } = useListBookings(
    { status: 'requested' },
    { query: { queryKey: ['bookings', 'requested'] } }
  );

  const { data: upcomingBookingsRes } = useListBookings(
    { status: 'confirmed' },
    { query: { queryKey: ['bookings', 'confirmed'] } }
  );

  const { data: earningsRes } = useGetMyEarnings({
    query: { queryKey: ['my-earnings'] }
  });

  if (loadingProfile || loadingBookings) {
    return <div className="p-6 pt-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  const profile = profileRes?.provider;
  const requestedCount = bookingsRes?.total || 0;
  const upcomingCount = upcomingBookingsRes?.total || 0;

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-serif font-bold text-foreground">
          Hello, {profile?.firstName}
        </h1>
        <p className="text-muted-foreground mt-1">Here's your business at a glance.</p>
      </header>

      {/* Activation readiness summary (server-computed; links to canonical page) */}
      <ReadinessSummaryCard />

      {/* First-booking conversion: server-confirmed activation only */}
      <FirstBookingCard />

      <Link href="/provider/listing-preview">
        <div
          data-testid="dashboard-listing-preview-link"
          className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
        >
          <div className="bg-primary/10 p-2 rounded-full text-primary"><Eye className="w-5 h-5" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Preview my listing</h3>
            <p className="text-sm text-muted-foreground">See exactly how clients will view and book you.</p>
          </div>
        </div>
      </Link>

      {/* Action required alerts */}
      {requestedCount > 0 && (
        <Link href="/provider/bookings">
          <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-start gap-4 cursor-pointer hover:bg-accent/15 transition-colors">
            <div className="mt-0.5 bg-accent/20 p-2 rounded-full text-accent">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">New booking requests</h3>
              <p className="text-sm text-muted-foreground">You have {requestedCount} pending request{requestedCount > 1 ? 's' : ''} to review.</p>
            </div>
          </div>
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-3xl font-serif font-bold text-foreground">{upcomingCount}</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">Upcoming</p>
        </div>
        <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground mb-3">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-3xl font-serif font-bold text-foreground">{earningsRes?.completedBookings || 0}</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">Completed</p>
        </div>
      </div>

      {/* Earnings Summary Card */}
      <Link href="/provider/earnings">
        <div className="bg-primary text-primary-foreground rounded-3xl p-6 shadow-md relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <p className="text-primary-foreground/80 font-medium mb-1 relative z-10">Lifetime Earnings</p>
          <h2 className="text-4xl font-serif font-bold relative z-10">
            ${((earningsRes?.totalCents || 0) / 100).toFixed(2)}
          </h2>
          <div className="mt-4 pt-4 border-t border-white/20 flex justify-between items-center relative z-10">
            <span className="text-sm font-medium text-primary-foreground/90">View payout details</span>
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              ${((earningsRes?.pendingPayoutCents || 0) / 100).toFixed(2)} pending
            </span>
          </div>
        </div>
      </Link>

      {/* Upcoming list short */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-serif font-semibold">Next Up</h2>
          <Link href="/provider/bookings" className="text-sm font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        
        {upcomingBookingsRes?.bookings.length === 0 ? (
          <div className="bg-secondary/50 rounded-2xl p-6 text-center border border-border/50">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No upcoming appointments</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBookingsRes?.bookings.slice(0, 3).map(booking => (
              <div key={booking.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-secondary flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {new Date(booking.scheduledAt).toLocaleString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-lg font-serif font-bold text-foreground leading-none mt-0.5">
                    {new Date(booking.scheduledAt).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {new Date(booking.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground truncate">{booking.address}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
