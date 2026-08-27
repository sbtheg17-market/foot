/**
 * Provider Approval Status & Activation Hub — centralized plain-language copy.
 *
 * Every label here renders a server-provided truth from
 * GET /providers/me/activation-status; nothing is recomputed client-side and
 * nothing promises approval, publication, bookings, discovery traffic,
 * payment handling, or revenue.
 */
import { ROUTES } from '@/lib/routes';
import type {
  ProviderActivationNextAction,
  ProviderActivationStatus,
} from '@workspace/api-client-react';

export type ApplicationStatus = ProviderActivationStatus['applicationStatus'];

export const STATUS_COPY: Record<
  ApplicationStatus,
  { label: string; title: string; explanation: string }
> = {
  draft: {
    label: 'Finish setting up',
    title: 'Pick up where you left off',
    explanation:
      'Your account is set up. Finish the remaining onboarding steps to send your application in for review.',
  },
  under_review: {
    label: 'Under review',
    title: 'Your application is under review',
    explanation:
      "Your submission was received. Reviews protect trust for you and your clients — we'll update this page as soon as there's a decision.",
  },
  approved: {
    label: 'Approved',
    title: "You're approved — let's finish your booking setup",
    explanation:
      "Your provider account is active. Complete the remaining setup steps and publish your page when you're ready.",
  },
  rejected: {
    label: 'Update needed',
    title: 'A small update is needed',
    explanation:
      "Review the feedback below, update the requested details, and resubmit — we'll take another look.",
  },
  suspended: {
    label: 'Account needs attention',
    title: 'Your account needs attention',
    explanation:
      "Provider access is currently paused. Contact support and we'll help you continue.",
  },
};

/** Approved-state hero titles refined by how far setup has progressed. */
export const APPROVED_TITLES: Partial<Record<ProviderActivationNextAction, string>> = {
  publish_booking_page: "You're approved and nearly ready to share your booking page",
  share_booking_page: 'Your booking page is live',
  all_set: "You're up and running",
};

export type NextActionCopy = {
  label: string | null;
  href: string | null;
  reason: string;
  support?: boolean;
};

export const NEXT_ACTION_COPY: Record<ProviderActivationNextAction, NextActionCopy> = {
  continue_onboarding: {
    label: 'Continue setup',
    href: ROUTES.onboarding.provider,
    reason: 'Pick up where you left off — your progress is saved.',
  },
  wait_for_review: {
    label: null,
    href: null,
    reason: "No action needed right now. We'll update this page when there's a decision.",
  },
  review_update_needed: {
    label: 'Review the feedback',
    href: '#activation-feedback',
    reason: 'Review the feedback, update your details, and resubmit.',
  },
  contact_support: {
    label: 'Contact support',
    href: null,
    support: true,
    reason: "We'll help you understand the next step.",
  },
  complete_profile: {
    label: 'Complete your profile',
    href: ROUTES.provider.profile,
    reason: "A complete profile helps clients trust who they're booking.",
  },
  configure_service_area: {
    label: 'Add the areas you serve',
    href: ROUTES.provider.serviceArea,
    reason: 'Service areas help clients know you can serve them before they book.',
  },
  add_service: {
    label: 'Add your first service',
    href: ROUTES.provider.services,
    reason: 'Clients book a specific service — add at least one to make your page bookable.',
  },
  set_availability: {
    label: 'Set your availability',
    href: ROUTES.provider.availability,
    reason: 'Availability keeps your booking link accurate and protects your schedule.',
  },
  publish_booking_page: {
    label: 'Publish your booking page',
    href: '#activation-booking-page',
    reason: 'Publishing gives you one professional link to share anywhere.',
  },
  share_booking_page: {
    label: 'Share your booking link',
    href: '#activation-booking-page',
    reason: 'Your first booking is the moment Foot starts saving you coordination time.',
  },
  all_set: {
    label: 'Go to your dashboard',
    href: ROUTES.provider.dashboard,
    reason: "You're fully set up — manage your day from the dashboard.",
  },
};

export type MilestoneKey = keyof ProviderActivationStatus['milestones'];

export type MilestoneDef = {
  key: MilestoneKey;
  label: string;
  why: string;
  /** Portal destination once the application is approved (null = no direct action). */
  approvedHref: string | null;
  /** Destination while the application is still a draft (onboarding funnel). */
  draftHref: string | null;
  actionLabel: string | null;
};

/** Journey order — mirrors the server milestone model exactly. */
export const MILESTONE_DEFS: MilestoneDef[] = [
  {
    key: 'accountCreated',
    label: 'Create your account',
    why: 'Done — your provider account exists.',
    approvedHref: null,
    draftHref: null,
    actionLabel: null,
  },
  {
    key: 'profileCompleted',
    label: 'Complete your provider profile',
    why: 'Clients see your title, city, and bio before they book.',
    approvedHref: ROUTES.provider.profile,
    draftHref: ROUTES.onboarding.provider,
    actionLabel: 'Complete profile',
  },
  {
    key: 'verificationSubmitted',
    label: 'Submit verification',
    why: 'Verification protects trust for you and your clients.',
    approvedHref: ROUTES.provider.credentials,
    draftHref: ROUTES.onboarding.provider,
    actionLabel: 'Submit verification',
  },
  {
    key: 'approved',
    label: 'Get approved',
    why: 'Our review checks your profile and credentials so clients can book with confidence.',
    approvedHref: null,
    draftHref: null,
    actionLabel: null,
  },
  {
    key: 'serviceAreaConfigured',
    label: 'Add service areas',
    why: 'Service areas help clients know you can serve them before they book.',
    approvedHref: ROUTES.provider.serviceArea,
    draftHref: null,
    actionLabel: 'Set service area',
  },
  {
    key: 'activeServiceConfigured',
    label: 'Add at least one service',
    why: 'Clients book a specific service from your page.',
    approvedHref: ROUTES.provider.services,
    draftHref: null,
    actionLabel: 'Add a service',
  },
  {
    key: 'availabilityConfigured',
    label: 'Set availability',
    why: 'Availability keeps your booking link accurate and protects your schedule.',
    approvedHref: ROUTES.provider.availability,
    draftHref: null,
    actionLabel: 'Set availability',
  },
  {
    key: 'bookingPagePublished',
    label: 'Publish booking page',
    why: 'Publishing gives you one professional link to share anywhere.',
    approvedHref: '#activation-booking-page',
    draftHref: null,
    actionLabel: 'Go to publishing',
  },
  {
    key: 'firstBookingReceived',
    label: 'Receive your first booking',
    why: 'Your first booking is the moment Foot starts saving you coordination time.',
    approvedHref: null,
    draftHref: null,
    actionLabel: null,
  },
];

export const VERIFICATION_COPY: Record<
  ProviderActivationStatus['verification']['status'],
  { label: string; body: string }
> = {
  not_started: {
    label: 'Not started',
    body: 'Submit the requested credential reference during onboarding so we can review your application.',
  },
  submitted: {
    label: 'Submitted',
    body: "Your credential reference was received. No action needed — we'll update this page.",
  },
  under_review: {
    label: 'Under review',
    body: "Your submission is being reviewed. No action needed — we'll update this page.",
  },
  needs_update: {
    label: 'Needs update',
    body: 'A document update is needed before review can continue. Update the requested information and submit it again.',
  },
  approved: {
    label: 'Approved',
    body: 'Your verification is approved. Nothing more to do here.',
  },
};
