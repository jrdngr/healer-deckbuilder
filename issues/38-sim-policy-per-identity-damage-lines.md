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

- [ ] **Warlock survival line:** fold Soul Tithe into the save math so the Warlock is healed *before*
      the tithe drops him, not on the flat fraction; keep his 7-damage body alive as the DPS plan.
- [ ] **Provoke sink fix:** the taunt-less redirection tactic must not pick a tithe-drained (or
      otherwise fragile-despite-high-maxHP) member as the sink — redirect onto a genuinely durable body.
- [ ] **Skald tempo line:** on a comp with a live Skald, prefer playing a cheap, non-wasteful card
      over Rest when the party is safe and MP has a reserve, so his cards-played strike stays fed.
- [ ] Re-run `runCompositionSweep` at **N=300**; publish the new bands next to #34's.
- [ ] Judge: does the floor lift (stick artifact) or hold (real balance)? Record the verdict. **No
      member/card/boss-HP changes** — that stays deferred to human calibration.
- [ ] Trio untouched (N=200 pins + wave policy tests hold); new sim.test coverage for the added lines.

## Out of scope

- Member / card / boss tuning (the human-calibration follow-up).
- The Grave Augur / Berserker / Beast Warden lines landed acceptably in #34; touch only if the
  re-measure shows a clear, cheap win.
