# Issue 37 — UI polish batch (UI playtest 2026-07-04)

- **Status:** ✅ Complete
- **Roadmap phase:** post-demo   **Size:** S (batch of small fixes)
- **Depends on:** —   **Blocks:** —
- **Addresses:** UI playtest 2026-07-04 (Chrome DevTools round; everything below reproduced live)

## Findings → fixes

1. **Draft screen leaks internal ability ids.** The member cards show `graveChill` / `crescendo` /
   `darkBargain` etc. (both in the visible stats line and the hover `title`), and there is **no
   ability description at all** — the pick is blind. Fix: reuse the per-member ability flavor map
   (currently `ABILITY` in `MemberCard.tsx`) — move it to `constants.ts` (or a shared module) and
   render name + one-liner on the draft card.
2. **Draft pick state is CSS-only.** The chosen option gets a `.chosen` class but no
   `aria-pressed`, so selection is invisible to AT (and to text-based testing). Also true of the
   difficulty radio group's `role=radio` (that one *does* set `aria-checked` — mirror it).
3. **Seating is click-order-only.** In the L/C/R stage you can't place a pick into a chosen slot;
   you must click members in left-to-right order, and "Reset slots" is the only correction. Fine
   for a first pass — consider click-a-slot-then-a-member. Low priority.
4. **"Rest & End Turn (+0 MP)"** at full MP advertises a zero benefit. Label it plain
   "End Turn" when the rest yield is 0 (both full-MP and the 2+-cards-played lockout read better).
5. **Seed input has no id/name/min/max.** DevTools flags it ("a form field element should have an
   id or name attribute"); the a11y tree reports `valuemin/valuemax 0` around a 9-digit value.
   Give it `id="seed" name="seed" min="0" max="4294967295"`.
6. **`favicon.ico` 404s** on every load (the only console error in the whole round). Add a favicon
   (or a `<link rel="icon" href="data:,">` to silence it).
7. **The current turn number is invisible.** The combat log entries are prefixed `T1:` but nothing
   in the fight UI shows the *current* turn; the enrage countdown pip only appears within 4 turns.
   With player-first ordering the turn concept matters more (the standing telegraph belongs to a
   numbered turn). Add a small "Turn N" chip near the enemy intent.

## Verified-good (for the record)

- Drafted identity now flows into fights (Mage/Skald/Augur seated with correct abilities — the
  balance round's fix, confirmed live in Chrome).
- Grave Chill mutates the standing telegraph and the **attack-line preview updates 4 → 2**, then
  the resolved hit lands for exactly 2 (preview == applied, live).
- The Skald's attack badge live-updates with cards played (0 → 2 after one card, reset next turn).
- Deck viewer opens from the DRAW pile, order-hidden with counts; Close works.
- Save/resume: reload mid-run offered "Continue your saved run" with the correct position label
  and resumed at the same node; drafted `member` data survived (only the display names lied — issue
  36).
- Fork preview ("Ahead: Brute"), gold award, difficulty radio group, dev-gated DevPanel: all fine.

## Tests (required per CLAUDE.md)

- Component tests for 1 (draft card shows the flavor line, not the raw id) and 4 (button label at
  0-yield); the rest are markup-only and covered by the existing component render tests.
