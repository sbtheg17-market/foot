# Applied-migration ledger — Supabase managed catalog (2026-09-26)

Gate-B evidence record required by `docs/managed-db-release-gate.md`. Hashes are
SHA-256 of the frozen artifact bytes in `docs/migrations/` at the time of
application; they were re-computed from this checkout on 2026-09-26 by the E2
verification pass (column "Hash matches checkout"). No connection strings,
hostnames beyond the documented pooler, or data are recorded here.

Source of the application record: workspace-only `memory/migration-apply-2026-06.txt`
(gitignored), copied into the repository so the ledger survives workspace loss.

| Artifact | SHA-256 | Hash matches checkout | Applied | How / by whom |
|---|---|---|---|---|
| `PREVENTED_BOOKING_RECORDS_V1.sql` | `138982a19c7427044dfea167ffdbbcc72e6647130cc565f1d23621aef70e29ce` | n/a | before 2026-09-26 | already present in the managed catalog at preflight (E1 session) |
| `PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` | `dc978ccac702affed54c95449a06ed43b30e913a8583208d263d359a9c36f06b` | n/a | before 2026-09-26 | already present in the managed catalog at preflight (E1 session) |
| `PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql` | `139d6b41430d7110d481e3ec3257d9544cdcbfb5f2474f51ea16e411a0ac34dc` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `CANCELLATION_NO_SHOW_SUPPORT_V1.sql` | `b6f253c1e5917ffa0e7cdc038486c5d16fb6cdc04d1f8b6772cb003ea11c8a2b` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `PROVIDER_BLOCKED_RANGES_V1.sql` | `820c079ebc7ed6bb979b0b5b0ff5b853164be16d24e7d68b70ba564dbe79469f` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `PROVIDER_EMERGENCY_OPENINGS_V1.sql` | `9c903becb3ac436687b2de347fb48216c2ba611b82cfa7c8ac6c9928e7280622` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `PROVIDER_SERVICE_AREAS_V1.sql` | `07031aa88d454c7e1f0a5502433ac25e1f5680977984bdd3d66733957396b633` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `RESCHEDULE_PROPOSALS_HISTORY_V1.sql` | `b8a8c5c7facf6dc01ce893360efe28b8fd6a7036847433f3abece308a6bc1ba5` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `PILOT_PROVIDER_RETENTION_V1.sql` | `ceaac6d50e6336fe4c13281ab7de5fc36eca7d96262a771c16a3f8647bf90cad` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |
| `PREVENTED_BOOKINGS_DAILY_V1.sql` | `c4b1896e1e3342cdedd1868a4884719a65e17bf0dfa59a4a238af34f5854a876` | yes | 2026-09-26 | E1 session, user-approved, one transaction each via `scripts/apply-frozen-migrations.py` |

Post-apply verification (E1 session, same day): Drizzle schema vs live catalog
260/260 columns match, 0 missing, 0 extra; preview `GET /api/admin/system-status`
reported 10/10 artifacts applied (`test_reports/iteration_3.json`, preview-only).

Rules unchanged: no further DDL without a new Gate-B review; never re-run an
artifact whose hash differs from this table; any DROP is a hard stop.
