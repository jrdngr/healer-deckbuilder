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

- 

## Issues (implementation order)

| # | Status | Issue | Phase | Depends | Addresses |
|---|--------|-------|-------|---------|-----------|
| 60 | 📋 Open | [Deploy screen: smart slot selection + drag-and-drop](issues/60-deploy-slot-selection-dnd.md) | ux (deploy) | #50 (soft) | intake 2026-07-07 (deploy slot UX) |
| 61 | 📋 Open | [Sentinel: a Stun party member and the Stun ability](issues/61-sentinel-stun-member.md) | content (roster + ability) | — | intake 2026-07-07 (stun member) |
| 62 | 📋 Open | [Hero buff card batch](issues/62-hero-buff-card-batch.md) | content (cards) | — | intake 2026-07-07 (buff cards) |
