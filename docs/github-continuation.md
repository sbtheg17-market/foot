# GitHub Continuation & Access

This repository is portable across Replit workspaces, local clones, coding
agents, and AI models. GitHub is the source of truth for code and history.

## Important boundary

Any account or model can inspect and modify a local clone, but only the
authenticated GitHub account can push to the remote. Repository files cannot
grant GitHub write permission.

For direct pushes to `sbtheg17-market/foot`, the GitHub account must have
write access through one of these paths:

- The account owns the repository.
- The account is a collaborator or member of a team with write access.
- The account works from a personal fork and opens a pull request to the
  canonical repository.

Connect the account through the host's GitHub integration or credential
manager. Never paste a token, password, private key, or connection string into
the repository, a command, a prompt, or a log.

## New-account setup

Run these commands from a clean clone:

```bash
git clone https://github.com/sbtheg17-market/foot.git
cd foot
git switch main
git fetch origin --prune
pnpm run git:check
```

Set the commit identity locally if needed. This identifies commits; it does
not authenticate pushes:

```bash
git config --local user.name "Your Name"
git config --local user.email "your-verified-email@example.com"
```

## Safe checkpoint workflow

Before editing:

```bash
git fetch origin --prune
git switch main
git pull --ff-only origin main
pnpm run git:check
```

After editing and verification:

```bash
git status --short --branch
git diff --check
git add <scoped-files>
git commit -m "Describe the user benefit of this checkpoint"
git push origin main
pnpm run git:check
```

Keep commits focused and push stable checkpoints normally. Never force-push,
reset, rebase, or amend published history as part of routine continuation.

## Fork workflow

Use a fork when the current account cannot push to the canonical repository:

```bash
git remote rename origin upstream
git remote add origin https://github.com/<your-account>/foot.git
git fetch --all --prune
git switch -c <short-feature-name>
git push -u origin <short-feature-name>
```

Open a pull request from the fork branch to `sbtheg17-market/foot:main`.
Do not change the canonical remote or rewrite local history to work around a
permission error.

## Diagnosing access

Read access and write access are separate:

```bash
# Confirms the remote is reachable and the branch exists.
git ls-remote --exit-code origin refs/heads/main

# Shows configured remotes without revealing credentials.
git remote -v

# Shows local/remote divergence after fetch.
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
```

Expected synchronized state is:

```text
HEAD == origin/main
ahead/behind == 0 0
working tree clean
```

If `git push` reports `Invalid username or token`, `Authentication failed`,
or permission denied:

1. Stop retrying guessed credentials.
2. Confirm the account has write permission or use the fork workflow.
3. Reconnect the host's GitHub integration or credential manager.
4. Fetch again and compare hashes.
5. Preserve verified local commits; do not force-push or rewrite history.

An AI model cannot repair missing GitHub account authorization. The account
owner must grant access or authenticate through the host's secure flow.

## Uploaded files and secrets

Files under `attached_assets/` are workspace uploads, not source code. Pasted
prompts, critiques, continuation logs, screenshots, and temporary handoffs
must remain untracked. The repository ignores future `Pasted-*` text uploads;
already tracked historical uploads are not automatically removed by Git.

Never commit:

- passwords, tokens, API keys, private keys, or `.env` files;
- database connection strings;
- uploaded prompts, critiques, or temporary handoff files;
- private provider documents, reviewer notes, care notes, or personal data.

## Canonical repository vs. isolated instance repositories (added 2026-08-29)

`sbtheg17-market/foot` is the **canonical prototype repository** (OnCall
Foot). Future provider/client instances live in **separate GitHub accounts
and repositories** created from an approved canonical release tag/template —
they are never branches of this repository, never forks tracking `main`, and
never shared write targets. Generalizable, security-, privacy-, scheduling-,
or conversion-sensitive changes are developed and tested here first, then
reach instances as versioned releases. Instance repositories must never be
added as remotes of this clone, and instance credentials or client data must
never be committed here. See
`docs/canonical-prototype-and-instance-model.md` and
`docs/instance-provisioning-checklist.md`.