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

**The process lives in the `issues` skill** — intake, completing an issue (status flip + row
removal), and implementing all open issues (one subagent per issue, sequential). This file is the
data: the ground rules above, the Intake list, and the table.

## Legend

- **Phase** — the roadmap milestone the issue belongs to.
- **Depends** — issues that must land first.
- **Addresses** — flaw numbers / open questions / review sections it resolves.
- **Status 📥 Backlog** — a standing holding file (not a buildable issue); its items become their own
  numbered issues when picked up.

## Intake

Brief notes I've taken that need to be written up as issues — see the `issues` skill for the intake
process.

_(empty)_

## Issues (implementation order)

| # | Status | Issue | Phase | Depends | Addresses |
|---|--------|-------|-------|---------|-----------|
