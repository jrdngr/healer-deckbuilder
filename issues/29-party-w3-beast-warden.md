# Issue 29 — Party W3: Beast Warden + pet subsystem

- **Status:** ✅ Complete
- **Roadmap phase:** post-demo (party wave 3)   **Size:** M–L (most invasive member)
- **Depends on:** #28   **Blocks:** #30
- **Addresses:** review §3.4 (roster wave 3)

## Why
The Beast Warden introduces a **pet** — a unit on her slot that can't be healed and absorbs whole
hits. It's the most invasive member (a new kind of board entity), so it ships last of the five.

## Scope / acceptance criteria
- [x] **Beast Warden** — 9 HP, 1 dmg. *Call Boar* (2 MP, Ability card): summon a **Boar
      (`BOAR_HP 7` + abilityPower)** on her slot for **`BOAR_TURNS 4` enemy turns**; recast replaces
      at full (no stack).
- [x] Boar behavior: adds **+`BOAR_STRIKE_BONUS 4`** to her strike (1 → 5); **absorbs every instance
      aimed at her slot, whole** (intercepts in `_resolveAttack` before the ward pipeline, and
      `_wardedDamage` previews it as 0 so preview == applied); **unhealable** (not a member — no heal
      path); **no spill** to the Warden.
- [x] Boar HP 7 = exactly one base heavy. Modeled as `boarHp`/`boarTurns` fields on the Warden
      (not a members-array entry), so it is exempt from heal targeting and the wipe check; cleared on
      the Warden's death. New `boarSummon`/`boarHit`/`boarExpire` events + animations; live Boar badge
      on the MemberCard.

## Implementation notes
- New pet entity in the member/board model (post-#08). It occupies a slot but is exempt from heal
  targeting and from the wipe check as a member. Emit summon/expire `GameEvent`s for animation.

## Tests (required per CLAUDE.md)
- [x] `test/engine.test.ts`: Call Boar summons 7 (+abilityPower) HP for 4 turns and lends +4 strike;
      the Boar absorbs a whole instance (a base heavy = one Boar) with no spill and previews as 0 to
      the Warden; a small hit only chips it; it is unhealable; it expires after 4 enemy turns; it is
      exempt from the wipe check (a lone Warden behind a Boar survives a 99-damage blow).
- [x] `test/sim.test.ts`: the policy keeps a Boar up and pilots the Beast Warden to completion,
      winning ordinary fights. Trio pins bit-identical.

## Out of scope / follow-ups
- Full draft UI + weight surfacing is #30.
