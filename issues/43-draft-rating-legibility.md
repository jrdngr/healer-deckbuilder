# Issue 43 — Draft/recruit offers surface DRAFT_RATING as a recommendation

- **Roadmap phase:** post-campaign UI polish   **Size:** XS
- **Depends on:** —   **Blocks:** —
- **Addresses:** playtest 2026-07-05 — legibility finding

## Why

`MemberOfferButton` (used by the start draft, post-boss drafts, and the Recruit node) prints
`rated {DRAFT_RATING[id]}` on every offer. `DRAFT_RATING` is the draft *generator's* conservative
**damage** rating — it exists to validate offer viability, not to rank picks — but rendered next to
the member's name it reads as an overall score. The Warlock is `rated 7`, the highest in the game,
on the same screen where he is the measured worst pick available (21.8% starter winrate vs the
Ranger's 54.4%, and a net-negative recruit — issue 39). The UI is actively steering players into
the trap, and the number is redundant anyway: `DMG {d.damage}` is printed right beside it.

Same screen, second nit: the start draft's offer is always the same three members
(`STARTER_MEMBERS` has exactly `DRAFT_OFFER_SIZE` entries, so the "roll" is a shuffle of all
three). Fine as a class pick — but then the copy ("Recruit your first hero") and presentation
could own that it's a fixed choice, and the fake variance costs nothing to drop.

## Acceptance criteria

- [ ] Remove `rated N` from `MemberOfferButton` (DMG already carries the damage fact), or — if a
      guidance number is wanted — replace it with something honest about the *current* context
      (e.g. the `self-reliant` tag pattern already there).
- [ ] `DRAFT_RATING` stays engine/generator-side (viability checks, sim policy) — this is
      display-only.
- [ ] Optional, with the copy pass: acknowledge the start draft as a fixed 3-class choice.

## Tests

- components.test.tsx: offer button renders without the rating string; existing draft-screen tests
  updated.

## Out of scope

- Fixing the Warlock himself (issue 39). This issue only stops the UI from endorsing him.

## Resolution (landed 2026-07-05)

**Removed `rated N`** from `MemberOfferButton` (DraftScreen.tsx) — `DMG` already carries the damage
fact, and `DRAFT_RATING` stays engine/generator + sim-policy side. Also **reworked the start-draft
copy** to own the fixed 3-class pick ("Choose your starting hero", no fake-shuffle framing).
components.test asserts the offer button renders without the rating string.
