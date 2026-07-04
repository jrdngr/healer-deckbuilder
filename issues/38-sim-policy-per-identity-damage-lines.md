# Issue 38 — Sim policy: per-identity damage lines (fairer comp-sweep measurement)

- **Roadmap phase:** post-demo (party track)   **Size:** M (policy work + re-measure)
- **Depends on:** #34 (which lined the abilities but judged the floor a stick limit)   **Blocks:** any
  member-balance call that leans on the composition sweep
- **Addresses:** the #34 follow-up — "a per-identity burst LINE in the fixed policy"

## Why

#34 re-lined the five new abilities and measured the real bands (N=300): the classic trio is the
29.3% reference ceiling and **27 / 56 comps floor at 0% full-run, every one losing the F8 Devourer
race**. The judgment there was that the floor is a **burst-DPS gap under-measured by the stick** — the
fixed policy has a poison + bolt + heal spine and no real *damage plan* for the alt-damage members,
so a comp without the ranger (Poison) and mage (Bolt) is piloted into a slow loss even when its raw
output could race. Member balance was (correctly) deferred to human calibration because you cannot
judge a member off a stick that under-pilots it.

This issue raises the stick's ceiling for those comps so the measurement is fair — **it does not
touch member stats, cards, or boss HP.** After it, the comp floor either lifts (it was a stick
artifact) or holds (it is real balance, now honestly measured and ready for the human call).

## Diagnosis (from the #34 N=300 sweep)

The zero-comps split into two failure modes:

1. **Survival-starved** — decent auto-DPS but the striker dies. The Warlock (7 auto-damage) is the
   clearest: Soul Tithe drains him −2/turn, and on a taunt-less comp nothing redirects hits off him.
   The policy heals on a flat 0.6-HP-fraction threshold that ignores the tithe, and #34's Provoke
   sink picks the **highest-maxHP** member — which in a Warlock comp is often the Warlock himself, so
   Provoke actively pulls hits onto the body it should protect.
2. **Tempo-starved** — the Skald's strike is `2 × cards played this phase`, so a quiet/Rest turn
   zeroes his damage. The policy rests whenever it has no "useful" card to play, collapsing his
   output exactly when a scaling striker needs cards on the table.

## Scope / acceptance criteria

- [x] **Warlock survival line:** `incomingDamage` now folds Soul Tithe (−`TITHE_AMOUNT`/turn) into the
      Warlock's incoming, so the lethal-check and proactive heal see the drain and keep his 7-damage
      body alive instead of waiting on the flat 0.6 fraction.
- [x] **Value-based `saveOrder`:** was hardcoded to trio slots (RIGHT/LEFT/CENTER), which saved a
      drafted Warlock/Mage seated at center *last*, like a tank. Now sorts living members by actual
      strike (`memberDamage` desc) — identical for the trio (mage 5 > ranger 4 > tank 2), correct for
      drafted comps.
- [x] **Provoke sink fix:** the taunt-less redirection tactic excludes the tithe-drained Warlock from
      the sink (funnelling hits onto him + the tithe killed the party's main striker); requires ≥2
      alive (nothing to redirect otherwise), which also guarantees a non-Warlock body exists.
- [x] **Skald tempo line (`trySkaldTempo`):** when a Skald is alive, the board is safe, and MP is near
      full (a Rest would bank ~nothing anyway), spend a cheap card — Battle Hymn first (it counts a
      card AND buffs every auto) — instead of resting his `2×cards-played` strike to 0. Bounded so it
      can't loop and is the LAST tactic, so it only ever replaces a Rest.
- [x] Re-ran `runCompositionSweep` at N=300 (below).
- [x] Judged (below). **No member/card/boss-HP change.**
- [x] Trio untouched (N=200 pins + wave-1/2/3 policy tests hold — the trio's per-turn decisions are
      byte-identical); new sim.test locks the Provoke-sink fix (never sinks onto the Warlock).

## Result (N=300, seeds 1–300) and verdict

| metric | #34 (real lines) | #38 (per-identity lines) |
|---|---|---|
| trio full-run (ceiling) | 29.3% | **29.3%** (byte-identical) |
| comps at 0.0% full-run | 27 / 56 | **26 / 56** |
| taunt-less comps clearing >0% | 15 / 35 | **16 / 35** |
| non-trio F8 ceiling | 50.9% | **60.0%** |
| full-run range | 0–29.3% | 0–29.3% |

**Verdict — the floor is REAL balance, not a stick artifact.** With correct per-identity damage and
survival lines, the floor barely moved (one comp off 0%, the alt-comp F8 ceiling up ~9pp) — the deep
no-ranger/no-mage comps still cannot race the trio-tuned Devourer. This is the valuable outcome: #34
*suspected* the floor was under-measurement; #38 tested that hypothesis by fixing the measurement, and
the answer is **no** — the comp floor is a genuine burst-DPS deficit. The stick is no longer the
confound, so the member-balance question is now honestly framed for the human-calibration follow-up
(a member/card tune, never a per-comp boss change). The lines are kept regardless: they are simply
the correct way to pilot those members, and they raised the alt-comp ceiling without touching the trio.

## Out of scope

- Member / card / boss tuning (the human-calibration follow-up — now cleanly separated from the stick).
- The Grave Augur / Berserker / Beast Warden lines from #34 were left as-is (no cheap win surfaced).

## Out of scope

- Member / card / boss tuning (the human-calibration follow-up).
- The Grave Augur / Berserker / Beast Warden lines landed acceptably in #34; touch only if the
  re-measure shows a clear, cheap win.
