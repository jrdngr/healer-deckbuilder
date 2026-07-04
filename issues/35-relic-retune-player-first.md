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

- [ ] **firstLightTaper** back inside the ≤ +9pp relic band (#22's implicit ceiling): candidates —
      restore the unconditional draw penalty it lost in #22 tuning, drop `TAPER_MAX_COST` 3→2, or
      make the discount once per fight. Re-measure each at N=600.
- [ ] **aegisFont** trim toward band: `WARD_MAX` 2→1 or wards decay at end of fight — measure.
- [ ] **pactOfSilence**: −23.5pp standalone is run-ending for a *purchasable* curse whose pitch is
      "upside within a passive-MP build". Re-run the in-build control (vs a passive-only run) under
      the new ordering before touching numbers; if it is still net-negative in its own build, buff
      the passive (+1→+2) or price it as the trap it is.
- [ ] **duskChime** (+4.8) drifted below its once-per-RUN opportunity cost — consider threshold
      13→10 or restoring once-per-fight at a higher threshold. Low priority.
- [ ] Refresh the run-sim baseline note with the new battery numbers once tuned.

## Implementation notes

- Battery method lives in the playtest record (a ~60-line loop over `Run` + `playFight`, relic
  pushed after the fight-2 win); consider promoting it into `sim/` as a permanent tool alongside
  `sim/injury-exp.ts` when this issue lands.
- Related observation, same battery: **Brutal** deepened its DR3 cliff under the #26 re-anchor
  (Gatewarden 0.3% at N=300, was 2.7%). Still dev-only and ungated by design — noted for whenever
  "tuned Brutal" is picked up, not actioned here.

## Out of scope / follow-ups

- The ten phase-A relics (all passives measured near-band in #22) — spot-check only if a tuned
  phase-B relic shifts the pick economy.
