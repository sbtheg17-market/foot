# Provider Sign-Out — Local Candidate Evidence (2026-08-10)

**Decision basis:** operator approval — "Provider sign-out: APPROVED as a separate
one-file local candidate only." Kept fully separate from Session 063 traceability,
Phase 4C, economics, schema, migrations, and event work.

## Identity

| Item | Value |
|---|---|
| Branch | `provider-signout-100826` |
| Parent | `3e76114ce8ff8908a955d4beac38d6b3cde5dd6a` (canonical `origin/main`, exact) |
| Commit | `0c216d6f9f6bf2bccb34cc5b34878c0aaa46f47d` |
| Tree | `c6e8c1f2cd7d6ec7f24f0ac0908eb45bd2405321` |
| Changed-file scope | exactly 1 file: `artifacts/web/src/components/layout/provider-layout.tsx` (+40 / −2) |
| Patch artifact | `/app/memory/patches/provider-signout.patch` |
| Patch SHA-256 | `2b4ee109aa295f3f387c74bc8f1f9a70b2ec18e316df87f4b24c0939978817bb` |
| Push status | NOT pushed (workspace holds no credential); hand off for separately approved publication |

## Implementation

Mirrors the established client-layout sign-out exactly (inspected first; no second
auth mechanism invented): generated `useLogout` mutation → on success
`localStorage.removeItem('oncallfoot_token')` → `setLocation(ROUTES.login)`.

- Mobile (<md): fixed top-right circular control, `data-testid="provider-signout-button"`,
  `aria-label="Sign out"`, hidden in print.
- Desktop (md+): sidebar bottom action with label,
  `data-testid="provider-signout-button-desktop"`.
- Disabled while the logout mutation is pending.

## Verification (all green)

1. `pnpm --filter @workspace/web run typecheck` — PASS (0 errors).
2. `pnpm --filter @workspace/web run build` — PASS.
3. Manual browser verification via live preview:
   - Desktop 1920px: sign out → redirected to `/login`; `oncallfoot_token` cleared
     (verified `null`); direct visit to `/provider` afterwards redirects to `/login`
     (existing layout guard intact).
   - Mobile 390px: control visible top-right (no overlap with page headers);
     sign out → `/login`.
4. `git diff --check` clean; working tree clean after commit.

No API, schema, generated-client, or route changes. No other file touched.
