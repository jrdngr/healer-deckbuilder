# Healer Deckbuilder — Issue Backlog

Each issue is a self-contained file in [`issues/`](./issues/) with why / acceptance criteria /
implementation notes (code anchors) / tests / out-of-scope.

**Ordering is implementation sequence, not severity.** Numbers reflect the dependency chain, not
priority. Severity is intentionally not tracked.

**Ground rules baked into the issues:** all winrate gates run at N = 1000 seeds with 95% CIs;
every damage-modifying card/relic/boss mechanic must keep the telegraph preview (`attackTargets()`)
equal to applied damage (a property test); the engine stays pure/DOM-free; each issue ends in a
`jj` commit with its own tests per `CLAUDE.md`.

**This table lists only open issues.** It is the single source of truth for what is left to do.

## Completing an issue

When an issue lands:

1. **Update the issue file's own status.** Flip its `- **Status:**` line (the first list item in
   the file) to `✅ Complete` **in the same commit** as the work.
2. **Remove the issue's row from this file.** Once the file's status is updated, delete the row from
   the [Issues table](#issues-implementation-order) below. The issue file stays in [`issues/`](./issues/)
   as the historical archive — the table only ever shows what is still open.

## Implementing all open issues

When I say **"implement all open issues"** (or anything like it), work through every open issue in
the [Issues table](#issues-implementation-order) below:

1. **One subagent per issue, fresh context.** Implement each issue by dispatching a subagent (the
   Agent tool) whose entire job is that single issue. Each issue gets its own clean context — do not
   carry one issue's working context into the next.
2. **Sequential, not parallel.** Implement issues in table order (which is dependency order). Launch
   the next issue's subagent only **after** the previous one has fully finished. Never run issue
   subagents concurrently.
3. **Each subagent completes the issue end to end** per `CLAUDE.md` and the "Completing an issue"
   rules above: implement the change, add tests, run `npm test` and `npm run typecheck`, flip the
   issue file's `- **Status:**` line to `✅ Complete`, remove its row from the table, and land its
   own `jj` commit.

## Legend

- **Phase** — the roadmap milestone the issue belongs to.
- **Depends** — issues that must land first.
- **Addresses** — flaw numbers / open questions / review sections it resolves.
- **Status 📥 Backlog** — a standing holding file (not a buildable issue); its items become their own
  numbered issues when picked up.

## Intake

Brief notes I've taken that need to be written up as issues. When I say **"run issue intake"**, go
through this list and, for each note:

1. **Interview me** about anything unclear, ambiguous, or that needs my input before writing (scope,
   acceptance criteria, dependencies, balance targets). Don't guess on decisions that are mine to make.
2. **Write a self-contained issue file** in [`issues/`](./issues/) (next number in sequence) with the
   standard shape: a `- **Status:**` line as the **first list item** (new issues start `📋 Open`),
   then Phase / Depends / Addresses, then why / acceptance criteria / implementation notes (code
   anchors) / tests / out-of-scope.
3. **Add its row** to the [Issues table](#issues-implementation-order) below.
4. **Remove the note** from this Intake list once it has become an issue.

_(empty — all current notes written up as issues #79–#83 on 2026-07-11.)_

## Issues (implementation order)

| # | Status | Issue | Phase | Depends | Addresses |
|---|--------|-------|-------|---------|-----------|
| 83 | 📋 Open | [Post-boss healer boon (remove Sanctum node)](issues/83-post-boss-healer-boon.md) | run structure | — | intake 2026-07-11 |
