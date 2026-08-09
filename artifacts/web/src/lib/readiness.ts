/**
 * Centralized plain-language metadata for provider activation readiness.
 *
 * The server (GET /providers/me/readiness) is the single source of truth for
 * the C1–C7 criteria values and the `missing` reason codes. This module never
 * derives or recomputes readiness — it only maps server-provided reason codes
 * and criterion keys to user-facing copy and fix destinations.
 *
 * Reason codes are additive-only and never renamed or removed (see the
 * generated `ProviderReadinessMissingCode`), so unknown future codes must
 * degrade gracefully via `labelForCode`.
 */
import { ProviderReadinessMissingCode } from '@workspace/api-client-react';
import type {
  ProviderReadiness,
  ProviderReadinessCriteria,
} from '@workspace/api-client-react';
import { ROUTES } from '@/lib/routes';

export interface ReadinessItemMeta {
  /** Key into the server-provided `criteria` object (C1–C7). */
  criterion: keyof ProviderReadinessCriteria;
  /** Stable reason code the server reports when this criterion is unmet. */
  code: ProviderReadinessMissingCode;
  /** Contract ordinal, C1–C7. */
  ordinal: string;
  /** Plain-language requirement name. */
  title: string;
  /** Copy shown when the criterion is satisfied. */
  doneDescription: string;
  /** Plain-language explanation of the gap when unmet. */
  missingDescription: string;
  /** Call-to-action label for the fix link. */
  fixLabel: string;
  /** Destination that lets the provider close the gap. */
  fixHref: string;
}

/**
 * Display metadata in deterministic C1→C7 contract order. The mapping of
 * criterion → reason code mirrors the documented API contract; satisfaction
 * itself always comes from the server response.
 */
export const READINESS_ITEMS: ReadinessItemMeta[] = [
  {
    criterion: 'approved',
    code: ProviderReadinessMissingCode.NOT_APPROVED,
    ordinal: 'C1',
    title: 'Application approved',
    doneDescription: 'Your provider application and profile verification are approved.',
    missingDescription: 'Your provider application has not been approved yet.',
    fixLabel: 'View application status',
    fixHref: ROUTES.provider.applicationStatus,
  },
  {
    criterion: 'profileComplete',
    code: ProviderReadinessMissingCode.PROFILE_INCOMPLETE,
    ordinal: 'C2',
    title: 'Profile completed',
    doneDescription: 'Your title, city, and bio are filled in.',
    missingDescription: 'Add a title, city, and bio so clients know who you are.',
    fixLabel: 'Complete profile',
    fixHref: ROUTES.provider.profile,
  },
  {
    criterion: 'activeService',
    code: ProviderReadinessMissingCode.NO_ACTIVE_SERVICE,
    ordinal: 'C3',
    title: 'Active service listed',
    doneDescription: 'You have at least one active service clients can book.',
    missingDescription: 'Add at least one active service that clients can book.',
    fixLabel: 'Add or edit service',
    fixHref: ROUTES.provider.services,
  },
  {
    criterion: 'availability',
    code: ProviderReadinessMissingCode.NO_AVAILABILITY,
    ordinal: 'C4',
    title: 'Availability set',
    doneDescription: 'You have at least one weekly availability slot.',
    missingDescription: 'Add at least one weekly availability slot so clients can pick a time.',
    fixLabel: 'Set availability',
    fixHref: ROUTES.provider.availability,
  },
  {
    criterion: 'serviceArea',
    code: ProviderReadinessMissingCode.NO_SERVICE_AREA,
    ordinal: 'C5',
    title: 'Travel zone added',
    doneDescription: 'You have at least one travel zone on file.',
    missingDescription: 'Add at least one travel zone so clients know where you work.',
    fixLabel: 'Review service area',
    fixHref: ROUTES.provider.travelZones,
  },
  {
    criterion: 'acceptingClients',
    code: ProviderReadinessMissingCode.NOT_ACCEPTING_CLIENTS,
    ordinal: 'C6',
    title: 'Accepting new clients',
    doneDescription: 'You are marked as accepting new clients.',
    missingDescription: "Turn on “Accepting new clients” in your profile so you appear bookable.",
    fixLabel: 'Update provider preference',
    fixHref: ROUTES.provider.profile,
  },
  {
    criterion: 'documents',
    code: ProviderReadinessMissingCode.DOCS_PENDING,
    ordinal: 'C7',
    title: 'Documents verified',
    doneDescription: 'Every platform-required document is approved (or none are required).',
    missingDescription: 'A platform-required document still needs an approved verification.',
    fixLabel: 'Review required documents',
    fixHref: ROUTES.provider.credentials,
  },
];

const ITEM_BY_CODE: ReadonlyMap<string, ReadinessItemMeta> = new Map(
  READINESS_ITEMS.map((item) => [item.code, item]),
);

/**
 * Plain-language label for a server reason code. Unknown (future, additive)
 * codes fall back to a humanized version of the code so nothing breaks.
 */
export function labelForCode(code: string): { title: string; description: string } {
  const known = ITEM_BY_CODE.get(code);
  if (known) {
    return { title: known.title, description: known.missingDescription };
  }
  const humanized = code
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
  return { title: humanized, description: 'This requirement still needs attention.' };
}

/** Reason codes present in `missing` that this build has no metadata for. */
export function unknownCodes(readiness: ProviderReadiness): string[] {
  return readiness.missing.filter((code) => !ITEM_BY_CODE.has(code));
}

/** Count of unresolved readiness items, straight from the server response. */
export function unresolvedCount(readiness: ProviderReadiness): number {
  return readiness.missing.length;
}

/** Count of satisfied criteria, read directly from server-provided booleans. */
export function completedCount(readiness: ProviderReadiness): number {
  return READINESS_ITEMS.filter((item) => readiness.criteria[item.criterion]).length;
}

/** Total number of contract criteria (C1–C7). */
export const TOTAL_CRITERIA = READINESS_ITEMS.length;
