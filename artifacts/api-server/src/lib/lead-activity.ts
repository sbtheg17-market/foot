/**
 * Today's Leads — read-only adapter boundary.
 *
 * This slice connects NO lead source. Both provider- and admin-scoped reads
 * return the honest unconnected shell: `connected:false`,
 * `emptyReason:"not_connected"`, `items:[]`. The scope-aware functions below
 * are the seam a future AUTHORIZED source plugs into; until then nothing
 * fabricates leads, counts, traction or source attribution.
 *
 * Ownership filtering for the provider scope lives HERE (the adapter
 * boundary) so it is unit-testable with test-only fixtures, independently of
 * any live source. A fixture-based test of that filter proves a contract, not
 * production lead isolation (there is no production source yet).
 */

export type LeadEmptyReason =
  | "not_connected"
  | "setup_incomplete"
  | "no_active_source"
  | "no_tracked_inquiry"
  | "insufficient_data";

export interface LeadActivityItem {
  id: string;
  source: { name: string; type: string };
  offerRef?: string | null;
  attribution: "known" | "reported" | "unknown";
  vertical: string;
  needSummary: string;
  assignedProviderId?: number | null;
  ownerRole: "provider" | "admin";
  status: string;
  lastUpdate: { summary: string; at: string };
  nextAction: { label: string; dueAt?: string | null };
  relatedBookingId?: number | null;
  origin: string;
}

export interface LeadActivityResponse {
  connected: boolean;
  emptyReason: LeadEmptyReason | null;
  items: LeadActivityItem[];
}

/**
 * A future authorized source implements this. This Phase-1 slice ships no
 * implementation; production always uses the unconnected result below.
 */
export interface LeadSource {
  readonly connected: boolean;
  list(): Promise<LeadActivityItem[]>;
}

/** No lead source is connected in this slice. */
export const NO_SOURCE: LeadSource = {
  connected: false,
  async list(): Promise<LeadActivityItem[]> {
    return [];
  },
};

function unconnected(): LeadActivityResponse {
  return { connected: false, emptyReason: "not_connected", items: [] };
}

/**
 * Provider-scoped read: only leads assigned to this provider profile.
 * `not_connected` (no source at all) is deliberately distinct from
 * `no_tracked_inquiry` (a source IS connected but has no lead for you).
 */
export async function getProviderLeadActivity(
  providerProfileId: number,
  source: LeadSource = NO_SOURCE,
): Promise<LeadActivityResponse> {
  if (!source.connected) return unconnected();
  const all = await source.list();
  const items = all.filter((l) => l.assignedProviderId === providerProfileId);
  return {
    connected: true,
    emptyReason: items.length === 0 ? "no_tracked_inquiry" : null,
    items,
  };
}

/**
 * Admin-scoped read: all authorized + unassigned leads.
 * `not_connected` (no source at all) is deliberately distinct from
 * `no_active_source` (a source IS connected but no offer is active).
 */
export async function getAdminLeadActivity(
  source: LeadSource = NO_SOURCE,
): Promise<LeadActivityResponse> {
  if (!source.connected) return unconnected();
  const items = await source.list();
  return {
    connected: true,
    emptyReason: items.length === 0 ? "no_active_source" : null,
    items,
  };
}
