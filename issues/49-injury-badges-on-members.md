# Issue 49 — Injury badges on party members (buff/debuff style)

- **Phase:** fix (quick UI)   **Size:** S
- **Depends on:** —   **Blocks:** none (feeds the Infirmary UI in #58)
- **Addresses:** intake 2026-07-06 — "Show UI elements for injuries on players. Use same style as
  buffs and debuffs. Show injury name, mouse over for details"

## Why

Injuries are currently surfaced only as a single count pill ("🩹 Injured N") on the MemberCard.
The intake wants each injury shown in the same idiom as the buff/debuff pills — the injury's
**name** visible, with mouseover details — so a scarred member reads at a glance and matches the
rest of the status vocabulary.

## Acceptance criteria

- [ ] Each injury renders as its own badge in the member's `.badges` row, styled like the existing
      buff/debuff pills, labelled with the injury **name** (`INJURY_NAMES`: Cracked / Weakened /
      Broken / Shattered).
- [ ] Hovering a badge shows its detail (the penalty it applies, and that it heals at an Infirmary).
- [ ] Consistent everywhere a member card appears — battle **and** run-layer screens (deploy,
      recruit, run-over, etc.).
- [ ] Incapacitated (4th-scar) state stays clearly distinct.
- [ ] Typecheck/build clean; tests pass.

## Implementation notes (anchors)

- `src/components/MemberCard.tsx:127` `.badges` container; `:128-135` the existing buff/debuff
  pills to mirror (Shield/Brace/Ward/Regen/Defense/Taunt/Boar) and `:134` the current single
  "🩹 Injured N" count badge to replace/expand into per-injury badges.
- `src/components/MemberCard.tsx:18` `injuryPenaltyText(injuries)` (detail text helper), `:113-118`
  the incapacitated overlay.
- `src/constants.ts:872` `INJURY_NAMES`; penalty tables/helpers `src/constants.ts:865-867` +
  `:939-941` (`injuryMaxHPPenalty` / `injuryDamagePenalty` / `injuryAbilityPenalty`).
- Member injury field: `src/engine.ts:80` `injuries` (display-only, penalty already folded in).

## Tests

- Presentational; if a per-injury label/detail selector is extracted, unit-test it. Otherwise no
  new engine test.

## Out of scope

- The Infirmary node that *heals* injuries — that's #58 (this issue just displays them).
