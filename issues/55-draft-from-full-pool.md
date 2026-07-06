# Issue 55 — Starting draft offers 3 random from the full hero pool

- **Phase:** structure (draft, design-relevant)   **Size:** S
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "The starting hero pool should allow for all heroes to be
  drafted. The available options should be 3 options randomized from the full pool of options."

## Why

The start draft currently offers a **fixed** trio (ranger / mage / warlock) because
`STARTER_MEMBERS` has exactly three entries and the "roll" just shuffles those three. Open the
start draft to the whole roster: offer **3 randomized picks from the full pool** so any hero can
start (this also resolves the #43 note that the start "roll" isn't really a roll).

## Acceptance criteria

- [ ] The start draft presents 3 members sampled from the **full** member pool (not the fixed
      3-class list); repeated runs on different seeds show different offers.
- [ ] All heroes are reachable as a starter.
- [ ] Deterministic by seed (same seed → same offer).
- [ ] Interaction with the fight-0 solo start and the #41 guaranteed act-1 recruit stays coherent
      (the solo opener still works whichever starter is picked).
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- `src/constants.ts:187` `STARTER_MEMBERS` (fixed trio), `:182` `DRAFT_OFFER_SIZE = 3`, `:147`
  `DRAFT_POOL` (full 8-member pool), `:12-13` `MemberId`.
- `src/run.ts:242-248` `beginDraft()` → `_rollMemberOffer(STARTER_MEMBERS, DRAFT_OFFER_SIZE)`;
  `:235-237` `_rollMemberOffer(pool, size)` = `shuffle([...pool]).slice(0, size)`; `:253-261`
  `chooseDraftMember`. Change the pool at `:247` from `STARTER_MEMBERS` to `DRAFT_POOL` (or
  `availableMembers()` if graveyard/roster exclusions should apply at start).
- `src/components/DraftScreen.tsx:31-59` (start-draft copy; `isStart` at `:40`).

## Tests

- `test/run.test.ts`: start offer is 3 distinct members drawn from the full pool; varies by seed;
  is deterministic per seed; every hero can appear across seeds.

## Out of scope

- Rebalancing individual starters (Warlock trap etc. — that's #39, already landed) or removing
  `STARTER_MEMBERS` if other code still references it (keep it if used elsewhere).
