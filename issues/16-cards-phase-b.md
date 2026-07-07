# Issue 16 — Card set phase B: small-new-state cards (P7b)

- **Status:** ✅ Complete
- **Roadmap phase:** P7 (b)   **Size:** M
- **Depends on:** #15 (and #02 for the shield-expiry field)   **Blocks:** #17
- **Addresses:** review §3.2 (Verdant finisher, Blood, Tempo)

## Why
The cards that need a little new state: a HoT with a delayed burst, a cost-shift, a party-wide
damage buff, a one-phase mass shield, and the Blood (HP-as-resource) archetype. All Blood
self-damage is **never-lethal** — no new death path in `playCard`.

## Scope / acceptance criteria
- [ ] **Lifebloom** — 3 MP, single, uncommon 50g. Regen 2 for 3 turns; when the Regen ends while
      the target lives (expiry, overwrite, or Bloom-consume) → burst-heal 3. Death forfeits.
- [ ] **Surge** — 2 MP, none, uncommon 50g. Next card this turn costs 0 (Surge→Surge legal and a
      strict loss).
- [ ] **Battle Hymn** — 1 MP, none, common 25g. Every living member's auto **this party phase**
      +2 (degrades 4/2 as members die; lands this phase, unlike poison).
- [ ] **Barrier** — 4 MP, all, rare 75g. Every living member gains a Shield; **unused Barrier
      Shields fade after the next enemy phase** (strict case of the #02 shield-expiry rule).
- [ ] **Blood Tithe** — 0 MP, single living >4 HP, uncommon 50g. Target takes 4; gain 2 MP (cap 10).
      **Retain/engine-tag excluded.**
- [ ] **Martyr's Gift** — 2 MP, single living >3 HP, uncommon 50g. Target takes 3; each *other*
      living member heals 4.
- [ ] **Grim Harvest** — 2 MP, single living >4 HP, rare 75g. Target takes 4; deal 10 to the enemy.

## Implementation notes
- Barrier reuses the `shieldTurns` field from #02 (fuse = 1 enemy phase).
- Never-lethal member damage: add a guarded self-damage path in `src/engine.ts` `playCard`; emit
  the appropriate `GameEvent` for animations.
- Battle Hymn buffs the current party-phase auto resolution.
- Definitions & weights in `src/constants.ts`.

## Tests (required per CLAUDE.md)
- Lifebloom burst fires on all three end conditions but not on death; Barrier shields fade after one
  enemy phase; Blood cards never kill (respect the HP gate) and Blood Tithe is engine-tagged.

## Out of scope / follow-ups
- Phalanx / Brace and the Defense-strength rework are #17.
