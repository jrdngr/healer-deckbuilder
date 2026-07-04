# Issue 34 — Composition re-baseline after the drafted-identity fix (playtest 2026-07-04)

- **Roadmap phase:** post-demo (party track)   **Size:** M–L (policy work + re-tune)
- **Depends on:** #31 (its harness; its *findings* are superseded)   **Blocks:** any per-comp tuning
- **Addresses:** the invalidated #31 conclusions; §3.4 per-comp balance, for real this time

## Why

The 2026-07-04 playtest found that `Run.toBattleConfig()` **dropped the drafted `member` field**,
so every "drafted" fight since #27 ran with classic-trio abilities on drafted stats — a "Warlock"
was a poison-firing, 7-damage pseudo-Ranger named "Ranger". The bug is fixed and regression-tested
(`toBattleConfig carries drafted identity`, test/run.test.ts), and the #31 Warlock 7→5 nerf —
calibrated entirely against that phantom — is **reverted** (spec 7 restored; `DRAFT_RATING` too).

The **real-ability sweep** (N=100/comp) reads:

- classic trio ~22% full-run — now the **ceiling**, not the floor;
- best drafted comps: ranger/mage/graveAugur 12%, ranger/tank/berserker 7%;
- **every Warlock comp ≤ 1%** (at damage 7: still only 2.5–3% on its best comps);
- most comps 0%: full-run range 0–22%, F8 range 0–45.5%, 0 comps > 85% anywhere.

## What it means

The drafted-comp floor is dominated by a **measuring-stick limitation**, not (only) balance: the
fixed policy's whole win-line is poison + taunt + bolt — the trio's abilities. Comps without them
lose the policy's core tactics, and the wave-1–3 tactics (`tryDarkBargain`, `tryCrescendo`,
`tryRampage`, `tryGraveChill`, `tryCallBoar`) are shallow gates, not lines. Sub-signals:

- The Warlock's Dark Bargain fires only when MP-starved (mp<4) while Soul Tithe drains him every
  turn — the policy treats the game's highest-damage member as a liability it slowly bleeds.
- The Skald needs card-sequencing (play cards *then* let him strike) the policy never plans for.
- Provoke (#31's Taunt-lite) is bought at value 2 — effectively never — so the taunt-less floor it
  was shipped to lift remains unmeasured.

## Scope / acceptance criteria

- [x] **Policy lines, not gates** for the five abilities (sim/policy.ts): Dark Bargain is a planned
      MP engine that **front-loads** (bargain only while near-full and MP has headroom, capped at 2
      casts — the cost grows +3/cast, so value is all up front) and stops before the growth curve /
      Soul Tithe bleed his 7-damage body; Crescendo is played whenever affordable without stranding
      us (it draws 2 AND counts a card, so it feeds his cards-played strike and refills the hand);
      Berserker **band-riding** (`tryHeal` no longer heals the Rampage member out of a rage band —
      only pulls him from below band2, where he is a roll from death); Grave Chill on a real
      standing blow; Boar uptime kept. New `tryProvoke` tactic + conditional `cardBuyValue` so a
      **taunt-less** party buys Provoke (value 6) and plays it on its most durable member.
- [x] Re-ran `runCompositionSweep` at N=100 and **N=300** (authoritative). Real bands below.
- [x] Judged balance (below) — **no blind member re-tune**; the floor is a race-DPS gap at the
      Devourer, not something a stick-driven buff can safely close.
- [x] Taunt-less floor re-validated with the Provoke-buying policy: **15 / 35** taunt-less comps now
      clear >0% (were near-all 0 pre-line); Provoke lifts the ranger/mage-anchored taunt-less comps
      (graveAugur 9.3%, berserker 4.3%, skald 3.0% full-run) but cannot rescue the no-ranger/no-mage
      taunt-less comps — their loss is a DPS race, not a mitigation failure Provoke addresses.

## Real bands (N=300, seeds 1–300, real lines)

- **Ceiling:** classic trio **29.3%** full-run (F2 86.7 / F5 68.2 / F8 50.9) — the reference, by
  design (its identity is the fallback; no demo re-tune implied).
- **Next tier:** ranger/mage/graveAugur 9.3% · ranger/tank/berserker 9.0% · tank/mage/graveAugur
  5.0% · ranger/tank/warlock 4.7% · ranger/mage/berserker 4.3%.
- **Floor:** full-run range **0.0–29.3%**; F8 range 0.0–50.9%; **0 comps > 85% anywhere**;
  **27 / 56 comps floor at 0.0%** full-run.

## Balance judgment

**Every one of the 27 zero-comps loses at F8 (Devourer F8 = 0.0% for all of them)** while many still
reach F5 at 14–50% — so the floor is a **damage-RACE loss at the final boss, not a survival loss**.
The common thread is precise: every zero-comp lacks **both** the ranger (Poison chip) and the mage
(Bolt burst). The Devourer's "race or die" HP was tuned to the trio's poison+bolt output (#14/#22),
and #31 fixed `ENEMY_ATTACK_BONUS` as **composition-agnostic** — so the boss cannot be adjusted per
comp, and a global cut would break the trio's tuned 50.9% F8.

That leaves member/card buffs as the only lever — and buffing alt-damage members up to beat a
trio-tuned boss, **off a stick that under-pilots them** (the fixed policy has a poison+bolt+heal
spine and no burst line for Warlock/Skald/Berserker damage), is exactly the miscalibration this
issue warns against ("the stick measures relative strength, not fun"). The re-lined stick has done
its job: it confirms the trio is the reference ceiling and localizes the floor to a burst-DPS gap
vs the Devourer. **Recommendation: defer member balance to the human-playtest calibration already
scoped as the follow-up — do not re-tune members off the stick.** The concrete, safe win banked
here is the Provoke line for taunt-less mid-comps.

## Implementation notes

- Harness and seating heuristic (`allCompositions`, `seatComposition`) are sound and reusable.
- The trio's numbers were never affected (its identity IS the fallback) — the N=200 sim pins and
  the wave-1/2/3 policy tests all held; new sim.test assertions lock the Dark-Bargain front-load
  (fires + caps at 2) and the taunt-less Provoke line.

## Out of scope / follow-ups

- **Human-playtest calibration of the new members** (the stick measures relative strength, not fun)
  — this is now the gating follow-up for the alt-comp floor, per the judgment above.
- A per-identity burst LINE in the fixed policy (a real Warlock/Skald damage plan) would raise the
  stick's ceiling for those comps and re-open the balance question on a fairer measurement.
