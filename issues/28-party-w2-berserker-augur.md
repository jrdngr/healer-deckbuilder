# Issue 28 — Party W2: Berserker + Grave Augur

- **Status:** ✅ Complete
- **Roadmap phase:** post-demo (party wave 2)   **Size:** M
- **Depends on:** #27   **Blocks:** #29
- **Addresses:** review §3.4 (roster wave 2)

## Why
Two members that fight the healer's instincts. The Berserker is strongest at low HP — healing him is
friendly fire. The Grave Augur shrinks telegraphs, the taunt-less draft's redirection substitute.

## Scope / acceptance criteria
- [x] **Berserker** — 16 HP, 2 base; **+2 while HP ≤ 8 + fight attackBonus**, **+2 more while ≤ 4 +
      attackBonus** (net 2/4/6; bands fight-relative via `berserkerThresholds()`, folded into
      `memberDamage`; live band shown on the MemberCard as a 🔥 Calm/Enraged/Berserk readout).
      *Rampage* (2 MP, Ability card): strike for 2× current damage (+abilityPower), then lose 2 HP
      (clamped — a nuke, not a suicide button). Constants `BERSERKER_BAND1_HP/BAND2_HP/BAND_BONUS`,
      `RAMPAGE_SELF_DMG`.
- [x] **Grave Augur** — 10 HP, 4 dmg. *Grave Chill* (2 MP): the standing telegraph loses
      **`GRAVE_CHILL_REDUCTION 2` (+abilityPower)** damage per target (floor 0), modified in place so
      `attackTargets()` previews it (the telegraph-mutation precedent). New `graveChill` GameEvent +
      animation float.
- [x] Extended the sim policy: `tryRampage` (band-ride / kill, keep an MP reserve) and
      `tryGraveChill` (blunt a genuinely big standing blow).

## Implementation notes
- Berserker thresholds read fight `attackBonus`; MemberCard shows live band. Grave Chill modifies the
  standing telegraph spec (must reflect in `attackTargets()` preview).

## Tests (required per CLAUDE.md)
- [x] `test/engine.test.ts`: Berserker damage 2/4/6 per band, thresholds shift with attackBonus;
      Rampage = 2×current + abilityPower then −2 HP, clamped non-lethal at 1 HP; Grave Chill reduces
      per-target telegraph damage by 2 (+abilityPower), floors at 0, and `attackTargets()` previews
      the chilled number.
- [x] `test/sim.test.ts`: the policy pilots a Berserker/Grave-Augur composition to completion and
      wins ordinary fights. Trio pins bit-identical.

## Out of scope / follow-ups
- Beast Warden's pet subsystem is #29 (most invasive; ships last).
