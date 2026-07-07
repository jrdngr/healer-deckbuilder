# Issue 66 — Regen as convertible currency

- **Status:** 📋 Open
- **Phase:** content (cards + relics)   **Size:** M
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: deepen Regen beyond "heal over time";
  avoid direct buff-the-regen-number designs (Cultivate already does that).

## Why

Regen today is healing plus two direct readers (Cultivate, Bloom). This issue makes Regen a
**currency that converts across domains**: into damage reduction while it runs (Thornskin), into
enemy Poison when spent (Sporeburst), into Brace when it ends (Deep Roots), and back in
automatically when a member gets hurt (Ossuary Bell). Cultivate stops meaning "bigger heal" and
starts meaning "extend every regen-linked effect" — its value scales with how many converters are
in the deck, which is systemic synergy, not a named-card buff.

## Wave ground rules

Per #65: no caps / no per-fight trigger limits on new content (broken combos are fun); Charge is
Mage-only; no new MP generation; preview == applied; relics inert-when-none; mechanic-coverage
rows; `CARD_TYPE` entries; N=1000 sim gates (25–35% band, ≤ +9pp per relic).

## New cards (both Nature)

| Card | Cost | Rarity | Target | Effect |
|---|---|---|---|---|
| **Thornskin** | 1 | common | single | `needsRegen`. **While the target's Regen lasts**, they take 1 less from each hit. |
| **Sporeburst** | 2 | uncommon | single | `needsRegen`. **Consume** the target's Regen; **Poison the enemy 2/turn for (ticks consumed) turns.** |

## New relics

| Relic | Rarity | Effect |
|---|---|---|
| **Deep Roots** | uncommon | When a member's Regen **ends — expired *or* consumed** (Bloom / Sporeburst) — they gain **Brace 2**. |
| **Ossuary Bell** | uncommon | **Whenever** a member drops below 50% max HP, they gain **Regen 2**. (Every crossing retriggers — no per-fight limit.) |

## Design decisions

- **Thornskin's duration is the Regen itself** — no separate timer. Extending the Regen
  (Cultivate, Lingering, Rootbind #69) extends the damage reduction; Bloom/Sporeburst consuming
  the Regen ends it immediately. Implement as a member mark checked against `regen > 0` at
  incoming-damage time (no new timed state).
- **Sporeburst poison stacking:** the enemy has a single poison track (`poison`/`poisonTurns`).
  Rule: applying poison **adds to per-turn damage** and sets `poisonTurns = max(existing, new)`.
  This is the wave-wide poison-stacking rule (also used by #72 Ferment and read by #67
  Hemorrhage / Venom Gland).
- **Deep Roots triggers on both end paths** (explicit user verdict): natural expiry *and*
  consumption. Lifebloom's end-burst and Deep Roots both fire on expiry — intended double-dip.
- **Ossuary Bell can loop** (drop below 50% → Regen heals above → drop again → retrigger).
  Intended; the magnitude (Regen 2) is the tuning lever, never a trigger cap.

## Acceptance criteria

- [ ] Both `CardId`s in union + `CARDS` + `CARD_TYPE` (`nature`) + `CARD_RARITY` + pools;
      both use the existing `needsRegen` targeting gate; magnitudes as named constants.
- [ ] Thornskin: −1 per hit while `regen > 0`; stops the moment Regen hits 0 (expiry or consume);
      resumes if the same member is marked and regains Regen? **No** — the mark is consumed when
      the Regen it was attached to ends (one Thornskin per Regen lifetime; recast to re-arm).
- [ ] Sporeburst: consumes the full remaining Regen; poison applied via the wave stacking rule;
      Vulnerability does *not* multiply poison ticks (matches existing poison behavior).
- [ ] Deep Roots: Brace 2 on expiry and on consumption; respects Shield/Brace replacement rules;
      inert with no relics.
- [ ] Ossuary Bell: fires on every downward crossing of 50%; inert with no relics.
- [ ] Relic plumbing (union, table, constants, prices, spoils/reliquary flow); mechanic-coverage
      rows; N=1000 band; ≤ +9pp each.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Regen state:** `Member.regen` (`src/engine.ts:61`); regen ticks at player-phase start
  (`_startPlayerPhase` `src/engine.ts:1508`); Bloom's consume path and Lifebloom's `bloomBurst`
  end-hook show where "regen ended" is already detectable — centralize an `_onRegenEnded(member,
  consumed: boolean)` seam there for Deep Roots + Thornskin mark cleanup.
- **Thornskin:** incoming-damage pipeline `src/engine.ts:1130-1160`, next to Guard/Brace
  reductions; keep `attackTargets()` preview equal to applied (Grounding Rod at `:1154` is the
  pattern for preview-visible per-hit reductions).
- **Sporeburst:** poison fields on `Enemy` (`src/engine.ts:104`); Imbue Venom's apply path in
  `_fireAbility` shows the poison write; extract a `_applyPoison(perTurn, turns)` helper
  implementing the stacking rule (shared with #67/#72).
- **Ossuary Bell:** the post-mitigation damage application (Tithe Candle branch at
  `src/engine.ts:1496` is the hook site) — compare HP before/after against the 50% line.
- **Cards/relics plumbing:** same anchors as #65.

## Tests

- Thornskin: −1 while Regen runs; Cultivate extends it; Bloom-consume ends it mid-fight; recast re-arms.
- Sporeburst on Regen 3 → enemy poisoned 2/turn for 3 turns; on an already-poisoned enemy the
  per-turn adds and duration takes the max.
- Deep Roots: Brace 2 appears on natural expiry AND on Bloom/Sporeburst consume; no relic → no Brace.
- Ossuary Bell: two separate crossings in one fight → two Regen grants.
- Preview property test stays green with Thornskin active on a telegraphed target.

## Out of scope

- Ferment / Plaguewright (#72) — it builds on `_applyPoison` from here/#67.
- Retuning Regen/Cultivate/Bloom magnitudes.
