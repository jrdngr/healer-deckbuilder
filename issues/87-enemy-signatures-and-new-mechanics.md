# Issue 87 — Enemy signature audit + two new boss mechanics (Hero Poison, Curse/Mark)

- **Status:** 📋 Open
- **Phase:** content + engine (enemy identity)   **Size:** XL (umbrella — split into multiple commits)
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-13 — "Each enemy should have at least one defining attack, attack
  style, or attack sequence. Let's come up with some. Examples: AoE-lite; poisons heroes; two-phase
  debuff-then-payoff (delay to clear/mitigate); heavy single-target that tries to kill heroes."

## Why

Every enemy should read as a *distinct threat*, not a bag of attack weights. Most already have a
signature (channelers, piercers, self-healers, phase bosses); a few act-1 normals are still just
weight shapes; and two of the intake's example styles — **enemy-applied poison on heroes** and a
**clear-or-die two-phase debuff** — don't exist as mechanics yet. This umbrella issue (a) audits
**every** enemy so each has a documented, distinct signature, and (b) builds the two new mechanics
and homes them **on bosses**.

## Maintainer decisions (intake interview 2026-07-13)

- **Scope:** audit **all** enemies; give each a real, distinct defining attack, upgrading weak ones.
- **New mechanics:** **build them** (don't just reuse existing attack types) and **split the work
  into commits** — but keep it **one issue file** (this one).
- **Hero Poison:** **cleansable and STACKING** — Cleanse removes it; re-applications **stack
  magnitude** (can spike into real burst if ignored).
- **Curse/Mark (clear-or-die):** a hero survives the payoff by **either** cleansing the mark **or**
  having enough mitigation (shield/defense) — the payoff still hits the still-marked, but mitigation
  reduces it below lethal. More answers, softer read.
- **Tier:** **both new mechanics live on bosses.** Normals keep their existing signature shapes; the
  act-1 normals that lack a scripted signature get one from **existing** mechanics.

## ⚠️ Sign-off checkpoint (per the repo's per-item approval loop)

Before writing the boss-facing data (which boss hosts which mechanic, exact damage/turns/stack
numbers, and the final act-1-normal signatures), the implementing agent must present the concrete
straw-man below (with any adjustments) to the maintainer and get sign-off. The straw-man is the
starting proposal, **not** locked numbers.

## Straw-man design (for sign-off)

### A. Enemy signature audit — every enemy has one distinct signature

| Enemy | Act | Signature (kept / **new**) |
|---|---|---|
| Swarm | 1 | AoE-lite — leans on multi-target Barrage/Sweep (keep) |
| Stalker | 1 | Ambush — the concealed `hidden` strike is its read (keep) |
| Brute | 1 | **Executioner** — focus-fires one hero (scripted repeated single on the same target) |
| Cleaver | 1 | **Heavy telegraphed cleave** — a big `heavy` read you must mitigate or lose a hero |
| Ironmaw | 2 | Channeler — Siegebreak (keep) |
| Needler | 2 | Piercer — Needle Shot (keep) |
| Leech | 2 | Self-healer — Gorge (keep) |
| Juggernaut | 3 | Channeler — Overrun (keep) |
| Lancer | 3 | Piercer — Skewer (keep) |
| Devourling | 3 | Self-healer — Gorge (keep) |
| Gatewarden | 1 boss | Learnable rotation + Crushing Blow channel (keep — the clean teaching boss) |
| Hexweaver | 2 boss | Telegraphed debuff-punisher (Pierce/Hex/Siphon) **+ Curse/Mark** (new) |
| Devourer | 3 boss | Phase boss (Consume/Maw) **+ Hero Poison** (new) |

Rationale for the two new homes: Curse/Mark is a *telegraphed clear-or-die read*, which is exactly
Hexweaver's identity (act 2, where Cleanse and mitigation are reliably online). Stacking Hero Poison
suits the Devourer's "race or die" phase pressure (act 3). Both avoid Gatewarden so boss 1 stays the
simple teaching fight. (Numbers and whether to add a rotation step vs. replace one: decide at
sign-off; keep each boss's total threat near its current budget so this is identity, not a spike.)

### B. New mechanic — Hero Poison (cleansable, stacking)

A boss step applies **stacking poison to heroes** (today `poison` is enemy-side only). It ticks each
enemy turn for its magnitude, decays, and Cleanse clears it. Re-applying **adds** magnitude.

- Add a hero-side DoT to `Member`: mirror the enemy's `poison`/`poisonTurns` (`core.ts:131`) onto the
  `Member` interface (`core.ts:85` — members currently have only `shield`/`regen`/`defense`,
  `:95-101`; no incoming DoT). Init to 0 in the member build block (`core.ts:338-343`).
- **Stacking:** applying poison `n` for `t` turns adds `n` to the member's poison and sets/refreshes
  turns to `max(current, t)`. Ticks at the enemy-turn boundary (mirror the enemy poison tick), then
  decays turns; at 0 turns, poison resets.
- **Cleanse** (`effects.ts:438`, currently only clears `woundTurns`) also zeroes every living
  member's poison/poisonTurns. Update the log/`_emit` to reflect it.
- **Application:** a new `CastKind` `'poison'` (`src/data/tuning.ts:74`) resolved in `_resolveCast`
  (`core.ts:1494`) — applies stacking poison to all living members (or the boss's chosen target
  rule), emits a `poisonApplied`-style event per member (event exists at `core.ts:223` for the
  enemy; add a hero-side variant or reuse with a `side` field). The cast itself deals **no direct
  damage** (like `wound`/`siphon`).
- **Telegraph invariant:** DoT ticks are **not** part of `attackTargets()`/`attackLines()` — exactly
  as the enemy's own poison isn't part of the player's telegraph. The applying cast previews as a
  0-damage cast, so preview == applied direct damage stays true.

### C. New mechanic — Curse/Mark (clear-or-die, cleanse-OR-mitigation)

A boss casts a **Mark** on all heroes (telegraphed, no direct damage), then after a delay a **payoff**
step deals heavy damage to every **still-marked** hero. A hero survives by clearing the mark
(Cleanse) **or** by mitigation (shield/defense) reducing the payoff below lethal.

- Add a hero-side `cursed`/`markTurns` status to `Member` (like `wound` but per-member): set by a new
  `CastKind` `'curse'` on all living members; ticks down each enemy turn.
- **Cleanse** also clears the mark (add to the `effects.ts:438` cleanse handler).
- **Payoff step:** a scripted rotation step (an `AttackType` or a flagged `RotationStep`,
  `enemies.ts:69`) that, at resolve, targets **only currently-marked** living members. Because the
  marked set changes with player actions between telegraph and resolve, `attackTargets()`
  (`core.ts:749`) must compute the payoff's targets/damage from the **current** marked set so
  **preview == applied** holds turn-to-turn (this is the crux of the invariant work here — model it
  like `targetLowest` at `core.ts:151`, which is likewise recomputed against live state).
- **Mitigation path:** the payoff runs the normal damage pipeline, so `shield` blocks the instance
  and `defense` reduces it (`core.ts:1568-1589`) — that IS the "mitigation survives" answer; no
  special-casing needed beyond letting the payoff be a normal (non-`ignoreDefense`) hit.
- **Timing:** the mark cast and the payoff are separate rotation steps with a gap (the "delay to
  clear/mitigate"); tune the gap so one full player turn fits between them.

## Acceptance criteria

**Audit (A):**
- [ ] Every enemy in `NORMAL_ENEMY_DEFS` + the three act bosses has a documented, distinct signature
      (a code comment naming it), and Brute/Cleaver have a **scripted** signature (not just weights).
- [ ] Each enemy's total per-turn threat stays near its current budget (normals ~4.5 party-wide
      dmg/turn) — identity change, not a difficulty spike. Per-fight winrate gates within ±5pp of
      baseline at **N = 1000** seeds with 95% CIs (repo ground rule).

**Hero Poison (B):**
- [ ] `Member` carries a poison DoT; a `'poison'` cast applies **stacking** poison; it ticks and
      decays on enemy turns; Cleanse clears it.
- [ ] Telegraph == applied: the applying cast previews 0 direct damage; DoT ticks are excluded from
      `attackTargets()`/`attackLines()` (property test holds).

**Curse/Mark (C):**
- [ ] A `'curse'` cast marks all living heroes (telegraphed, 0 direct damage); the payoff step hits
      **only still-marked** heroes; Cleanse clears the mark; shield/defense mitigate the payoff.
- [ ] Telegraph == applied for the payoff **turn-to-turn**: `attackTargets()` recomputes against the
      live marked set, so clearing a mark before resolve removes that hero from both preview and
      applied damage (property test holds).

**Global:**
- [ ] The no-name-collision rule on attack/channel/cast names still holds (`enemies.ts:31-35`,
      `:228`).
- [ ] Typecheck/build clean; `npm test` passes. **Split into per-workstream `jj` commits** (audit;
      Hero Poison engine; Curse/Mark engine; boss wiring) per `CLAUDE.md` — not one catch-all commit.

## Implementation notes (anchors)

- **Enemy data:** `src/data/enemies.ts` — `EnemyDef`/`RotationStep`/`ChannelDef` (`:55-101`), the
  normal/boss defs (`:138-274`), `ATTACK_INTENT_NAMES` (`:36`), `CastKind` import (`:1`).
- **Cast kinds:** `CastKind` union `src/data/tuning.ts:74` — add `'poison'`, `'curse'`.
- **Cast resolution:** `_resolveCast` `src/engine/core.ts:1494` — add `case 'poison'` and
  `case 'curse'` alongside `wound`/`siphon`/`consume`.
- **Member status:** `Member` interface `core.ts:85` (`shield`/`regen`/`defense` at `:95-101`);
  init block `:338-343`. Enemy poison to mirror: `core.ts:131`, init `:363`.
- **Cleanse:** `effects.ts:438-446` — extend to clear member poison and marks.
- **Telegraph/preview:** `_generateTelegraph` `core.ts:693`; `attackTargets()` `:749`; live-state
  targeting precedent `targetLowest` `:151` + `_lowestHpSlot()` `:571`; damage pipeline
  (shield/defense) `:1568-1589`.
- **Events:** `GameEvent` union `core.ts:188/223` — add hero-poison / curse / payoff events for the UI.

## Tests (`test/engine.test.ts` / a sibling)

- **Audit:** each enemy's signature step appears in its rotation/weights; property test for
  telegraph==applied on any new damaging step.
- **Hero Poison:** apply → ticks for its magnitude each enemy turn; re-apply **stacks** (magnitude
  adds); Cleanse zeroes it; ticks excluded from `attackTargets()`.
- **Curse/Mark:** mark all → payoff hits marked; Cleanse before payoff → that hero takes 0 and drops
  out of `attackTargets()`; shield/defense before payoff → hero survives; property test:
  `attackTargets()` == applied across a clear-mid-window sequence.
- **Winrate:** the boss fights (with new tools) and the re-signatured act-1 normals stay within ±5pp
  of baseline at N = 1000.

## Out of scope

- Reworking existing signatures that already read well (channelers/piercers/self-healers/phase
  bosses) beyond documenting them.
- New player cards/relics to answer the new mechanics (Cleanse + shield/defense already exist and
  are the intended answers).
- A general per-member cooldown/curse *system* beyond the two specific mechanics here.
