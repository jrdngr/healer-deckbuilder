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

**Open: 54–59 — the 2026-07-06 intake batch (15 issues); #45 (remove path-selection travel
animation), #46 (fix the "Continue saved run" button), #47 (enemy targets/telegraphs dead
players) #48 (view-deck button in the topbar), #49 (injury badges on party members), #50
(remember party positions between fights), #51 (replace the starting deck with the heal-only
six), #52 (Regen rework: magnitude == duration, additive stacking) and #53 (passive MP only
when ≤1 card played) have landed, 6 remaining.** Ordered quick isolated fixes
first, then self-contained engine rules, then draft/map structure, then the reward flow, and last
the between-fight-healing rework (**#58**, which carries the balance pass — so it lands after every
other balance-affecting change and its N=1000 sweep tunes the settled system); the pure-cosmetic
gold animation (**#59**) is dead last. See [ISSUE_INTAKE.md](./ISSUE_INTAKE.md) for the raw source
bullets.

## Issues (implementation order)

| # | Status | Issue | Phase | Depends | Addresses |
|---|--------|-------|-------|---------|-----------|
| 45 | ✅ Done | [Remove path-selection travel animation](./issues/45-remove-path-selection-animation.md) | fix | — | intake 2026-07-06 |
| 46 | ✅ Done | [Fix "Continue saved run" button](./issues/46-fix-continue-saved-run.md) | fix | — | intake 2026-07-06 |
| 47 | ✅ Done | [Enemy targets/telegraphs dead players](./issues/47-enemy-targets-dead-players.md) | fix | — | intake 2026-07-06 |
| 48 | ✅ Done | [View-deck button in the topbar](./issues/48-topbar-deck-view-button.md) | fix | — | intake 2026-07-06 |
| 49 | ✅ Done | [Injury badges on party members](./issues/49-injury-badges-on-members.md) | fix | — | intake 2026-07-06 |
| 50 | ✅ Done | [Remember party positions between fights](./issues/50-remember-party-positions.md) | fix | — | intake 2026-07-06 |
| 51 | ✅ Done | [Replace the starting deck with the heal-only six](./issues/51-starting-deck-composition.md) | rules | — | intake 2026-07-06 |
| 52 | ✅ Done | [Regen rework: magnitude == duration](./issues/52-regen-magnitude-duration-rework.md) | rules | — | intake 2026-07-06 |
| 53 | ✅ Done | [Passive MP only when ≤1 card played](./issues/53-passive-mp-gate-on-cards-played.md) | rules | — | intake 2026-07-06 |
| 54 | 🔲 Todo | [Ability cards on member death](./issues/54-ability-cards-on-member-death.md) | rules | — | intake 2026-07-06 |
| 55 | 🔲 Todo | [Starting draft from the full pool](./issues/55-draft-from-full-pool.md) | structure | — | intake 2026-07-06 |
| 56 | 🔲 Todo | [Recruiter cadence; drop post-boss recruit](./issues/56-recruiter-node-cadence.md) | structure | — | intake 2026-07-06 |
| 57 | 🔲 Todo | [Card reward after every won fight](./issues/57-card-rewards-on-win.md) | economy | — | intake 2026-07-06 |
| 58 | 🔲 Todo | [Partial heal + Infirmary + resurrect (balance pass)](./issues/58-percentage-heal-infirmary-resurrect.md) | economy | 54, 56, 57 | intake 2026-07-06 |
| 59 | 🔲 Todo | [End-of-fight gold animation](./issues/59-end-of-fight-gold-animation.md) | fx | 57 | intake 2026-07-06 |
