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
| 102 | 📋 Planned | [Abilities to JSON (abilities.json + dual dispatch, delete the _fireAbility switch)](./issues/102-abilities-to-json.md) | content-migration | #99, #101 | migration plan 2026-07-20, phase 2 |
| 103 | 📋 Planned | [Relic hook bus, run-layer hooks, relics.json, and hero passives](./issues/103-relic-hook-bus-and-passives.md) | content-migration | #99, #102 | migration plan 2026-07-20, phase 3 (riskiest commit) |
| 104 | 📋 Planned | [Enemies and the remaining dispatch surfaces (enemies.json, casts.json, channels, delayed effects)](./issues/104-enemies-and-remaining-dispatch.md) | content-migration | #99, #103 | migration plan 2026-07-20, phase 4 |
| 105 | 📋 Planned | [Run-layer content to JSON (outcome ops + events.json, upgrades.json, modifiers.json)](./issues/105-run-layer-content-to-json.md) | content-migration | #99, #104 | migration plan 2026-07-20, phase 5 |
| 106 | 📋 Planned | [String-id cutover (coverage checks + fallbacks, save v19→20, CLAUDE.md authoring guide)](./issues/106-string-ids-cutover.md) | content-migration | #99, #105 | migration plan 2026-07-20, phase 6 |
| 107 | 📋 Planned | [Two inconsistencies surfaced by the characterization pass](./issues/107-characterization-findings.md) | cleanup | — | findings from #99 (taunt log text, gold-return convention) |
