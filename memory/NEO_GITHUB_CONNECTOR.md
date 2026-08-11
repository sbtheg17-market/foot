# Neo GitHub Connector — OnCall Foot

## Status: ACTIVE (write access verified)

- **Repo:** git@github.com:sbtheg17-market/foot.git (github.com/sbtheg17-market/foot)
- **Auth:** SSH deploy key with write access
  - Private key: `~/.ssh/neo_foot_deploy` (ed25519, in this environment only)
  - Public key fingerprint comment: `neo-connector@oncallfoot`
  - SSH config: `~/.ssh/config` (Host github.com → IdentityFile ~/.ssh/neo_foot_deploy)
- **Local clone:** `/tmp/foot` (branch main, remote origin over SSH)
  - Git identity: `Neo Connector <neo-connector@oncallfoot.local>`

## Verification log (all passed)
1. `ssh -T git@github.com` → authenticated as `sbtheg17-market/foot` deploy key
2. `git ls-remote origin HEAD` → 401a9d7 (read OK)
3. Pushed + deleted test ref `neo-connector-write-test` → write OK, no residue

## Operating rules (approval workflow)
- NO pushes to `main` or any branch without explicit user approval in chat.
- Approved changes flow: create branch → commit approved content (instructions/logs/md/patches) → push branch → report back with branch name/PR link.
- Never force-push, never rewrite history, never delete branches other than Neo-created test/work branches.
- Conflict recon report: `/app/memory/NEO_ENTRY_conflict_branch_recon.md`

## Note
- Local clone lives in /tmp — if the environment restarts, re-clone:
  `git clone git@github.com:sbtheg17-market/foot.git /tmp/foot`
  (SSH key in ~/.ssh persists with the app container state; if missing, a new deploy key must be generated and re-added on GitHub.)
