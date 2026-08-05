Absolutely — here’s a single master prompt you can paste into Replit to continue the build cleanly and keep GitHub syncing smooth.

## Master prompt

```md
You are continuing an existing build of OnCall Foot, a provider-first marketplace app.

Important context:
- The API server is already running and verified healthy.
- Auth routes work.
- DB schema is live.
- Seed data exists.
- TypeScript is clean.
- docs/commit-strategy.md already exists and should be respected.
- The repo was built in fragments by previous agents, so you must inspect the entire repo before changing anything.
- Keep the provider portal as the active scope for now.
- Do not add client/admin portals yet.
- Do not add monetization UI yet.
- Do not add new seed data unless a checkpoint explicitly requires it.
- Keep GitHub sync frequent and safe.

Your job:
1. Inspect the full repository, not just the newest folder or the latest portal segment.
2. Reconcile fragmented portal builds into one coherent app.
3. Preserve all working backend behavior.
4. Continue building provider-first features only.
5. Keep changes checkpoint-sized and easy to commit/push.
6. Push stable progress to GitHub frequently so work is not lost if the session hits limits.
7. Separate refactors from feature work whenever possible.
8. Report broken references before fixing them.
9. Prefer shared modules over duplicated portal-specific logic where possible.
10. Preserve clean route grouping and canonical provider paths.

Current architecture goals:
- Canonical provider routes should live under /provider/*
- / should redirect to provider home for now
- Keep route constants centralized
- Keep permissions centralized
- Keep ownership checks separate from permission checks
- Preserve the current API/auth/DB/source of truth

Do not:
- rebuild working auth/schema/seed code unless necessary
- create large unrelated refactors in the same commit as feature work
- add client/admin UI
- add monetization UI
- add new seed data unless explicitly needed
- make giant unpushed diffs

Workflow rules:
- Before coding, scan the whole repo and give a short plan.
- Work in small checkpoints.
- After each coherent stable unit, prepare a clean git commit.
- If a checkpoint is partially complete, push the stable parts rather than waiting forever.
- Keep commit messages checkpoint-based and descriptive.
- If you need to touch shared structure, do that in a separate cleanup commit before feature commits.
- Keep the repo in a state that can be resumed safely from GitHub.

Current product direction:
- Provider-first marketplace
- Future client portal and admin portal exist in the roadmap, but not in current scope
- Business flow should move toward services, availability, bookings, earnings, invoices, and trust signals
- UI should stay mobile-first and operational

Suggested next focus if backend work is not yet complete:
- provider business routes
- services
- availability
- bookings
- earnings/invoices later
- provider portal React frontend after backend routes are ready

Before making changes, output:
1. A brief repo map
2. What is fragmented or duplicated
3. What you will keep as canonical
4. The next checkpoint plan

Then proceed incrementally.
```

## Optional shorter version

If you want a tighter version for a quick paste:

```md
Continue OnCall Foot provider-first.

First inspect the whole repo and reconcile all fragmented portal builds into one coherent app. The API/auth/DB/seed data are already verified, so preserve those as source of truth.

Rules:
- keep /provider/* as canonical provider routes
- / redirects to provider home
- no client/admin UI yet
- no monetization UI yet
- no new seed data unless checkpoint requires it
- keep commits small and push stable progress to GitHub frequently
- separate refactors from feature work
- report broken references before changing them
- use centralized route constants and permissions
- preserve working backend behavior

Before coding:
1. repo map
2. fragmentation report
3. canonical structure
4. next checkpoint plan

Then build provider-first in checkpoint-sized increments.
```

If you want, I can also make this into a **more aggressive “execute mode” prompt** that tells Replit exactly how to handle checkpoints, commits, and pushes step-by-step.