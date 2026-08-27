/**
 * Next Best Action card (Provider Dashboard Phase A).
 *
 * Renders the server-derived, journey-ordered `nextAction` from the existing
 * Activation Hub endpoint (GET /providers/me/activation-status). No
 * activation/business logic is recomputed client-side, and nothing here ever
 * claims approval, publication, demand, or bookings the server cannot prove.
 * Non-blocking: loading shows a small skeleton and errors fall back to a
 * quiet link to the Approval Status hub — the rest of the dashboard always
 * renders.
 */
import React from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Compass,
  Hourglass,
} from 'lucide-react';
import {
  useGetMyProviderActivationStatus,
  getGetMyProviderActivationStatusQueryKey,
} from '@workspace/api-client-react';
import type { ProviderActivationNextAction } from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';

type Tone = 'setup' | 'waiting' | 'attention' | 'ready';

type ActionView = {
  heading: string;
  why: string;
  actionLabel: string;
  /** Route destination; null → in-page scroll to the booking-link card. */
  href: string | null;
  tone: Tone;
};

/**
 * Dashboard-scoped presentation of each server nextAction code. Deep links
 * reuse existing provider routes only; publish/share resolve to the
 * dashboard's own BookingPageCard (the existing publish/share/QR surface).
 * Pre-approval and paused states point to the legitimate status hub —
 * never a dead or forbidden route.
 */
const ACTION_VIEWS: Record<ProviderActivationNextAction, ActionView> = {
  continue_onboarding: {
    heading: 'Finish setting up your account',
    why: 'Complete the remaining onboarding steps to send your application in for review.',
    actionLabel: 'Continue setup',
    href: ROUTES.onboarding.provider,
    tone: 'setup',
  },
  wait_for_review: {
    heading: 'Your application is under review',
    why: "Your verification details were received. We'll guide you through the next setup step when review is complete.",
    actionLabel: 'View application status',
    href: ROUTES.provider.applicationStatus,
    tone: 'waiting',
  },
  review_update_needed: {
    heading: 'A small update is needed',
    why: "Review the feedback, update the requested details, and resubmit — we'll take another look.",
    actionLabel: 'Review the feedback',
    href: ROUTES.provider.applicationStatus,
    tone: 'attention',
  },
  contact_support: {
    heading: 'Your account needs attention',
    why: "Provider access is currently paused. Your status page has the support contact — we'll help you continue.",
    actionLabel: 'View application status',
    href: ROUTES.provider.applicationStatus,
    tone: 'attention',
  },
  complete_profile: {
    heading: 'Complete your profile',
    why: "Clients see your title, city, and bio before they book — a complete profile helps them trust who they're booking.",
    actionLabel: 'Complete profile',
    href: ROUTES.provider.profile,
    tone: 'setup',
  },
  configure_service_area: {
    heading: 'Finish your service area',
    why: 'Clients confirm you serve their area before they choose a booking time.',
    actionLabel: 'Set service area',
    href: ROUTES.provider.serviceArea,
    tone: 'setup',
  },
  add_service: {
    heading: 'Add your first service',
    why: 'Clients book a specific service — add at least one to make your page bookable.',
    actionLabel: 'Add a service',
    href: ROUTES.provider.services,
    tone: 'setup',
  },
  set_availability: {
    heading: 'Set your availability',
    why: 'Availability keeps your booking link accurate and protects your schedule.',
    actionLabel: 'Set availability',
    href: ROUTES.provider.availability,
    tone: 'setup',
  },
  publish_booking_page: {
    heading: 'Publish your booking page',
    why: 'Share one professional link so clients can view your services and available times.',
    actionLabel: 'Publish booking page',
    href: null,
    tone: 'setup',
  },
  share_booking_page: {
    heading: 'Your page is live — share your booking link',
    why: 'Share your booking link anywhere clients already find you.',
    actionLabel: 'Share booking page',
    href: null,
    tone: 'ready',
  },
  all_set: {
    heading: "You're all set",
    why: 'Your booking page and schedule are ready. Keep your availability current as your week changes.',
    actionLabel: 'View booking page',
    href: null, // resolved from the server bookingPage.path at render time
    tone: 'ready',
  },
};

const TONE_STYLES: Record<Tone, { icon: React.ReactNode; badge: string; label: string }> = {
  setup: {
    icon: <Compass className="w-5 h-5" aria-hidden="true" />,
    badge: 'bg-primary/10 text-primary',
    label: 'Next step',
  },
  waiting: {
    icon: <Hourglass className="w-5 h-5" aria-hidden="true" />,
    badge: 'bg-secondary text-secondary-foreground',
    label: 'In review',
  },
  attention: {
    icon: <CircleAlert className="w-5 h-5" aria-hidden="true" />,
    badge: 'bg-amber-100 text-amber-700',
    label: 'Needs attention',
  },
  ready: {
    icon: <CircleCheck className="w-5 h-5" aria-hidden="true" />,
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Ready',
  },
};

const ACTION_BUTTON_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold ' +
  'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

function scrollToBookingLinkCard() {
  document
    .getElementById('booking-link-card')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function NextBestActionCard() {
  const { data, isLoading, isError } = useGetMyProviderActivationStatus({
    query: { queryKey: getGetMyProviderActivationStatusQueryKey(), retry: false },
  });
  const activation = data?.activation;

  if (isLoading) {
    return (
      <div
        className="bg-secondary/60 rounded-3xl animate-pulse h-28"
        data-testid="next-action-loading"
        aria-hidden="true"
      />
    );
  }

  // Quiet, non-blocking fallback: the legitimate status hub always has the
  // full truthful picture; nothing on the dashboard is gated on this card.
  if (isError || !activation) {
    return (
      <section
        className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
        data-testid="next-action-error"
        aria-label="Next step"
      >
        <span>We couldn't load your next step right now.</span>
        <Link
          href={ROUTES.provider.applicationStatus}
          data-testid="next-action-status-link"
          className="font-semibold text-primary hover:underline underline-offset-4"
        >
          View your application status
        </Link>
      </section>
    );
  }

  const view = ACTION_VIEWS[activation.nextAction];
  const tone = TONE_STYLES[view.tone];
  // all_set links to the live public page the server proves exists;
  // publish/share resolve to the dashboard's own BookingPageCard.
  const href =
    activation.nextAction === 'all_set' ? activation.bookingPage.path : view.href;

  return (
    <section
      className="bg-card border border-border rounded-3xl p-6 space-y-4"
      data-testid="next-action-card"
      data-action={activation.nextAction}
      aria-labelledby="next-action-heading"
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-full shrink-0 ${tone.badge}`}>{tone.icon}</div>
        <div className="min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            data-testid="next-action-tone"
          >
            {tone.label}
          </p>
          <h2
            id="next-action-heading"
            className="text-lg font-serif font-semibold text-foreground mt-0.5"
          >
            {view.heading}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{view.why}</p>
        </div>
      </div>
      {href ? (
        <Link href={href} data-testid="next-action-primary" className={ACTION_BUTTON_CLASS}>
          {view.actionLabel}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={scrollToBookingLinkCard}
          data-testid="next-action-primary"
          className={ACTION_BUTTON_CLASS}
        >
          {view.actionLabel}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
