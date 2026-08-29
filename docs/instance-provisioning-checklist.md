# Instance Provisioning Checklist — one isolated provider/client instance

**Added:** 2026-08-29. Companion to
`docs/canonical-prototype-and-instance-model.md` (authoritative operating
model — read it first).

Use one copy of this checklist per instance. Record outcomes (labels, dates,
versions, statuses only) in the instance registry. **Never** write
credentials, connection strings, tokens, keys, recovery codes, or any
provider/client personal or booking data into this checklist, the registry,
Git, Graphify, screenshots, tickets, or chat. This checklist contains no real
credentials and no provider-specific values — keep it that way.

Standing formula:

```text
One client/provider instance
= one GitHub account/repository
+ one Railway account/project
+ one Supabase project/database
+ one deployment configuration
+ one private client dataset
+ one tracked release/migration/backup record
```

---

## Ownership

- [ ] Ownership model chosen and recorded (platform-managed /
      provider-owned / shared-admin) — recommended: provider-owned with
      documented platform-admin support access.
- [ ] Who pays GitHub/Railway/Supabase costs — answered and recorded.
- [ ] Who owns domain registration — answered and recorded.
- [ ] Who owns the provider/client data — answered and recorded.
- [ ] Account recovery contact — named and recorded.
- [ ] Who can approve migrations/deployments — named and recorded.
- [ ] Who receives billing/uptime alerts — named and recorded.
- [ ] Offboarding outcome and access-revocation list — agreed and recorded.
- [ ] Registry row created (`instance_id`, `business_display_name`,
      `vertical`, `region`, `timezone`, owner/operator labels,
      `instance_status = provisioning`).

## Repository

- [ ] Tested canonical release tag/SHA selected
      (`canonical_release_tag` recorded).
- [ ] New isolated GitHub account confirmed (not the canonical account, not a
      shared org).
- [ ] New repository created from the approved template/release archive — not
      a live fork tracking canonical `main`.
- [ ] Repository visibility set to private.
- [ ] Repository access limited to the recorded owner/operator; no canonical
      collaborators inherited by accident.
- [ ] Recovery path for the GitHub account documented (owner-held).
- [ ] `github_account_label` and `github_repo_name` recorded in the registry.

## Railway

- [ ] Separate Railway account confirmed (per ownership model).
- [ ] Separate Railway project created; no shared project with any other
      instance or with the canonical prototype.
- [ ] App service configured from the repo (`railway.json` /
      `nixpacks.toml`: build `pnpm run build:deploy`, start `pnpm run start`,
      healthcheck `/api/healthz`).
- [ ] Environment/service variables set through Railway's variable manager
      only.
- [ ] Billing ownership confirmed and recorded (`billing_owner_label`).
- [ ] `railway_account_label`, `railway_project_label`,
      `railway_environment_label` recorded in the registry.

## Supabase

- [ ] Separate Supabase project created; one project = this instance only.
- [ ] PostgreSQL database reachable from the Railway service (connection
      configured via secret manager, never written down elsewhere).
- [ ] Actual plan/backup capability of THIS project verified — no assumed
      vendor guarantees (Supabase Free may not provide backups/PITR).
- [ ] Database credentials stored only in the native secret manager /
      password manager.
- [ ] `supabase_project_label` recorded in the registry.

## Secrets

- [ ] `DATABASE_URL`, `JWT_SECRET`, and all other required variables
      (`docs/deployment-notes.md`) set only in native platform secret
      managers.
- [ ] `JWT_SECRET` newly generated for this instance — never reused from the
      canonical prototype or any other instance.
- [ ] No secret present in the repository, registry, checklist, chat, or
      screenshots (`scripts/secret-scan.sh` clean on the instance repo).
- [ ] Secret rotation/recovery responsibility assigned per the ownership
      model.

## Backup/recovery

- [ ] Backup method documented for this instance (`backup_method` recorded)
      — logical export procedure required when managed backups are
      unavailable/unverified.
- [ ] Initial backup/export performed and privately stored (never in Git,
      never in Graphify).
- [ ] Backup verified readable (`backup_verified_date` recorded).
- [ ] Restore test performed on a disposable target
      (`last_restore_test_date` recorded).
- [ ] Standing rule acknowledged: fresh private backup/export before every
      schema change.

## Migration state

- [ ] Only approved, frozen, hash-verified migration artifacts applied
      (`docs/migrations/*.sql` discipline; SHA-256 verified before apply).
- [ ] No startup-time schema push anywhere in the deployment (prohibited).
- [ ] `database_schema_version`, `latest_migration_artifact`,
      `latest_migration_date` recorded in the registry.
- [ ] Migration applied only after the backup/recovery section above is
      complete.

## Configuration

- [ ] Approved business display name, branding/colors/logo configured.
- [ ] Vertical vocabulary/service templates configured (configuration only —
      no core-logic edits).
- [ ] Region/timezone configured and verified against booking display.
- [ ] Support contact configured.
- [ ] Public booking-page copy reviewed (honest, no lead guarantees, no fake
      urgency).
- [ ] Local policy copy legally reviewed where applicable.
- [ ] Confirmed: no authorization, booking, rescheduling, privacy, schema, or
      protected-route changes were made for this instance.

## Domain

- [ ] Domain/subdomain chosen and configured (`domain_label` recorded).
- [ ] DNS ownership confirmed and recorded (`dns_owner_label`).
- [ ] TLS active and verified.
- [ ] Canonical public booking URL resolves to this instance only.

## Privacy

- [ ] Instance database contains no data from any other instance and none
      from the canonical prototype.
- [ ] Seeded demonstration data only until real provider onboarding; no real
      provider/client data used for testing or demos.
- [ ] Public payloads verified privacy-safe (no client identities, no
      reviewer-private notes, no internal metadata).
- [ ] Data ownership and retention expectations recorded per the ownership
      model.

## Provider/client smoke test

- [ ] Full journey run on the deployed instance with fresh test accounts,
      following `docs/pilot/provider-client-journey-validation.md`:
      provider signup → status hub → profile → service → territory →
      availability → emergency opening → time off → publish → share link →
      client booking → reschedule → cancellation preview.
- [ ] Admin approval gate verified (provider bookable only after
      application + verification approval).
- [ ] Mobile-viewport pass verified.
- [ ] Test accounts removed or clearly marked as demo data afterwards.
- [ ] `last_smoke_test_date` and `open_blocker_count` recorded.

## Release/version record

- [ ] `deployed_commit_sha` and `canonical_release_tag` recorded.
- [ ] Migration ledger up to date for this instance.
- [ ] Smoke-test evidence recorded (dates/results — no client data).
- [ ] `instance_status` updated. Readiness rule: no instance may be marked
      ready until backup/export, migration, smoke-test, and domain/ownership
      checks are all recorded.

## Handover/offboarding

- [ ] Provider access handed over per the ownership model (controlled
      credentials handoff through a secure channel — never chat/email
      plaintext).
- [ ] Platform-admin support access documented and provider-acknowledged.
- [ ] Upgrade/migration authorization process agreed (who approves, how
      releases arrive).
- [ ] Offboarding procedure on file: data export to owner, access revocation
      list, account/billing transfer, registry `offboarding_status` update.
- [ ] On offboarding: all operator access revoked, final backup delivered to
      the data owner, registry row closed.
