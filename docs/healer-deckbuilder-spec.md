# Healer Deckbuilder — Prototype Spec

## Scope
Minimal prototype to test the core battle loop of the game: reactive healing under a depleting MP economy against a telegraphed, hard-hitting enemy. **A single handcrafted fight** — fixed party of 3, fixed 15-card deck, one enemy. No map, recruitment, economy, progression, or meta. Balance is not a goal.

**Tuning principle:** small, mostly single-digit numbers — a +1 to attack should be a meaningful power boost. **Rounding: always round up.** Concrete values are in the **Numbers** section.

## Core Loop
The player is a healer who keeps three auto-attacking party members alive against one enemy.
- Party of 3 in an ordered line, **slots 1-2-3**. The center (slot 2) is adjacent to slots 1 and 3; slots 1 and 3 are NOT adjacent to each other.
- Fixed starting layout (prototype): **slot 1 (left) = Ranger, slot 2 (center) = Tank, slot 3 (right) = Mage.** Members do not move.
  - Consequence of Tank-in-center: **every two-target attack includes the Tank** (edges pair only with center; center pairs with an edge). The hidden attack's edge-weighting (40/40/20) instead concentrates on the squishy Ranger/Mage.
- Each round the party auto-attacks the enemy; the enemy attacks the party.
- **The enemy has HP; party damage chips it down. Enemy HP → 0 = win.**
- **Loss: the instant the last living member dies, the fight is immediately over** — no player phase, no chance to act. (So Resurrect can only revive a fallen ally while at least one member still stands; it can never recover a full wipe.)
- A fight is a race: kill the enemy before its damage collapses your MP-limited healing.

## Turn Order — Enemy → Player → Party
A **turn** (round) is one full cycle of the three phases below. "Enemy turn" / "player turn" refer to those phases. Counts like enrage's "10 turns" and Taunt's "3 enemy turns" are measured in these full cycles.
1. **Enemy phase.** Start-of-enemy-turn status ticks resolve first (Poison, Regen, Refresh), before the attack. The enemy then makes one attack. A telegraph for next turn's attack (shape + damage) is shown. (First telegraph shown at combat start.)
2. **Player phase.** Mage gains +1 Charge at the start (this happens even if the player then skips). Player plays cards (heals, Refresh, Shield, Resurrect, Ability). Abilities fire immediately on play.
3. **Party phase.** Living members auto-attack the enemy for their `damage`. If this kills the enemy, the next enemy phase never happens.

Enemy-first means the player heals reactively. A single attack never kills a full-HP member, so deaths come from being hit while already damaged.

## Enemy
Single fixed enemy. Pure attacker — no phases (other than enrage), no debuffs, no armor.

**One attack per enemy turn, chosen by weight:**
- Single target — 60%
- Two-target — 20%
- AoE (all three) — 10%
- Hidden single target — 10% — **fully concealed: no telegraph at all**

**Targeting.** Every attack rolls a primary target slot by weight — center 50%, each edge 25% (the hidden attack instead uses each edge 40%, center 20%). Shape then sets who is hit:
- Single → primary only.
- Two-target → primary + one adjacent. Primary center → random edge; primary edge → center.
- AoE → all three.

All attacks are telegraphed one turn ahead (shape + damage) **except the hidden attack**. An attack on an empty/dead slot **whiffs** (no damage) and weights do NOT redistribute. Multi-target attacks resolve **per-target** — one target whiffing doesn't stop the others.

**Enrage.** Triggers **once** after 10 turns (turn 11 onward) and is permanent: **+25% damage (rounded up)** and **increased weight on the two-target and AoE attacks**. One-time, no further escalation. (A soft anti-turtle clock; the real pressure is the MP economy via tuning.) A telegraph always shows the **actual** damage the attack will deal when it lands, including enrage.

*Values: see Numbers section.*

## Party (fixed trio)
Each member has `HP` and `damage`, auto-attacks every party phase, and has one ability.

**Ability rules.** Abilities are fired by the **Ability card** (see deck), not a per-member card. They fire immediately in the player phase, **separate from the party phase** — a member that fires an ability still auto-attacks that round. Gated only by MP + drawing the Ability card (no cooldown / use cap). Only living members can be chosen.

**Tank** — high HP, low damage.
- **Taunt:** for **3 enemy turns**, the Tank becomes the **primary target of all enemy attacks** (no exceptions, including the hidden attack). Single → Tank only; two-target → Tank as primary + the geometry's second target; AoE → still all three. Re-casting **refreshes to 3** (no stacking). Casting **retargets the already-telegraphed attack**. Taunt is a status on the Tank, removed if he dies.

**Mage** — low HP, high damage.
- **Lightning Bolt:** deals a **separate base value + current Charge** to the enemy.
- **Charge:** starts at 0; **+1 at the start of each player turn** (the tick happens before you can fire, so a same-turn bolt includes it); **max 10**; **resets to 0 on firing and on death**.

**Ranger** — medium HP, medium damage.
- **Poison Arrow:** applies **Poison 5** to the enemy, **no immediate damage**. Decaying stack: at the **start of each enemy turn (before the attack)** it deals (current stacks) damage, then loses 1 stack (5,4,3,2,1…). Re-casting **adds +5** (can exceed 5; no cap).

*Values: see Numbers section.*

## Deck (fixed, 15 cards)
**Hand rules.** Draw pile + discard pile; reshuffle when the draw pile empties (mid-draw if needed). **Draw 4** at the start of the player phase. **No per-turn play cap** — MP is the only limiter. Played cards and, at end of turn, all unplayed cards go to the **discard pile** (no card has Retain in the prototype). Key asymmetry: MP is a *storable* pool but cards are *not* — you can't bank heals for later, so a heal must be drawn the turn you can afford it.

**MP economy.** MP is a **persistent pool that depletes across the fight** — it does not reset each turn, and there is no passive trickle. Intended arc: MP-flush early, choking around mid-fight, forcing triage between healing, Refresh, and firing abilities. Two MP sources:
- **Refresh** (card, below).
- **Skip-turn-to-regen** — skip the whole player phase (play no cards) to regain MP. Usable only **before any card is played**. You still **draw your 4 and discard them at end of turn** (the deck still cycles); the enemy has already attacked and the **party still attacks** on a skipped turn; the turn **still counts toward enrage**.

**HP / healing rules.** Healing **caps at max HP** (no overheal except via a card — none here do). A single attack never kills a full-HP member. **A character's statuses are cleared when it dies.**

**Cards (profiles; values in Numbers section):**
- **Ability** — fires a chosen living member's ability (Taunt / Lightning Bolt / Poison Arrow). **Flat MP cost** regardless of choice.
- **High Heal** — single member; higher cost, large heal, most MP-efficient.
- **Low Heal** — single member; low cost, small heal, least efficient.
- **AoE Heal** — all living members; medium cost / efficiency.
- **Regen** — single member; low cost, highest efficiency. Heal-over-time **mirroring Poison**: ticks at the start of each enemy turn for (current stacks) HP, loses 1 stack/turn; re-casting adds to the stack. Capped at max HP per tick. Status (cleared on death).
- **Shield** — single member; medium cost. **Fully negates the next attack instance** that would damage that member (including its share of a multi-target attack), then is consumed. **Persists until consumed; does not stack.** Status (cleared on death). The only reliable answer to the hidden attack and to spikes.
- **Resurrect** — high cost. Revives one dead member to **50% max HP** in their original slot, statuses cleared (Mage Charge → 0). Any dead member, any time — but only **while ≥1 member is alive** (a full wipe is an immediate loss).
- **Refresh** — MP regen. Upfront MP cost; **returns double its cost in MP over time**. Mirrors Regen/Poison (decaying stack) but for the player's MP pool. **Player-level status — not tied to a member, so member death doesn't clear it.** Ticks at the start of each enemy turn; re-casting adds to the stack.

**Deck list:**
| Card | Copies |
|---|---|
| Low Heal | 3 |
| High Heal | 2 |
| AoE Heal | 2 |
| Regen | 2 |
| Refresh | 2 |
| Ability | 2 |
| Shield | 1 |
| Resurrect | 1 |
| **Total** | **15** |

## Numbers (first pass — tune in playtest)
A coherent starting set, not a balanced one. All values respect the small-numbers principle (single-digit power values; +1 is significant) and the round-up rule.

### Members
| Member | HP | Damage |
|---|---|---|
| Tank | 12 | 1 |
| Ranger | 8 | 3 |
| Mage | 6 | 5 |

- **Lightning Bolt:** base **3** + Charge (0–10) → **3–13** damage. Charge +1/player turn, max 10.
- **Poison Arrow:** Poison **5** (15 total over 5 turns).
- Party auto-attack DPS, all alive: **9/round**.
- *No-one-shot check:* lowest HP (Mage 6) exceeds the largest single hit even post-enrage (5). ✓

### Enemy
- **HP: 100.**
- Attack damage (pre-enrage): Single **4**, Two-target **3** each, AoE **2** each, Hidden single **4**.
- Attack-type weights (pre-enrage): Single 60 / Two-target 20 / AoE 10 / Hidden 10.
- Slot weights: center 50 / each edge 25 (hidden attack: each edge 40 / center 20).
- Expected incoming ≈ **4.6 HP/round** pre-enrage.
- **Enrage (turn 11+):** damage ×1.25, round up → Single **5**, Two-target **4** each, AoE **3** each, Hidden **5**. Weights → Single 30 / Two-target 35 / AoE 25 / Hidden 10. Expected incoming ≈ **7 HP/round**.

### MP
- **Starting MP: 10.** No trickle.
- **Skip-turn regen: +5 MP.**

### Cards
| Card | MP cost | Effect |
|---|---|---|
| Ability | 2 | fire chosen living member's ability |
| Low Heal | 1 | heal 2 (single) — least efficient |
| High Heal | 3 | heal 8 (single) — most efficient burst |
| AoE Heal | 3 | heal 3 to all living — efficient when 2–3 are hurt |
| Regen | 2 | Regen 4 → heals 4/3/2/1 (10 over 4 turns), single — highest efficiency |
| Shield | 3 | fully blocks the next attack instance on target |
| Resurrect | 6 | revive a dead member to 50% max HP |
| Refresh | 3 | MP-Regen 3 → returns 3/2/1 MP (6 over 3 turns = 2× cost) |

- Heal efficiency order (HP/MP, typical use): Regen (5.0) > High (2.67) > AoE (~2.5) > Low (2.0). ✓
- **Refresh schedule decision:** decaying stack mirroring Regen (MP-Regen 3).

### Loop sanity check
- Covering average incoming (~4.6 HP/round) costs ~2 MP/round of healing; Refresh supplies ~2 MP/round while up — so break-even is precarious and leaves little MP for offense. That is the intended choke.
- Pure auto-attacks (9/round, less as members die) take ~11+ rounds to drop 100 HP → the fight reaches enrage (turn 11). Spending the Ability card on Poison/Bolt closes it earlier, before enrage. **That offense-vs-survival MP choice is the core decision the prototype tests.**
