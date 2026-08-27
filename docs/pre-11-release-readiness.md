# Pre-#11 release-readiness verdict — 2026-08-24

Scope: verification-only gate over roadmap items #1–#10. No product behavior
changed in this gate beyond the file-hygiene fixes listed in §3. Roadmap #11
was NOT started.

## 1. Verified main

`origin/main` = `17b1bf9589f9665630346af3a85d110debcd170a`
("test: establish web mobile and CI coverage (#46)"), local checkout equal,
working tree clean. #9 = PRs #44/#45 (`a911d22…`); #10 = PR #46.

## 2. Work completed through #10 (verified in code, not only docs)

- Booking marketplace with role-gated portals (client/provider/admin), JWT +
  bcrypt auth, RBAC, hardened booking state machine, availability enforcement,
  provider onboarding/verification, reviews, retention/analytics
  (prevented-booking records, replay + DLQ isolation), marketplace-timezone
  display, notifications (SSE + best-effort Expo push).
- #9: consent-first provider rescheduling — pending proposals (idempotency
  keys, single-active, limit 3), client accept/decline, lazy expiry with
  original-time preservation, append-only history (atomic with the time
  change), acceptance re-validation, authorization/non-leak errors, web +
  mobile UI, additive migration artifact `RESCHEDULE_PROPOSALS_HISTORY_V1.sql`.
  Approved policy values live in
  `artifacts/api-server/src/lib/reschedule-policy.ts` and match
  `docs/rescheduling-policy.md` (implementation record + merge record).
- #10: 16-job GitHub Actions matrix (`.github/workflows/ci.yml`), web Vitest
  layer (60 tests incl. accessibility + timezone/DST), mobile typecheck +
  deterministic Expo exports, disposable-PostgreSQL API/migration/smoke jobs,
  secret scan, diff check, docs (`test-coverage-matrix.md` §8,
  `TODO-LEDGER.md`, `native-device-checklist.md`).

## 3. This gate's changes (docs/hygiene only)

- `.gitignore`: ignore `artifacts/api-server/var/` (runtime DLQ output that
  tripped the Session-080 scope guard on clean checkouts) and `/test_reports/`
  (external agent-harness output). No runtime behavior change.
- Stale-status corrections (append-only notes): `README.md` verification/CI
  section, `docs/NEXT-STEPS.md`, `docs/test-coverage-matrix.md` header,
  `docs/PRD.md`, `replit.md`, `docs/rescheduling-policy.md` merge record,
  `docs/TODO-LEDGER.md` per-item review, continuity handoff entry.

## 4. Tests run at this gate (2026-08-24, disposable local PostgreSQL 15 only)

| Check | Result |
|---|---|
| `pnpm run typecheck` / `build` / `build:deploy` | PASS |
| `pnpm test` (API unit 70 + web 60) | PASS |
| 22 scripted API suites (fresh DB + built server) | PASS — 295/295 |
| Unscripted API suites | PASS — 71/71 (replay 14/14 on its own fresh DB) |
| Daily-rebuild suite | 25/26 → 26/26 after the `var/` gitignore fix; the 1 failure was the scope guard tripping on the runtime `var/` dir, not a product defect |
| Web tests / a11y subset / tz-DST subset | PASS — 60/60, 10/10, 10/10 |
| Mobile typecheck | PASS (workspace typecheck) |
| Expo iOS / Android exports | PASS locally via `--no-bytecode` (arm64 host); full-bytecode exports green in CI (x86_64) |
| Migration checks (push ×2, seed ×2, startup) | PASS |
| Smoke (healthz, login, 6 routes → 401 not 404, SPA) | PASS |
| Secret scan / `git diff --check` | PASS |
| GitHub Actions on `main` `17b1bf9` | PASS — 16/16 jobs |
| Native-device verification | BLOCKED — no devices; NEVER performed |
| Real-browser (Playwright) E2E | NOT RUN — not implemented (deferred) |

## 5. Migration / database status

Schema work is test-only: disposable local/CI PostgreSQL exclusively. Frozen
additive artifacts (`docs/migrations/*.sql`) are hash-checked in CI and never
auto-applied. Managed-database access: **NONE**. The managed-DB release gate
(`docs/managed-db-release-gate.md`) remains **open** (backup/restore evidence +
read-only catalog verification outstanding).

## 6. Production deployment status

NOT AUTHORIZED and not performed. CI has no deploy job; `railway.json`,
`nixpacks.toml`, `Procfile` unchanged. The `deploy-build` job proves build
parity only.

## 7. Known limitations (do not promise past these)

1. **Native devices:** zero verification ever (alerts, push taps, cold start,
   permissions, token lifecycle, device timezones, deep links) —
   `docs/native-device-checklist.md`.
2. **Reminders:** none. Proposal expiry is lazy; nobody is nudged before a
   deadline.
3. **Payments:** foundation primitives only; no checkout, refunds, payouts, or
   invoicing money-movement.
4. **Service-area/travel:** policy designed, not enforced; providers can be
   booked without feasibility checks beyond availability windows.
5. **Browser E2E / contrast:** jsdom-level a11y only; no real-browser run.
6. **Notification persistence for clients / email / SMS:** not implemented;
   push is best-effort.
7. **Managed-DB gate open** (§5) — blocks any real-data pilot.

## 8. Verdict

| Level | Verdict |
|---|---|
| Internal demo (seeded data, web) | **SUITABLE** |
| Controlled provider pilot (real users, real bookings) | **NOT YET** — requires the managed-DB release gate, deployment authorization, at least one native-device verification pass, and an operator-approved support/reminder story |
| Paid pilot | **NOT SUITABLE** — payments are not implemented |
| Public launch | **NOT SUITABLE** |
| Live financial operation | **NOT SUITABLE** |

Top release risks: unverified native mobile behavior; open managed-DB gate;
no reminders (expiry surprises); no service-area enforcement (infeasible
bookings); no real-browser validation.

## 9. Exact next step for #11

Operator reviews this gate report, then authorizes roadmap item #11 as a fresh
scoped session from `origin/main`. Deferred work is scheduled ONLY from
`docs/TODO-LEDGER.md` (pre-#11 review section, 2026-08-24). Stale open PR #2
disposition (recommend: close without merge) is an operator decision recorded
in the ledger.

---

## Addendum — 2026-08-26 (post-#12)

Roadmap #11 (provider public booking pages, PR #48) and #12 (service-area
eligibility + travel/setup buffer, PR #49 `a0083e7` + the 2026-08-26
completion PR #50) are merged since this gate. §7 item 4 and the "no
service-area enforcement (infeasible bookings)" top-release-risk line are
CLOSED: providers now manage Canada-first FSA coverage, eligibility is
server-authoritative before slot selection, and a centrally managed
30-minute travel/setup buffer applies to new bookings and future
reschedules. All other §7 limitations (native devices, reminders, payments,
browser E2E, client notification persistence, managed-DB gate) remain OPEN
and the §8 verdict levels are unchanged. Authoritative state:
`docs/TODO-LEDGER.md` roadmap #12 section.

## Post-#13 addendum (2026-08-26)

Roadmap #13 (cancellation/no-show policy + minimal support workflow) landed
after this review; it adds `CANCELLATION_NO_SHOW_SUPPORT_V1.sql` to the frozen
additive artifacts and two new test suites (`test` pure-unit additions,
`test:cancellation` integration, wired into CI `api-tests`). The deferred rows
above are unchanged except service-area (closed by #12) — payments, reminders,
native-device verification, and the managed-DB gate remain open. See
`docs/cancellation-no-show-policy.md` and `docs/TODO-LEDGER.md`.

Provider onboarding recovery (2026-08-28) landed after this review: the
verification-document submission 500 (Gate B drift, 42703 via bare-select
`getOwnProfile()`) is fixed drift-safe/transactional/idempotent, the missing
frozen artifact `PROVIDER_APPLICATION_REJECTION_REASON_V1.sql` was added
(Gate B-pending, managed DB not accessed), and CI gained the
`test:verification` suite. See
`docs/provider-verification-onboarding-policy.md`.
