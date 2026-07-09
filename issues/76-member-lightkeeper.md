# Issue 76 — Lightkeeper: overheal-as-mitigation and Radiance

- **Status:** ✅ Complete
- **Phase:** content (roster + ability)   **Size:** M
- **Depends on:** #69 (heal-result struct + overheal capture + topping payoffs)   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: overheal made defensive and stronger
  (user verdict on the redesign round; first-draft offensive rider rejected).

## Why

The wave makes "party at full HP" a plan (#69); the Lightkeeper is the member who executes it.
Radiance heals the whole party and converts every point of overheal into **Brace** — on a topped
party that's 2 MP for party-wide −2 mitigation right before a boss swing, and it stacks: repeat
casts pile Brace higher (a deliberate carve-out from Brace's newest-replaces rule). It feeds
Anvil Stance (+2 while braced, #65), Benediction's buff counts (#69), Bulwark Core chains (#65),
and still triggers Beacon on heals-to-full (#69). Approved design, redesign round 2026-07-07.

## The member

- **`lightkeeper`**, name "Lightkeeper" — `maxHP 11`, `damage 2`, salary **15**, ability
  `'radiance'`. Support body.

## The ability — Radiance (ability card)

- **Card:** cost **2**, `target 'none'`, `ability 'radiance'`, type **holy**. Counts toward holy
  type counters (Reliquary of Light's +1 holy heal applies to its healing).
- **Effect:** heal **every living member 2**; **any overheal converts to Brace** on that member.
  **Radiance's Brace adds to existing Brace** (carve-out from the newest-replaces rule). No cap.
- Ability power (Empower / injury penalty) modifies the heal amount (and therefore the possible
  conversion), keeping one lever.
- A member holding a **Shield**: Brace normally replaces Shield — for Radiance's conversion,
  **do not overwrite a Shield**; the overheal-Brace is skipped for that member (a full block is
  already better than Brace 2; silently downgrading a Shield would be a feel-bad trap). Document
  this as the one asymmetry.

## Design decisions

- **Reads #69's heal-result struct** ({healed, overheal, reachedFull}) per member — no separate
  overheal math; Aegis Font ordering follows the #69 rule (card-level conversion first; Font gets
  no share of converted overheal).
- **Stacking semantics:** `brace += overheal` and the brace timer refreshes to the standard
  3-enemy-turn fade on each addition (one timer, growing value — simplest model that preserves
  "pile it up").
- **Beacon (#69) triggers** for members Radiance heals to exactly full (overheal 0 still counts as
  reachedFull when the heal lands on the line).
- **Reliquary of Light** (+1 holy heal) raises the heal, which on topped members becomes +1 more
  Brace — intended relic chemistry.

## Acceptance criteria

- [ ] `AbilityId 'radiance'`; `lightkeeper` in `MEMBER_POOL`, `DRAFT_POOL`, `MEMBER_BASE_SALARY`
      (15), `MEMBER_ABILITY_FLAVOR`; ability card in `ABILITY_CARD` (cost 2, `target 'none'`) +
      `CARD_TYPE` (`holy`); excluded from shop/starter pools; unplayable while she's down.
- [ ] Heal 2 to every living member through the normal heal pipeline (Field Triage, Reliquary of
      Light apply); per-member overheal converts to Brace, additive with existing Brace, timer
      refreshed; Shield-holders skip the conversion (Shield preserved).
- [ ] Repeat casts stack Brace without limit.
- [ ] Beacon fires per member healed to full by Radiance; Aegis Font does not double-convert.
- [ ] Mechanic-coverage row; N=1000 sim with the Lightkeeper fieldable stays in the 25–35% band.
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Member/ability plumbing:** #61 template (`MEMBER_POOL` `src/constants.ts:140-198`,
  `ABILITY_CARD` `:795-815`, `_fireAbility` `src/engine.ts:~1700-2160`).
- **Heal + overheal:** the heal pipeline `src/engine.ts:1035-1059` via #69's result struct;
  Group Heal's all-target loop is the iteration pattern.
- **Brace state:** `brace`/`braceTurns` on `Member` (`src/engine.ts:61`); the additive carve-out
  is scoped to Radiance's conversion path only — the Brace card keeps newest-replaces.

## Tests

- Full party: Radiance → every member Brace +2, no HP change; cast again → Brace 4.
- Mixed party: wounded member healed 2 (no Brace); member 1-below-max → +1 HP and Brace 1.
- Shield-holder: Shield intact, no Brace granted, heal still lands.
- Reliquary of Light owned: topped members gain Brace 3.
- Beacon: member healed exactly to full → draw 1.
- Brace from Radiance + Brace card interaction: card replaces per normal rules (test pins the
  asymmetry).

## Out of scope

- Ward/Shield conversion variants; retuning Brace fade timers.
- Aegis Font retune (ordering rule handled in #69).
