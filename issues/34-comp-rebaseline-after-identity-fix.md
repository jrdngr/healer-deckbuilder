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

- [ ] **Policy lines, not gates**, for the five new abilities: Dark Bargain as a planned MP engine
      (bargain early at full HP, stop before the growth curve bites), Crescendo-then-strike turn
      shaping, Berserker band-riding (heal *to* a band, not out of it), Chill on the biggest
      telegraph each cycle, Boar uptime + re-summon timing. Buy Provoke on taunt-less comps
      (raise its `CARD_BUY_VALUE` conditionally) and play it.
- [ ] Re-run `runCompositionSweep` (N≥100, then N=300 for the top/bottom deciles) — publish the
      real bands.
- [ ] Only then judge balance: if the trio is still the runaway ceiling or whole comp families
      floor at 0% *with real lines*, tune members/cards (never per-comp boss stats —
      `ENEMY_ATTACK_BONUS` stays composition-agnostic per #31).
- [ ] Re-validate the taunt-less floor with a Provoke-buying policy (the ~15% question #30/#31
      deferred).

## Implementation notes

- Harness and seating heuristic (`allCompositions`, `seatComposition`) are sound and reusable.
- The trio's numbers were never affected (its identity IS the fallback) — no demo re-tune implied.

## Out of scope / follow-ups

- Human-playtest calibration of the new members (the stick measures relative strength, not fun).
