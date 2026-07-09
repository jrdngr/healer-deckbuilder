# Issue 68 — Knife-edge blood + deck cycling

- **Status:** ✅ Complete
- **Phase:** content (cards + relics)   **Size:** L
- **Depends on:** —   **Blocks:** #75 (Flagellant deepens this web)
- **Addresses:** intake 2026-07-07 — new-content wave: HP as a spendable resource with the healer
  as throttle; the reshuffle as a payoff event.

## Why

Blood has three cards; this issue makes HP a real second currency — draw (Crimson Pact), shields
(Scarlet Ward), damage (Open Veins), redistribution (Transfusion), and party offense (Blood
Banner) — all priced in HP the healer must then manage. It double-dips with the existing
low-HP seams (Berserker scaling, Field Triage Kit, Tithe Candle) and the new Ossuary Bell (#66),
and Sanguine Pact makes the whole archetype a deliberate knife-edge. Grimoire of Turning joins
Prayer Beads in paying off the reshuffle, which Crimson Pact's draw accelerates.

## Wave ground rules

Per #65: no caps / no per-fight trigger limits on new content (broken combos are fun); Charge is
Mage-only; no new MP generation; preview == applied; relics inert-when-none; curses bought-only;
mechanic-coverage rows; `CARD_TYPE` entries; N=1000 sim gates (25–35% band, ≤ +9pp per relic).

## New cards (all Blood)

| Card | Cost | Rarity | Target | Effect |
|---|---|---|---|---|
| **Crimson Pact** | 0 | uncommon | single | `engine`. Target with >4 HP pays 4 HP: **draw 2**. |
| **Scarlet Ward** | 1 | uncommon | single | Target with >3 HP pays 3 HP: gain a **Shield**. |
| **Open Veins** | 0 | common | single | Target with >3 HP pays 3 HP: **deal 4** to the enemy. |
| **Transfusion** | 1 | uncommon | single | Target with >4 HP pays 4 HP: the **most wounded other member heals 5**. |
| **Blood Banner** | 2 | rare | none | **Every living member pays 2 HP** (clamps to 1): party autos **+2 for 2 enemy turns**. |

## New relics

| Relic | Rarity | Effect |
|---|---|---|
| **Grimoire of Turning** | uncommon | **Every time** the draw pile reshuffles, deal **3** to the enemy. (No per-fight cap.) |
| **Sanguine Pact** | rare, **curse** | Blood-card HP costs **+2**; while any member is below 50% HP, party autos **+2**. |

## Design decisions

- **All HP costs here use the existing `selfDamage` clamp-to-1 rule** (never lethal). The one
  exception in the wave is Penance (#75), which is explicitly lethal by user verdict.
- **The ">N HP" targeting gates read the *effective* cost** — under Sanguine Pact, Crimson Pact
  needs >6 HP and takes 6. The gate is `selfDamage + 1`, derived, not hardcoded per card.
- **Crimson Pact and Open Veins are 0-MP** — the HP *is* the cost (Blood Tithe precedent). Crimson
  Pact is tagged `engine` (draw effect), so it's Retain/Efficient-ineligible like Inspiration.
- **Scarlet Ward's Shield follows normal Shield rules** (replaces Brace, fades in 3 enemy turns) —
  it's the cheap enabler for the #65 block-payoff web on any member, priced in HP.
- **Grimoire is uncapped** (user verdict removed the 2×/fight cap); reshuffle frequency is bounded
  by draws, which cost cards/MP, so the loop is self-limiting.
- **Sanguine Pact's upside checks *any* member below 50%** — the Berserker and Flagellant (#75)
  hold it open naturally; the healer choosing *not* to top someone off becomes a real decision.

## Acceptance criteria

- [x] Five `CardId`s in union + `CARDS` + `CARD_TYPE` (`blood`) + `CARD_RARITY` + pools;
      magnitudes as named constants; `selfDamage` clamps to 1 on all five.
- [x] Targeting gates derive from effective HP cost (base + Sanguine Pact) and refuse targets at
      or below it — except Blood Banner, which has no gate (clamped, `target 'none'`).
- [x] Crimson Pact draws 2 through the normal draw path (reshuffle can trigger mid-draw and fires
      Prayer Beads / Grimoire).
- [x] Transfusion picks the most wounded *other* living member (deterministic tie-break by slot
      order) — the selector is a shared helper (`_mostWoundedOther`), reused by #69 Twin Censer /
      #70 Arcane Lens.
- [x] Blood Banner: +2 autos party-wide for 2 enemy turns, additive with Battle Hymn/Embolden.
- [x] Grimoire: 3 damage on every reshuffle while owned; inert with no relics.
- [x] Sanguine Pact: registered as `curse: true` (bought-only, never in spoils); both halves work;
      inert when not owned.
- [x] Mechanic-coverage rows; N=1000 band; ≤ +9pp per relic (measure the curse too — its net
      should read as a real trade, not a strict trap).
- [x] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Blood cost machinery:** `selfDamage` on `CardDef` (`src/constants.ts:90-135`) and its clamp
  in the card resolver; Blood Tithe / Martyr's Gift / Grim Harvest cases in `_applyCard`
  (`src/engine.ts:1739-2107`) are the pattern.
- **Draw/reshuffle:** `_drawOne` `src/engine.ts:1552`, `_drawTo` `:1570`; the reshuffle site with
  the Prayer Beads branch at `:1560` is where Grimoire hooks.
- **Shield grant:** the Shield card's case; `shield`/`shieldTurns` on `Member` (`:61`).
- **Party strike buff:** `strikeBonus`/`strikeTurns` (Sharpen/Embolden pattern) for Blood Banner.
- **Curse plumbing:** `curse: true` relics in `RELICS` (`src/constants.ts:1863`); Cracked
  Hourglass shows a two-sided curse implementation.
- **Cards/relics plumbing:** same anchors as #65.

## Tests

- Each card: HP paid, effect lands, clamp holds at 1 HP, gate refuses a too-poor target.
- Sanguine Pact: costs +2, gates shift accordingly; below-50% toggles the +2 autos on and off.
- Crimson Pact draw triggering a reshuffle fires Grimoire (and Prayer Beads MP still capped —
  existing law untouched).
- Transfusion tie-break deterministic; never targets the payer.
- Blood Banner stacks with Battle Hymn in the same turn.

## Out of scope

- Penance / Flagellant (#75) and its lethal exception.
- Retuning existing blood cards or Tithe Candle.
