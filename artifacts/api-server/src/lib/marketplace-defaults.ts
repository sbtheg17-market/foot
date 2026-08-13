/**
 * Default marketplace identity — single source of truth
 * (docs/roadmap/ANALYTICS_PREVENTED_BOOKINGS_V1.md §3;
 * docs/roadmap/EXTENSIBILITY_BLUEPRINT_V1.md §1–§2).
 *
 * Before Blueprint Step 2 introduces the `marketplaces` table, every record
 * that requires an explicit tenant key carries this reserved identifier —
 * never inferred, never null, never omitted, never buried in metadata.
 *
 * Blueprint Step 2's additive migration MUST create the default marketplace
 * row with exactly this id and slug so all historical rows join cleanly with
 * zero backfill rewriting.
 */
export const DEFAULT_MARKETPLACE_ID = 1;
export const DEFAULT_MARKETPLACE_SLUG = "oncall-foot";
