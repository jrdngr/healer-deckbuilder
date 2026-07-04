# Issue 35 — Relic power re-tune under player-first ordering (playtest 2026-07-04)

- **Roadmap phase:** post-demo   **Size:** S–M (targeted number changes + re-measure)
- **Depends on:** #26 (the ordering change that moved the numbers)   **Blocks:** none
- **Addresses:** the twice-flagged stale #22 per-relic gate baseline

## Why

The #22 per-relic gates were measured at Hexweaver 146 / Devourer 198 and enemy-first ordering.
Two boss-HP re-anchors (DR1, then #26's player-first reorder) invalidated that baseline — the
run-sim notes flagged it twice. The 2026-07-04 playtest re-ran the battery (same method: relic
injected at the fight-2 boundary, N=600; baseline 31.2%):

| relic | #22 delta | now | drift |
|---|---|---|---|
| aegisFont | +5.9 | **+10.0** | stronger |
| firstLightTaper | +2.0 | **+10.8** | much stronger |
| duskChime | +9.2 | **+4.8** | weaker |
| martyrsIcon | +4.4 | **+8.2** | stronger |
| pactOfSilence (alone) | −6.0 | **−23.5** | far more punishing |
| crackedHourglass | −5.6 | −5.2 | unchanged |
| rustyCrown | +0.4 | −1.7 | mild trap now |

Why the drift: player-first ordering (#26) gives one extra acted-on player phase per fight, which
compounds per-turn effects — the Taper's discount now fires before any blow ever lands (+10.8pp
makes it the strongest relic measured), overheal has a safe turn to convert into Wards
(aegisFont), and the Martyr save is likelier to be *answered* next turn. Conversely losing Rest
(pactOfSilence) forfeits more, because a banked Rest on the free planning turn is worth more.

## Scope / acceptance criteria

- [x] **firstLightTaper** back inside the ≤ +9pp band. Measured all three candidates: dropping
      `TAPER_MAX_COST` 3→2 measured *stronger* (+14.3, fewer penalty firings — rejected); an
      unconditional per-turn draw penalty overshot to −2.3 (hand size is too coarse a lever);
      once-per-fight measured ~0 (turn-1 MP is abundant — the per-turn relief IS the value). The
      landing lever is a **partial −2 discount** (`TAPER_DISCOUNT = 2`, "costs 2 less" not "costs 0"):
      **+8.8pp** at N=1000, keeping the per-turn shape.
- [x] **aegisFont** trimmed with `WARD_MAX` 2→1: **+7.2pp** at N=1000, in band.
- [x] **pactOfSilence**: priced as the trap it is. The passive-MP lever swings ~**±23pp PER POINT**
      (+1 → −23.9, +2 → **+23.2** — a top relic, absurd for a curse), so no in-band buff exists.
      Held at +1; documented on the constant. The sim policy already values every curse at 0 and
      never takes one, so it is a deliberate opt-in trade, not a trap the reference line falls into.
- [x] **duskChime**: threshold `DUSK_CHIME_MIN` 13→10 lifts it +4.8 → **+5.9pp**, back above a relic
      slot's opportunity cost, still in band.
- [x] Refreshed the run-sim baseline note (the `#35` block) with the new battery numbers.

## Implementation notes

- Battery **promoted to `sim/relic-exp.ts`** (a permanent tool alongside `sim/injury-exp.ts`): the
  relic is force-added on top of the natural loadout at the fight-2 boundary, delta vs the no-relic
  baseline. It reproduces the issue's table exactly (aegisFont +9.8 / Taper +10.5 / … / Pact −23.5).
- martyrsIcon (+7.8) and the pre-existing trap curves (crackedHourglass −5.6, rustyCrown −1.4) were
  already in their expected ranges and left untouched.
- Related observation, same battery: **Brutal** deepened its DR3 cliff under the #26 re-anchor
  (Gatewarden 0.3% at N=300, was 2.7%). Still dev-only and ungated by design — noted for whenever
  "tuned Brutal" is picked up, not actioned here.

## Out of scope / follow-ups

- The ten phase-A relics (all passives measured near-band in #22) — spot-check only if a tuned
  phase-B relic shifts the pick economy.
