# Healer Deckbuilder — Issue Backlog

Each issue is a self-contained file in [`issues/`](./issues/) with why / acceptance criteria /
implementation notes (code anchors) / tests / out-of-scope.

**Ordering is implementation sequence, not severity.** Numbers reflect the dependency chain, not
priority. Severity is intentionally not tracked.

**Ground rules baked into the issues:** all winrate gates run at N = 1000 seeds with 95% CIs;
every damage-modifying card/relic/boss mechanic must keep the telegraph preview (`attackTargets()`)
equal to applied damage (a property test); the engine stays pure/DOM-free; each issue ends in a
`jj` commit with its own tests per `CLAUDE.md`.

**Keep this file current:** when an issue lands, flip its row to ✅ Done and update the
[Progress](#progress) line **in the same commit** — or, at latest, a docs commit immediately after.
This table is the single source of truth for where the project stands; a stale Status column costs
the next session real time.

## Legend

- **Phase** — the roadmap milestone the issue belongs to.
- **Depends** — issues that must land first.
- **Addresses** — flaw numbers / open questions / review sections it resolves.
- **Status 📥 Backlog** — a standing holding file (not a buildable issue); its items become their own
  numbered issues when picked up.

## Progress

**Open: 0 — the backlog is clear.** The most recent batch (the 2026-07-06 intake, #45–#59)
landed in full; the completed rows have been cleared from the table below. The issue files
remain in [`issues/`](./issues/) as a historical archive (through #59). The next batch's rows
will be added here when it is written up.

## Issues (implementation order)

_No open issues. Add the next batch's rows here when it is filed._

| # | Status | Issue | Phase | Depends | Addresses |
|---|--------|-------|-------|---------|-----------|
