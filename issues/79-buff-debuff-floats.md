# Issue 79 — Floating "+1 ATK" popups for every buff and debuff

- **Status:** ✅ Complete
- **Phase:** post-demo (UI juice)   **Size:** M
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-11 — "When I buff members with +1 ATK, the popup should show
  over each affected member. True for all other buffs and debuffs as well."

## Why

There is **no floating-number/label system** today. A member's state changes are announced only by
(a) one-shot CSS reactions on the card (`react-heal` / `react-hit` / …, a fixed five-class set) and
(b) the persistent badge pills. When the healer buffs the party (`+1 ATK` etc.) or a debuff lands,
nothing rises over the affected member to name the change. The maintainer wants a floating popup —
e.g. `+1 ATK` — over **each** affected member, for **every** buff and debuff.

## Acceptance criteria

- [ ] A short floating label rises over a member card whenever a buff/debuff is applied to that
      member: e.g. `+1 ATK` / `−1 ATK`, `Shield`, `Brace`, `Ward N`, `+2 Regen`, `Def 2`, `Taunt`,
      `Cleansed`, a resurrect flag, a blood HP cost, a scar/injury name, etc. (heal amounts may reuse
      the same channel or stay on the existing `react-heal` pulse — implementer's call, but a buff
      like `+ATK` MUST float).
- [ ] **Party-wide attack buffs fan out to every affected living member** — Battle Hymn, Rally,
      Consecration's strike bonus, Blood Banner, Penance, etc. show the `+N ATK` float over *each*
      buffed member, not a single center banner.
- [ ] Coverage is the full buff/debuff set (the "all buffs & debuffs" scope): the per-member effects
      the engine already emits (heal, regenApplied, shieldApplied, defenseApplied, braceApplied,
      wardApplied, taunt, resurrect, cleanse, bloodPay, graveChill, boarSummon, stun, enGarde,
      penance) plus the party-wide +ATK buffs above and any member-side debuff (Hex healing-reduction,
      a gained scar). Enemy-side numbers (poison/vuln over the enemy) are out of scope unless trivially
      shared.
- [ ] **Presentation only** — the `attackTargets()` telegraph == applied-damage invariant is
      untouched; no engine mechanic changes.
- [ ] Honors `prefers-reduced-motion` (fade in place, no travel) like the existing `.fx-*` effects.
- [ ] The engine stays pure/DOM-free: floats are driven by GameEvents, sequenced in the animation
      layer, and rendered in the UI — no DOM from `engine.ts`.
- [ ] Typecheck/build clean; tests pass.

## Implementation notes (anchors)

- **Event feed** `src/engine.ts:202` (`type GameEvent`): most member-affecting events already exist
  and carry a `slot`. The party-wide attack buff currently emits a single `{ kind: 'hymn'; bonus }`
  (`:247`) with **no per-member info** — extend it (fan out over the live party in the animator, or
  add slot data) so a float lands on every living member. Audit `rally`, `consecration`,
  `bloodBanner`, `anvilStance`, `penance` (`engine.ts:2777` `rally`, `:2843` standing buff, etc.) —
  add/emit member-level events where a buff currently has none.
- **Animation layer** `src/animations.ts:57` `MemberReactKind` is a fixed CSS-class set; add a
  floating-label channel — either a new member-anchored timeline fx `{ slot, text, tone }` or extend
  `MemberReact` (`:58`) with an optional label. `FxLayer` already renders anchored fx
  (`src/components/FxLayer.tsx:169` banner case) — a member-anchored label fits the same pattern.
- **Member card** `src/components/MemberCard.tsx:70-78` plays one-shot reactions by toggling a class
  keyed on `react.seq`; a transient float child can mount the same way (fresh key per trigger to
  restart the rise).
- **Styles** `styles.css`: add a `.member-float` rise/fade keyframe near the existing `.fx-*` rules
  (`:882+`), and add it to the `prefers-reduced-motion` block (`:937`).

## Tests (required per CLAUDE.md)

- Engine: the buff events still carry the correct amounts/slots (e.g. `hymn`/rally bonus, defense
  amount) — a party-wide +ATK buff resolves to a per-member payload the animator can fan out.
- Component/animation: a heal / shield / `+ATK` event produces a float with the right label over the
  right slot(s); a party-wide hymn yields **one float per living member**; a debuff (Hex / gained
  scar) produces a float.

## Out of scope

- Reworking the persistent badge pills or the existing `react-*` pulses (they stay).
- Enemy-anchored floats (poison/vulnerability numbers over the enemy).
