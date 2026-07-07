# Issue 61 — Sentinel: a Stun party member and the Stun ability

- **Status:** 📋 Open
- **Phase:** content (roster + ability)   **Size:** L
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-07 — "Create a new party member with a stun ability. This ability
  prevents the next enemy action. The enemy action is cancelled and the enemy will choose a new
  action on their next turn. If the cancelled move has a cooldown, trigger the cooldown as if the
  move was successful."

## Why

Adds a control member. Stun cancels the enemy's standing telegraph: the enemy loses the turn, the
cancelled move is **consumed** (the rotation advances as if it had resolved — the "cooldown as if
successful" clause), and a fresh action telegraphs next turn. Because the ability card is expensive
(5 MP) and the stunned turn still ticks the clock toward enrage, its own tempo cost is the balance
lever — no hard once-per-fight gate.

## Design decisions (intake interview 2026-07-07)

- **Scope:** Stun cancels **any** standing telegraph — normal attacks, boss rotation steps, **and**
  channel wind-ups. It is not restricted from bosses or channels.
- **Limiter:** no once-per-fight cap and no new cooldown system. The bound ability card costs **5 MP**;
  the MP burn plus the tempo lost toward enrage is the intended (retune-later) balance lever.
- **Member:** a **sturdy bruiser** — proposed `sentinel`, name "Sentinel", `maxHP 13`, `damage 2`,
  home slot 0 (front line). Rename/retune freely in this issue.

## Acceptance criteria

- [ ] New `AbilityId` `'stun'` and a new pool member (`sentinel`, HP 13, DMG 2, ability `'stun'`)
      added to `MEMBER_POOL`, `DRAFT_POOL`, `MEMBER_BASE_SALARY`, and `MEMBER_ABILITY_FLAVOR`.
- [ ] New ability card bound to `stun` in `ABILITY_CARD`: `cost 5`, `target 'none'`, `ability 'stun'`
      — auto-resolves on the deployed member carrying stun (the #44 per-member pattern), and is
      unplayable while that member is down (existing `isAbilityCardDisabled` path).
- [ ] Firing Stun cancels the standing telegraph: the coming enemy resolution deals **no damage and
      runs no cast** ("the enemy loses the turn").
- [ ] The cancelled move is **consumed as if it had resolved** — the rotation advances
      (`rotationIndex++`), a channel wind-up is **aborted** (does not resume/land later), and the
      **turn counter still ticks** (progress toward enrage). The next enemy phase telegraphs a fresh
      action; a boss's cancelled step does **not** repeat.
- [ ] Works on bosses and channel wind-ups (per the scope decision).
- [ ] Telegraph==applied invariant holds: while stunned, `attackTargets()` / `attackLines()` report
      **0 / no lines** so the property test stays true and the UI clears the incoming attack.
- [ ] A `cast` telegraph (Hex / Siphon / Consume) is likewise consumed with no scripted effect.
- [ ] Tests pass; typecheck/build clean; ends in its own `jj` commit.

## Implementation notes (anchors)

- **Types/data:** `AbilityId` union `src/constants.ts:21`; `MEMBER_POOL` `:102-127`; `DRAFT_POOL`
  `:147`; `MEMBER_BASE_SALARY` `:1223`; `MEMBER_ABILITY_FLAVOR` `:611`; `ABILITY_CARD` map `:786`;
  add the new `CardDef` in the ability-cards block `:688-704` (cost 5, `target 'none'`,
  `ability 'stun'`).
- **Ability resolution:** add `case 'stun'` to `_fireAbility` `src/engine.ts:1700-1818`. Mark the
  standing telegraph — add a `stunned?: boolean` to the `Telegraph` interface (near `:106`), set
  `this.telegraph.stunned = true`, `_log`, and `_emit({ kind: 'stun', … })` (add the event to the
  `GameEvent` union near `:172`).
- **Enemy resolution:** in the resolve block `src/engine.ts:1017-1075`, check the stun flag **before**
  the channel-tick / chime / cast / attack branches. If stunned: skip the attack/cast entirely,
  `_decayBuffs()`, then run the normal tail — `rotationIndex += 1; this.turn += 1;
  this.telegraph = this._generateTelegraph(this.turn); this._announceChannel(...)` (`:1071-1074`).
  This mirrors the channel-tick early-return (`:1021-1031`) but **advances the rotation and
  re-telegraphs** instead of keeping the same telegraph standing — that is the "consume + choose a
  new action next turn" behavior.
- **Preview coherence:** make `attackTargets()` (`:556`) and `attackLines()` (`:649`) treat a stunned
  telegraph as empty so preview == applied == 0.
- **"Cooldown as if successful" mapping:** there is no per-move cooldown system in the engine; the
  closest analog is a rotation step, and advancing `rotationIndex` *is* consuming the move. Document
  this in the code comment so the note's intent is traceable.

## Tests

- `test/engine.test.ts`:
  - Deploy a Sentinel, give 5 MP, play the stun card, end turn → the enemy dealt **0** damage that
    turn and a new/next telegraph now stands.
  - Stun a rotation-boss step → `rotationIndex` advanced (the stunned step is skipped, not repeated).
  - Stun a channel wind-up → the channel is aborted (never lands).
  - Property test: while stunned, `attackTargets()` == applied == **0**.
  - Enrage: the turn counter still advanced on a stunned turn.

## Out of scope

- A general per-move cooldown system (this issue only maps the note's clause onto rotation advance).
- Stun UI/FX beyond a log line + event; multi-target or multi-turn stun.
