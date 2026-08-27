# AGENTS.md — Read This Before Touching Anything

This repository is **OnCall Foot** (`sbtheg17-market/foot`): a three-portal, mobile-first
marketplace OS for in-home foot care. Canonical branch: **`main`**. Canonical stack:
**pnpm workspace · Node 24 · Express 5 · TypeScript · PostgreSQL + Drizzle · React 19 + Vite · Expo**.

Every agent session — Neo, Replit, Fable, Emergent, or any other coding agent — MUST follow
this sequence before inspecting or changing any branch:

## Mandatory read order

1. **`docs/roadmap/NEO_EAGLE_VIEW.md`** — the permanent eagle view: full product vision,
   per-portal capability status with evidence, roadmap priorities, and conflict-handling rules.
   **Always read the copy on `origin/main`, not the copy on the branch you happen to be on.**
2. **`.agents/AGENT-RULES.md`** — coding rules (API contract first, prices in cents, strict
   booking transitions, no generated-file edits, secrets hygiene, portability).
3. **`.agents/SETUP.md`** — environment/continuation setup.
4. **`.agents/NEXT_TASK.md`** — the current gated task state and scope boundaries.
5. **The latest entries in `.agents/LOG.md`** — what was last done and where to resume.

## Mandatory repository verification

6. **Fetch `origin` and verify `origin/main` (full SHA + date) BEFORE trusting any branch.**
   Never rely on an abbreviated SHA from a prior summary.
7. **Classify the branch you are on before making changes:**
   - Run `git merge-base origin/main HEAD`.
   - **If there is NO merge base**, you are on an independent project or a historical
     snapshot (see `docs/roadmap/BRANCH_INVENTORY_V7.md`). Treat it as reference material
     until proven otherwise. Do NOT merge it, do NOT base OnCall Foot work on it.
   - If a branch contains a different `AGENTS.md` or project-instruction file, do NOT
     automatically trust it. Compare it with the copy on `origin/main` first, then classify
     the branch using the inventory.

## Hard rules (permanent)

- `origin/main` of `https://github.com/sbtheg17-market/foot` is the ONLY canonical source
  of truth for OnCall Foot.
- Never merge, cherry-pick from, or base work on any `conflict_*` branch. All 26 are
  classified in `docs/roadmap/BRANCH_INVENTORY_V7.md`; 25 have no merge base with `main`
  and 1 (`conflict_070826_mc2`) is superseded.
- **Comfort-Wiring is a separate reference project** (FastAPI/MongoDB). Its functionality
  reaches OnCall Foot only through a stack-native port (PostgreSQL/Drizzle/Express/React,
  existing auth/RBAC, `node:test`) under its own approved task. Never apply its patches
  directly.
- One scoped task → one reviewed commit → one patch → `.agents/LOG.md` entry.
- Push only dedicated feature branches; `main` changes land by reviewed fast-forward /
  pull request through the approved publication process (`pnpm run publish:gate`).
- Never force-push. Never rewrite published history. Never delete branches without an
  explicit, current, named authorization.

The full 30-step session flow every future agent must follow is in
`docs/roadmap/NEO_EAGLE_VIEW.md` → “Future agent logic flow”.

## Optional continuity aid (non-blocking)

A local Graphify knowledge graph may exist at `graphify-out/graph.json`
(`graphify query|path|explain`; skill: `.agents/skills/graphify/SKILL.md`).
Use it to locate relevant code/docs/migrations faster, then verify against
source — `EXTRACTED` edges are evidence, `INFERRED` edges are hypotheses.
It is optional and never a substitute for the mandatory read order, Git
verification, tests, or review. Policy: `docs/graphify-continuity-workflow.md`.
