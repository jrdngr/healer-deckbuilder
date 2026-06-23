# Healer Deckbuilder — Prototype

A minimal, playable prototype of the core battle loop: you are a **healer** keeping
three auto-attacking party members alive against one telegraphed, hard-hitting enemy,
under a **depleting MP economy**. One handcrafted fight, fixed party of 3, fixed 15-card
deck. Balance is not a goal — this exists to test whether the loop is fun and tense.

The full design is in [`docs/healer-deckbuilder-spec.md`](docs/healer-deckbuilder-spec.md).

## Run it

It's plain HTML/CSS + vanilla ES-module JavaScript — **no build step, no dependencies**.
ES modules must be served over HTTP (not opened as `file://`):

```bash
node server.js          # or: npm run serve
# open http://localhost:8080
```

(Any static server works, e.g. `python3 -m http.server 8080`.)

## How to play

Turn order each round is **Enemy → Player → Party**:

1. **Enemy phase** (automatic): start-of-turn status ticks (Poison, Regen, Refresh)
   resolve, then the enemy attacks the slot(s) it telegraphed last turn. A new telegraph
   for next turn is shown.
2. **Player phase** (you act): the Mage gains +1 Charge, you **draw 4 cards**, then spend
   **MP** to play heals, shields, regen, refresh, resurrect, or fire an ability. MP is the
   only limiter — there's no per-turn play cap.
3. **Party phase** (automatic): living members auto-attack the enemy.

You win when the **enemy's 100 HP** hits 0. You lose the instant the **last living member**
dies — there's no rescue from a full wipe.

**Controls**
- Click a hand card to play it. Cards that need a target (heals, Regen, Shield, Resurrect,
  Ability) enter *targeting mode* — then click a valid member (highlighted blue). `Esc` or
  **Cancel** aborts targeting.
- **Ability** fires the chosen living member's ability: Ranger → Poison Arrow, Tank → Taunt,
  Mage → Lightning Bolt.
- **End Turn** runs the party attack and advances. **Skip & Regen** (only available before
  you've played a card) forgoes your cards to recover **+5 MP**.
- The red-bordered member(s) are who the next attack will hit. A **concealed** telegraph
  means the enemy's hidden attack is incoming — you can't see who it targets, so keep a
  Shield up.
- Enter a **seed** and hit **New Fight** to replay a deterministic fight.

## The core tension

Covering average incoming damage eats most of your MP and Refresh income, leaving little for
offense. Pure auto-attacks take ~11+ rounds to kill the enemy — long enough to hit **enrage**
(turn 11, permanent +25% damage and heavier multi-target attacks). Spending your scarce MP and
Ability cards on Poison/Lightning Bolt closes the fight sooner, *before* enrage — at the cost of
healing you may need. **That offense-vs-survival squeeze is what the prototype tests.**

## Project layout

```
docs/healer-deckbuilder-spec.md   the design document
index.html, styles.css            the UI shell
server.js                          tiny zero-dep static server
src/
  constants.js   all tunable values from the spec's Numbers section
  rng.js         seedable PRNG + shuffle/weighted-pick helpers
  engine.js      pure battle engine (no DOM) — the source of truth
  ui.js          browser controller: renders state, handles input
test/
  engine.test.js zero-dependency test harness
```

The engine is pure and DOM-free, so the mechanics are unit-tested directly:

```bash
node test/engine.test.js     # or: npm test
```

Covers deck composition, the round-up enrage damage, the Poison/Regen/Refresh decay
schedules, Lightning Bolt charge, Shield absorption, Taunt retargeting, Resurrect, the
skip-to-regen rule, overheal capping, whiffs, and win/loss conditions, plus a fuzz pass
that plays full games to completion across many seeds.

## Notes / known simplifications

- **Telegraph & targets:** the spec says telegraphs show "shape + damage." This prototype
  also highlights the *targeted slots*, since reactive Shield/heal decisions are only
  meaningful if you can see who's about to be hit. The hidden attack still reveals nothing.
- **Hidden attack:** to keep the UI honest, a concealed attack shows a "??? Concealed"
  telegraph (signalling *that* something unknown is coming, but not its shape, damage, or
  target). The literal spec hides even that; this is a deliberate playability affordance.
- All numbers are first-pass values from the spec and live in `src/constants.js` for easy
  tuning.
