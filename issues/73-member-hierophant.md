# Issue 73 — Hierophant: the channel member and Liturgy

- **Status:** 📋 Open
- **Phase:** content (roster + ability)   **Size:** M
- **Depends on:** #70 (channel-keep flags; this member anchors that archetype)   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: a channel hero whose ability changes how
  channels *behave* (first-draft "extra tick now" rejected as lazy).

## Why

Channels tick once per round, at the start of the player phase. Liturgy gives the active channel
**double cadence**: for its remaining duration it also ticks at the start of the enemy phase —
after your party's autos, immediately before the enemy's telegraphed attack resolves. The point is
*where* the second tick lands, not just that there are more of them: Fortify's bonus Shield
arrives right before the blow and can't be wasted; Mending Stream's heals bracket the hit; Sap
stacks Vulnerability twice per round (uncapped); Drain doubles its damage and MP return. Combined
with Chanter's Idol + Attunement (#70) keeping the channel alive, the Hierophant is the archetype
anchor. Approved design, redesign round 2026-07-07.

## The member

- **`hierophant`**, name "Hierophant" — `maxHP 9`, `damage 2`, salary **16**, ability `'liturgy'`.
  Fragile support body (Mage-tier HP, low auto).

## The ability — Liturgy (ability card)

- **Card:** cost **2**, `target 'none'`, `ability 'liturgy'`, type **arcane** (channel economy —
  `conduct` precedent). Counts toward arcane type counters (Cascade reads it).
- **Effect:** your **active channel** gains **dual cadence for its remaining duration**: it also
  ticks at the start of the enemy phase (after party autos, before the enemy attack/cast resolves).
- **Playability is gated on an active channel** (mirrors `needsRegen`'s no-dead-cast UX).
- The enemy-phase tick is a full tick (heals, shields, damage, Sap vuln, Drain's MP return — the
  channel's own return is legal income while channeling, per existing rules).
- Duration still counts down **once per round** (on the player-phase tick), so dual cadence
  ≈ doubles total ticks. Recasting while already dual-cadenced is a no-op (gate it or make it
  idempotent — implementer's choice, document it).

## Design decisions

- **Tick placement:** start of enemy phase = after `_runPartyPhase`, before the telegraph
  resolution block. Fortify's shield must be up before the mitigation pipeline runs; Sap's vuln
  applies to the *next* party phase (party already acted this round) — both intended.
- **Break rules unchanged:** playing a non-exempt card still kills the channel (and with it, dual
  cadence). Dual cadence is channel state, cleared when the channel ends for any reason.
- **MP suppression unchanged:** channeling still suppresses Rest/passive MP; Drain's own return
  ticking twice is the one income path and is intended (it is the archetype's payoff, not a
  loophole — Drain returns 1–2 MP per *tick* by design).
- **Preview law:** the enemy-phase Fortify/Mending tick changes party state before the attack
  resolves — `attackTargets()` preview is computed against pre-tick state. Keep preview == applied
  by having the preview account for a pending dual-cadence tick where it's deterministic
  (Fortify's shield grant is deterministic; document RNG-dependent Drain MP as non-preview state —
  it does not touch enemy damage, so the property test is unaffected).

## Acceptance criteria

- [ ] `AbilityId 'liturgy'`; `hierophant` in `MEMBER_POOL`, `DRAFT_POOL`, `MEMBER_BASE_SALARY`
      (16), `MEMBER_ABILITY_FLAVOR`; ability card in `ABILITY_CARD` (cost 2, `target 'none'`) +
      `CARD_TYPE` (`arcane`); excluded from shop/starter pools; unplayable while the Hierophant is
      down **or no channel is active**.
- [ ] Dual cadence: one extra tick per round at enemy-phase start, for the channel's remaining
      duration; duration decrements only on the player-phase tick.
- [ ] Works for all five channels: Refresh (MP restore ×2/round — legal channel income),
      Drain, Sap (vuln stacks twice per round, uncapped), Mending Stream, Fortify (shield up
      before the blow resolves).
- [ ] Channel break/target-death ends dual cadence with the channel; a new channel starts normal.
- [ ] Telegraph preview == applied stays green (enemy damage numbers unchanged by the tick; party
      mitigation state changes are reflected in the preview pipeline as with Fortify today).
- [ ] Mechanic-coverage row; N=1000 sim with the Hierophant fieldable stays in the 25–35% band.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Member/ability plumbing:** #61 template (`MEMBER_POOL` `src/constants.ts:140-198`,
  `ABILITY_CARD` `:795-815`, `_fireAbility` `src/engine.ts:~1700-2160`).
- **Channel state:** `_startChannel` `src/engine.ts:931`, `_tickChannel` `:966` — add a
  `dualCadence` flag to the active-channel state; call `_tickChannel` from the enemy-phase entry
  (before the resolve block at `:1017-1075` per #61's map) when set.
- **Tick idempotence:** `_tickChannel` must distinguish "cadence tick" (no duration decrement)
  from the player-phase tick (decrements) — a parameter, not a copy.

## Tests

- Sap + Liturgy: vuln climbs 2 steps per round; total ticks ≈ 2× duration.
- Fortify + Liturgy: the pre-blow shield absorbs the telegraphed hit that same round.
- Mending Stream + Liturgy on a target that dies mid-round: channel ends, no orphan tick.
- Playing a non-exempt card ends channel + cadence; Attunement/Idol (#70) exemptions keep both.
- Liturgy unplayable with no channel; duration decrements once per round.

## Out of scope

- New channel cards; Rest/passive-MP economy changes.
- Retuning Drain/Sap/Refresh magnitudes (the sim gate owns whether dual-cadence Drain needs a
  magnitude retune — tune per-tick numbers, never a cadence cap).
