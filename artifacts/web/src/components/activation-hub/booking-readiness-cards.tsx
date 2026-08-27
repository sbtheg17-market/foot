/**
 * Booking-readiness summary — the four setup areas that make a booking page
 * work, each with a truthful state, why it matters, and a direct link to the
 * existing destination. Never duplicates the underlying forms or rules.
 */
import React from 'react';
import { Link } from 'wouter';
import { CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import type { ProviderActivationStatus } from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';

type CardState = 'complete' | 'attention' | 'ready' | 'live' | 'locked';

type Card = {
  key: string;
  title: string;
  state: CardState;
  why: string;
  actionLabel: string;
  href: string;
};

const STATE_LABEL: Record<CardState, string> = {
  complete: 'Complete',
  attention: 'Needs attention',
  ready: 'Ready to publish',
  live: 'Live',
  locked: 'After approval',
};

function cards(activation: ProviderActivationStatus): Card[] {
  const m = activation.milestones;
  const approved = activation.applicationStatus === 'approved';
  const gate = (complete: boolean): CardState =>
    complete ? 'complete' : approved ? 'attention' : 'locked';
  return [
    {
      key: 'service-area',
      title: 'Service area',
      state: gate(m.serviceAreaConfigured),
      why: 'Clients check their area before choosing a time.',
      actionLabel: m.serviceAreaConfigured ? 'Manage service area' : 'Set service area',
      href: ROUTES.provider.serviceArea,
    },
    {
      key: 'services',
      title: 'Services',
      state: gate(m.activeServiceConfigured),
      why: 'Clients book a specific service from your page.',
      actionLabel: m.activeServiceConfigured ? 'Manage services' : 'Add a service',
      href: ROUTES.provider.services,
    },
    {
      key: 'availability',
      title: 'Availability',
      state: gate(m.availabilityConfigured),
      why: m.availabilityConfigured
        ? 'Your bookable times are ready for clients.'
        : 'Add bookable times so clients can choose a slot.',
      actionLabel: m.availabilityConfigured ? 'Manage availability' : 'Set availability',
      href: ROUTES.provider.availability,
    },
    {
      key: 'booking-page',
      title: 'Booking page',
      state: m.bookingPagePublished
        ? 'live'
        : activation.bookingPage.eligible
          ? 'ready'
          : approved
            ? 'attention'
            : 'locked',
      why: 'Your page shows your services and available times behind one link.',
      actionLabel: m.bookingPagePublished ? 'Manage your page' : 'Go to publishing',
      href: '#activation-booking-page',
    },
  ];
}

function StateBadge({ state }: { state: CardState }) {
  const Icon = state === 'complete' || state === 'live' ? CheckCircle2 : state === 'locked' ? Lock : AlertCircle;
  const tone =
    state === 'complete' || state === 'live'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : state === 'locked'
        ? 'bg-secondary text-secondary-foreground border-border'
        : 'bg-amber-50 text-amber-900 border-amber-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {STATE_LABEL[state]}
    </span>
  );
}

export default function BookingReadinessCards({
  activation,
}: {
  activation: ProviderActivationStatus;
}) {
  return (
    <section aria-labelledby="activation-readiness-heading" data-testid="activation-readiness">
      <h2 id="activation-readiness-heading" className="font-serif text-xl font-bold text-foreground">
        Booking readiness
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {cards(activation).map((card) => (
          <div
            key={card.key}
            className="rounded-2xl border border-border bg-card p-4"
            data-testid={`activation-readiness-card-${card.key}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">{card.title}</h3>
              <StateBadge state={card.state} />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{card.why}</p>
            {card.state !== 'locked' &&
              (card.href.startsWith('#') ? (
                <a
                  href={card.href}
                  data-testid={`activation-readiness-action-${card.key}`}
                  className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
                >
                  {card.actionLabel}
                </a>
              ) : (
                <Link
                  href={card.href}
                  data-testid={`activation-readiness-action-${card.key}`}
                  className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
                >
                  {card.actionLabel}
                </Link>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
