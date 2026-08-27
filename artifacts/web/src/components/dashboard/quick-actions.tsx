/**
 * Dashboard quick actions (conversion-first): the three actions a provider
 * reaches for daily — availability, sharing their booking link, bookings.
 * Honest scope: date-specific "emergency slots" / "block off dates" need an
 * availability-exceptions model that does not exist yet (see TODO ledger);
 * no fake buttons are shown for them.
 */
import React from 'react';
import { Link } from 'wouter';
import { CalendarPlus, Share2, CalendarDays } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

const ACTION_CLASS =
  'flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm hover:border-primary/50 transition-colors cursor-pointer';

export default function QuickActions() {
  const scrollToShare = () => {
    document
      .getElementById('booking-link-card')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="Quick actions" data-testid="quick-actions" className="grid grid-cols-3 gap-3">
      <Link
        href={ROUTES.provider.availability}
        data-testid="quick-action-availability"
        className={ACTION_CLASS}
      >
        <CalendarPlus className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">Set availability</span>
      </Link>
      <button
        type="button"
        onClick={scrollToShare}
        data-testid="quick-action-share-link"
        className={ACTION_CLASS}
      >
        <Share2 className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">Share booking link</span>
      </button>
      <Link
        href={ROUTES.provider.bookings}
        data-testid="quick-action-bookings"
        className={ACTION_CLASS}
      >
        <CalendarDays className="w-5 h-5 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold text-foreground">View bookings</span>
      </Link>
    </nav>
  );
}
