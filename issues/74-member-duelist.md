# Issue 74 — Duelist: counterattack tank and En Garde

- **Status:** ✅ Complete
- **Phase:** content (roster + ability)   **Size:** M
- **Depends on:** #65 (hit-steering + block-payoff web this kit pays off)   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: a member who converts *being attacked
  well* into damage; approved as proposed.

## Why

The existing Riposte card is a one-shot: one counter, then spent. The Duelist's En Garde grants
**persistent Riposte** — for 2 enemy turns the target counterattacks **every** hit that lands on
them. Steer a multi-hit sweep into her with Feint (#65) or Provoke/Goad, keep her alive with
Shield/Brace (Scarlet Ward #68 prices that in HP), and the enemy's own action economy becomes
your damage. Bulwark Core (#65) chains blocks into Brace so the turtle holds.

## The member

- **`duelist`**, name "Duelist" — `maxHP 12`, `damage 3`, salary **15**, ability `'enGarde'`.
  Front-line skirmisher (between Tank and Ranger).

## The ability — En Garde (ability card)

- **Card:** cost **2**, `target 'single'`, `ability 'enGarde'`, type **iron**. Counts toward iron
  type counters (Iron Ward's first-iron-discount applies).
- **Effect:** the **chosen member** gains **Riposte for 2 enemy turns** — they counterattack for
  their auto damage on **every hit** that strikes them (not consumed on first trigger, unlike the
  Riposte card).
- **Note the targeting departure:** existing ability cards are `target 'none'` (auto-resolve on
  the bound member). En Garde is the first `target 'single'` ability card — the Duelist grants
  the stance to anyone (herself included). If the single-target ability path fights the #44
  per-member card machinery, fall back to `target 'none'` (self only) and flag it in review —
  but single-target is the approved design.

## Design decisions

- **Counter damage = the defender's current auto damage** including active modifiers (Sharpen,
  Battle Hymn, Anvil Stance #65 while shielded, Lone Wolf, injuries) — one damage-calc source,
  the auto-attack path.
- **Every hit counters:** a 3-hit sweep into the Duelist = 3 counters. AoE hitting the whole
  party triggers only members holding the stance.
- **A fully blocked hit (Shield) still counters** — the stance rewards blocking, aligned with the
  #65 web ("the better the block, the bigger the payoff"). Counter damage routes through
  `_damageEnemy` (Vulnerability applies).
- **Stacking with the one-shot Riposte card:** the timed stance supersedes; while En Garde runs,
  the one-shot is neither consumed nor double-triggered (persistent state wins; document in code).
- **No cap** on counters per turn/fight.

## Acceptance criteria

- [ ] `AbilityId 'enGarde'`; `duelist` in `MEMBER_POOL`, `DRAFT_POOL`, `MEMBER_BASE_SALARY` (15),
      `MEMBER_ABILITY_FLAVOR`; ability card in `ABILITY_CARD` (cost 2, `target 'single'`) +
      `CARD_TYPE` (`iron`); excluded from shop/starter pools; unplayable while the Duelist is down.
- [ ] Stance counters every hit for 2 enemy turns, including fully blocked hits; damage =
      defender's live auto calc; routed through `_damageEnemy`.
- [ ] Multi-hit resolution: N hits on the stance-holder → N counters in that enemy phase.
- [ ] Timer decrements with other member timers; expires cleanly; death ends it.
- [ ] One-shot Riposte interaction per the supersede rule, with a test.
- [ ] Party→enemy damage only — telegraph preview untouched and property test green.
- [ ] Mechanic-coverage row; N=1000 sim with the Duelist fieldable stays in the 25–35% band.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Member/ability plumbing:** #61 template (`MEMBER_POOL` `src/constants.ts:140-198`,
  `ABILITY_CARD` `:795-815`, `_fireAbility` `src/engine.ts:~1700-2160`). For `target 'single'`,
  the card-targeting flow the UI already runs for single-target cards is the seam — the ability
  resolution receives the chosen member.
- **Counter site:** the one-shot Riposte trigger in the incoming-damage path (`Member.riposte`,
  `src/engine.ts:61`; mitigation pipeline `:1130-1160`) — add `riposteTurns` beside it; the
  persistent branch fires per hit without clearing.
- **Auto damage calc:** the party-phase auto path (`src/engine.ts:431+`) — extract/reuse so
  counters and autos share one number.

## Tests

- En Garde + Feint a two-hit attack into the Duelist → two counters at her auto damage.
- Counter respects Sharpen (+1) and Anvil Stance (+2 while shielded) in the same phase.
- Fully Shield-blocked hit still counters; Whetstone (#65) still sees her as untouched.
- Stance + one-shot Riposte: exactly one counter per hit; one-shot not consumed.
- Timer: counters on enemy turns 1–2, none on turn 3.

## Out of scope

- Enemy-side riposte/thorns mechanics; multi-member stances from one cast.
- Retuning the one-shot Riposte card.
