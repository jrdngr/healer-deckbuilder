# Issue 13 — Boss 2: Hexweaver — "you can't turtle" + Cleanse card (P5)

- **Roadmap phase:** P5   **Size:** M
- **Depends on:** #12 (strict boss order)   **Blocks:** #14 (needs the `'cast'` telegraph kind)
- **Addresses:** review §4 P5 (roadmap M4); the content-side answer to flaw #1

## Why
The Hexweaver is the **telegraphed taunt-punisher**: it exists to break the permanent-taunt/turtle
solve that the P1 pricing (#03) only partially addresses. It attacks the healer's tools directly.
It **ships with its own counter (Cleanse)** so it's tuned against real counterplay.

## Scope / acceptance criteria
- [ ] **Piercing Bolt:** ignores Taunt/Defense, targets the **lowest-HP** member.
- [ ] **Hex/Wound:** healing received **−50% for 3 turns**; must intercept **both** the direct heal
      path (`_healMember`, `engine.ts:350`) **and** the regen tick (`engine.ts:452`).
- [ ] **Siphon:** drains **3 healer MP** (floor 0); previewed on the ManaBar.
- [ ] Semi-scripted rotation mixing the three.
- [ ] **Cleanse card** (uncommon, removes Wound) added to the pool this issue, so counterplay is in
      the pool at tuning time.
- [ ] New telegraph kind **`'cast'`** added to the engine (prerequisite for #14's Consume).
- [ ] **Gates:** mechanics unit tests; Hexweaver **65–75%**; a turtle policy loses to an adaptive
      policy with non-overlapping CIs.

## Implementation notes
- Attack flags (ignore-taunt/defense, target-lowest) on the attack spec in `src/engine.ts`.
- Heal-reduction interception points: `engine.ts:350` (direct) and `:452` (regen tick).
- Siphon reads/writes healer MP; ManaBar preview in `src/components/ManaBar.tsx`.
- Cleanse joins `CARD_POOL` in `src/constants.ts` (60/30/10 weights).

## Tests (required per CLAUDE.md)
- Piercing Bolt bypasses taunt and hits lowest HP; Wound halves both heal paths for 3 turns;
  Siphon floors at 0; Cleanse removes Wound; Hexweaver sim gate + turtle-vs-adaptive CI test.

## Out of scope / follow-ups
- Devourer's phase system and Consume are #14 and build on the `'cast'` kind added here.
