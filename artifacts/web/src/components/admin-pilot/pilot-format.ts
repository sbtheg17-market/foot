/**
 * Display helpers for the platform-administrator pilot dashboard.
 * Vertical-neutral: labels describe generic appointment-platform signals.
 */
import type {
  PilotProviderMetricsActivationStatus,
  PilotProviderMetricsOnboardingMilestones,
} from '@workspace/api-client-react';

/** Round a 0..1 rate to a whole percent; null stays null (honest empty copy). */
export function formatPercent(rate: number | null): string | null {
  if (rate === null) return null;
  return `${Math.round(rate * 100)}%`;
}

export function formatPilotDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Friendly, non-punitive follow-up labels for Part 1 risk flags. */
export const RISK_FLAG_LABELS: Record<string, string> = {
  not_activated: 'Setup incomplete',
  not_published: 'Ready but not shared',
  no_booking_yet: 'No booking yet',
  high_cancellation_rate: 'Review cancellations',
  high_no_show_rate: 'Review no-shows',
  retention_risk: 'Check in with provider',
};

export function riskFlagLabel(flag: string): string {
  return RISK_FLAG_LABELS[flag] ?? flag.replace(/_/g, ' ');
}

export const ACTIVATION_STATUS_LABELS: Record<PilotProviderMetricsActivationStatus, string> = {
  not_started: 'Not started',
  in_progress: 'Setting up',
  ready_to_publish: 'Ready to publish',
  published: 'Published',
  first_booking: 'First booking',
  active: 'Active',
};

/** Provider journey, in order — mirrors Part 1 onboarding milestones. */
export const MILESTONE_STEPS: Array<{
  key: keyof PilotProviderMetricsOnboardingMilestones;
  label: string;
}> = [
  { key: 'accountCreated', label: 'Account created' },
  { key: 'profileCompleted', label: 'Profile complete' },
  { key: 'verificationSubmitted', label: 'Verification submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'serviceAreaConfigured', label: 'Service area set' },
  { key: 'serviceConfigured', label: 'Service added' },
  { key: 'availabilityConfigured', label: 'Availability added' },
  { key: 'bookingPagePublished', label: 'Booking page published' },
  { key: 'firstBookingReceived', label: 'First booking received' },
];

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  'qr-card': 'QR card',
  qr_card: 'QR card',
  text: 'Text message',
  facebook: 'Facebook',
  website: 'Website',
  other: 'Other',
  unknown: 'Direct / unknown',
};

export function sourceLabel(source: string): string {
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source];
  const cleaned = source.replace(/[-_]+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
