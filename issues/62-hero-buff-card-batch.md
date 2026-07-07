# Issue 62 — Hero buff card batch

- **Status:** ✅ Complete
- **Phase:** content (cards)   **Size:** L
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-07 — "Create some new buff cards. +1 damage reduction on a hero,
  +1 damage on a hero, rare card that doubles the next attack, taunt on a hero. Suggest some others
  and ask me about them."

## Why

The deck today is heals + mitigation + per-member ability cards. This adds a suite of **proactive
hero buffs** — small damage/defense/tempo boosts a player can invest into a specific hero — to widen
deck-building and reward setup turns.

## Design decisions (intake interview 2026-07-07)

- **Durations:** the standing buffs (+1 DR, +1 damage, Rally, Taunt-on-a-hero) last **N enemy turns**
  and decay like the existing Defense/Taunt buffs. Exact turn counts and costs are tunable constants,
  tuned in a later balance pass ("tweak later").
- **"Double the next attack"** doubles the chosen hero's **next basic (party-phase auto) attack** —
  reuses the War Drum `drumPrimed` pattern.
- **Extra cards accepted from the suggestion set:** Rally, Empower, Riposte. (Declined: Evade.)
- **Guard stacking:** stacks with other DR sources (Bulwark, Taunt's Defense) but **not with itself**
  — a second Guard on the same hero refreshes the duration rather than adding a second +1.

## The cards (7)

1. **Guard** — +1 damage reduction to a chosen hero for N enemy turns. `target 'single'`.
2. **Sharpen** — +1 damage to a chosen hero for N enemy turns. `target 'single'`.
3. **Provoke** (taunt-on-a-hero) — apply Taunt (+ its bundled Defense) to a chosen hero for N enemy
   turns, castable on any hero from the deck. `target 'single'`.
4. **Double Strike** (rare) — the chosen hero's next basic auto deals double, then is spent.
   `target 'single'`.
5. **Rally** — +1 damage to **all fielded heroes** for N enemy turns. `target 'all'`.
6. **Empower** — the chosen hero's next **ability** fires at +1 abilityPower, then is spent.
   `target 'single'`.
7. **Riposte** — the chosen hero counterattacks for their damage the next time an attack lands on
   them. `target 'single'`.

## Acceptance criteria

- [ ] All 7 cards defined in the card table with tunable costs, correct `target`s, and descriptions;
      Double Strike flagged **rare** in the shop/reward pool. All 7 are shop/reward-eligible.
- [ ] **Sharpen/Rally** feed `memberDamage()`; **Guard** feeds the damage-taken pipeline; all four
      standing buffs **decay after N enemy turns** in `_decayBuffs`.
- [ ] **Guard stacks with other DR** (Bulwark, Taunt's Defense) but **not with itself** — a second
      Guard on the same hero refreshes the timer without adding a second +1.
- [ ] **Double Strike** doubles exactly the next basic auto (not an ability), consumed on use; it does
      not touch the enemy telegraph (telegraph==applied invariant unaffected).
- [ ] **Empower** adds exactly +1 abilityPower to the next ability cast by that hero, consumed once.
- [ ] **Riposte** deals its counter exactly once, on the next attack that hits the buffed hero, and
      the counter damage respects Vulnerability like every other party source.
- [ ] **Provoke** applies the same Taunt(+Defense) effect the Tank's ability grants, from a card.
- [ ] Per-card tests + typecheck/build clean; ends in its own `jj` commit (may split into two commits
      — the standing buffs vs. the one-shot/counter cards — if cleaner).

## Implementation notes (anchors)

- **Card defs:** `CardDef` shape `src/constants.ts:51-88`; card table `:688-760`; `CardTarget` is
  `'single' | 'dead' | 'all' | 'none'` `:10`.
- **Damage buffs (Sharpen/Rally):** `memberDamage()` already sums `base + hymnBonus + banner + lone`
  (`src/engine.ts:377-399`). Add a per-member `strikeBonus` (+ `strikeTurns`) to `Member`
  (`~:58-96`), include it in that sum, and decay it in `_decayBuffs` (`:1078-1096`). Rally sets it on
  every fielded member. (Note: `hymnBonus` is a **one-phase** party buff — Rally needs the N-turn
  decaying field, not `hymnBonus`.)
- **Guard (+1 DR):** **stacks with other DR sources (Bulwark, Taunt's bundled Defense) but not with
  itself** — re-casting Guard on a hero refreshes its duration and does not add a second +1 (keep the
  stronger value / longer timer, the "no self-stack" convention other refreshable buffs use, e.g.
  Poison/Hex at `engine.ts:1707`/`:1760`). This means Guard cannot reuse the Defense-exclusive
  `noDefense` gate (`constants.ts:74-76`), which forbids stacking with Bulwark; give Guard its **own**
  per-member DR field (e.g. `guardDR`/`guardTurns`) that adds into the taken-side pipeline (`~:914`)
  alongside `defenseAmount`, and decay it in `_decayBuffs` (`:1084-1090`).
- **Provoke (taunt card):** reuse the `taunt` case effect in `_fireAbility` (`:1713-1734`,
  `m.taunt`/`m.defense`), invoked from the card resolver rather than an ability binding.
- **Double Strike:** reuse the `drumPrimed` flag + consume site (`src/engine.ts:73`, `:1901-1905`) —
  set it on the card's target instead of via the War Drum relic.
- **Empower:** a per-member one-shot bonus consumed in `_fireAbility` (`:1697-1818`; every `case`
  reads `m.abilityPower`, so add a transient add-on there).
- **Riposte:** a per-member flag checked where a hit lands on a member inside `_resolveAttack`
  (`~:812-980`); route the counter through `_damageEnemy` with `vulnerableAmount`.
- **Card play/target plumbing:** `playCard` (`:1371+`), target semantics comment (`:681`).

## Tests

- `test/engine.test.ts`: one scenario per card — Sharpen/Rally raise the auto by the right amount and
  fade after N turns; Guard reduces incoming damage and fades; Provoke pulls the telegraph like the
  Tank's Taunt; Double Strike doubles the next auto only; Empower bumps the next ability once;
  Riposte counters exactly once and scales with Vulnerability.

## Resolution note (naming)

The card ids `provoke` and `rally` were already taken by tuned, tested cards that
resemble but differ from cards #3 and #5 here (the existing `provoke` is a lighter
*taunt-lite*; the existing `rally` is a one-phase, empty-seat `hymnBonus` buff). To
avoid two same-named cards in the pool, the two new cards ship under distinct names,
with the intended behavior:
- #3 "Provoke" (full Tank Taunt(+Defense) from a card) → **Goad** (`goad`).
- #5 "Rally" (standing party +1 damage over N turns) → **Embolden** (`embolden`).
The existing `provoke`/`rally` cards are left unchanged.

## Out of scope

- Relic synergies with the new buffs; UI/FX beyond existing status logs/events.
- Final cost/duration balancing (tunable constants; a later balance pass owns the numbers).
