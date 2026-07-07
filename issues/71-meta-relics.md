# Issue 71 — Meta-layer relics: Rest, recovery, and the reward economy

- **Status:** 📋 Open
- **Phase:** content (relics)   **Size:** S
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: a few legible relics that touch the run
  layer (Rest action, between-fight recovery, card-reward economy) rather than combat math.

## Why

Most relics modify combat; these three touch the surrounding economy. Pilgrim's Flask makes the
Rest action (already a real decision under the decayed-Rest economy) heal a little, Surgeon's
Thread moves the between-fight recovery knob, and Beggar's Bowl is an economy curse that trades
card-reward selection for gold — which is also mild deck-dilution relief, a deliberate wink at
the "dilution is THE gradient lever" finding.

## Wave ground rules

Per #65: no caps / no per-fight trigger limits; no new MP generation (Flask heals, it does not
touch the Rest MP amounts); curses bought-only; relics inert-when-none; mechanic-coverage rows;
N=1000 sim gates (25–35% band, ≤ +9pp per relic).

## New relics

| Relic | Rarity | Effect |
|---|---|---|
| **Pilgrim's Flask** | common | **Every Rest** also heals **all party members 1**. |
| **Surgeon's Thread** | common | Between-fight recovery **40% → 50%** of max HP. |
| **Beggar's Bowl** | rare, **curse** | Card rewards after a won fight offer **2 choices instead of 3**; **+20g per won fight**. |

## Design decisions

- **Flask fires on the Rest action itself** (both the +5 zero-card Rest and the +1 decayed Rest),
  heals route through the normal heal pipeline (Field Triage applies; Beacon #69 can trigger on a
  top-off). Rest is unavailable while channeling / under Pact of Silence — Flask changes none of
  that.
- **Surgeon's Thread** replaces `HERO_HEAL_PCT` 0.40 with 0.50 when owned — run layer only, no
  combat surface. It stacks with (does not replace) the Infirmary's paid full top-up.
- **Beggar's Bowl** shrinks `CARD_REWARD_SIZE` for the reward roll (skip-reward stays allowed)
  and adds flat gold to fight payouts (Rusty Crown's gold rider shows the pattern). Curse:
  bought-only, never in spoils, never forced.

## Acceptance criteria

- [ ] Three `RelicId`s + `RELICS` entries (+ `curse: true` on Beggar's Bowl) + magnitude
      constants + rarity prices; non-curses flow into spoils/reliquary rolls.
- [ ] Flask: every Rest heals all living members 1 via the heal pipeline; no MP change; inert
      with no relics.
- [ ] Thread: recovery is 50% with the relic, 40% without; applies from the moment it's acquired
      (next between-fight boundary).
- [ ] Bowl: reward offers roll 2 distinct cards; +20g on each won fight's payout (stacks with
      Rusty Crown's +15g if both owned); never appears in spoils.
- [ ] Mechanic-coverage rows; N=1000 band; ≤ +9pp each (measure the Bowl's net as a trade).
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Rest:** `skipTurn` / `canSkip` (`src/engine.ts:2266-2267`, Pact-of-Silence branch at `:2267`);
  heal via the pipeline entry used by card heals (`:1035+`).
- **Recovery:** `HERO_HEAL_PCT` (constants) applied at the between-fight boundary in `src/run.ts`;
  gate on `relics.includes('surgeonsThread')`.
- **Rewards/gold:** `CARD_REWARD_SIZE` + `rollCardReward` (`src/run.ts:633`); fight payout where
  `GOLD_PER_FIGHT`/Rusty Crown resolve; discount/exclusion plumbing near `relicExclusions`
  (`src/run.ts:929`) needs no change (Bowl is a curse — excluded from spoils by the existing
  non-curse filter).
- **Relic plumbing:** `RelicId` `src/constants.ts:1777`, `RELICS` `:1863`, constants near `:1815`.

## Tests

- Flask: Rest with 0 cards played → +5 MP (unchanged) and party +1 HP each; decayed Rest (1 card)
  → +1 MP and party +1 HP; no Rest possible while channeling (unchanged).
- Thread: wounded member recovers to the 50% line between fights with the relic, 40% without.
- Bowl: reward content has exactly 2 offers; won-fight gold +20; spoils rolls never contain it.
- All three: zero relics owned → no behavior change anywhere (inert gate).

## Out of scope

- New node types or event content; Infirmary pricing.
- Any change to Rest MP amounts or the passive-MP economy.
