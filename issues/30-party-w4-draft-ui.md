# Issue 30 — Party W4: full draft + weight-surfacing UI

- **Status:** ✅ Complete
- **Roadmap phase:** post-demo (party wave 4)   **Size:** M
- **Depends on:** #29   **Blocks:** #31
- **Addresses:** review §3.4 (draft flow)

## Why
With all 8 members built, ship the real draft: three 1-of-2 picks then slot assignment, with the
placement weights **surfaced** so the choice is informed rather than hidden.

## Scope / acceptance criteria
- [x] **Draft at run start:** `rollDraft` offers three 1-of-2 picks from the pool of 8; the
      `DraftScreen` takes one pick per pair, then L/C/R slot assignment, then `chooseDraft(order)`.
- [x] **Surface the weights:** the 25/50/25 open and 40/20/40 veiled placement weights (`SLOT_WEIGHTS`)
      are shown on the draft screen.
- [x] The **classic trio is one click away** — an "Accept the classic trio" button seats
      `CLASSIC_TRIO` immediately (returning players lose nothing).
- [x] **Generator constraints** in `constants.ts`: `DRAFT_RATING` (Ranger 4/Tank 2/Mage 5/Warlock
      7/Berserker 2/Skald 3/Warden 3/Augur 4); the generator guarantees an offer from which a viable
      party is achievable — total conservative damage ≥ `DRAFT_MIN_DAMAGE 8`, one member ≥
      `DRAFT_STRONG_DAMAGE 4`, ≥ `DRAFT_MIN_HEALABLE 2` conventionally-healable members
      (`CONVENTIONALLY_HEALABLE` excludes the self-reliant Warlock/Berserker). Taunt-less drafts stay
      intended variance. (The Taunt-lite fallback is deferred to #31's balance sweep, which is where
      the taunt-less winrate is actually measured.)

## Implementation notes
- Draft location + generator in `src/run.ts`; confirm/weight UI in `src/components/DeckPicker.tsx`
  (or a new draft screen). Constraints enforced in the generator with asserts.

## Tests (required per CLAUDE.md)
- [x] `test/run.test.ts`: across 500 seeds `rollDraft` always offers a viable party with distinct
      members (no repeats across pairs); the classic trio clears the bar while all-weak / low-total /
      too-few-healable parties fail it; `beginDraft` is deterministic in the run seed.
- [x] `test/components.test.tsx`: the DraftScreen surfaces both the open (25/50/25) and veiled
      (40/20/40) slot weights, the classic-trio shortcut, and the per-pair prompt.
- Bug caught & fixed en route: `shuffle` mutates in place, so the draft must copy `DRAFT_POOL`
  (`[...DRAFT_POOL]`) — passing the shared constant would corrupt it globally.

## Out of scope / follow-ups
- The per-composition balance pass is #31; the deferred "Wanderer" swap node stays deferred.
