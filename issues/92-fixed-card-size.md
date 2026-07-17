# Issue 92 — Cards (and empty slots) are a single fixed size; shorten text that doesn't fit

- **Status:** ✅ Done
- **Phase:** ui (battle polish)   **Size:** M
- **Depends on:** —   **Blocks:** #93 (overlapping hand math relies on a fixed card size)
- **Addresses:** intake 2026-07-17 — "Cards sometimes change size. They should always be the
  same size. Empty slots should also be the same size, e.g. empty hero slots. If a card's text
  doesn't fit on the card, don't expand the card, shorten the text."

## Why

Cards grow to fit their text today, so a wordy card is visibly taller than its neighbors and the
hand row looks ragged. `.card` is `width: 132px; min-height: 158px` (`styles.css:528-536`) — fixed
width but a **min**-height that expands with content, and the description (`.cdesc`,
`styles.css:656`) wraps freely with no clamp. Member/hero cards (`.member`, `styles.css:270-274`)
and empty hero slots (`.member-empty`, `Party.tsx:32-33`, `styles.css:1260-1261`) have the same
min-height-grows behavior. The fix has two halves: make the box a truly fixed size, and make the
**content** fit that box by shortening card wording (maintainer decision below) rather than letting
the box grow.

## Approach (maintainer decision, intake 2026-07-17)

**Rewrite long text, don't auto-clamp.** Lock every card and slot to one fixed size, then find each
card whose `desc` overflows the box at that size and shorten the wording in the card data. No
ellipsis / line-clamp / font auto-scaling as the primary mechanism — the text should read in full,
just tighter. Present the list of overflowing cards with proposed shorter wording for per-item
approval (the maintainer's standing per-item loop) before editing them.

## Acceptance criteria

- [ ] **Hand cards are one fixed size.** `.card` uses a fixed `height` (not `min-height`) — keep the
      current footprint (132×158) unless a slightly taller fixed height is needed to fit the longest
      *approved* card. Every card in hand renders at identical width **and** height regardless of
      text length.
- [ ] **Empty slots match.** Empty hero/party slots (`.member-empty`) and the empty Reserve slot
      (`.reserve-empty`, `styles.css:182-185`) render at exactly the same fixed dimensions as their
      filled counterparts, so grids never reflow when a slot fills/empties.
- [ ] **Member/hero cards are one fixed size.** `.member` uses a fixed height rather than
      `min-height: 204px`, so a hero with more text is the same height as one with less.
- [ ] **No card text overflows its box.** After shortening, no card's name or description is clipped
      or overflows at the fixed size. A CSS safety net (e.g. `overflow: hidden` / a line-clamp) may
      be added as a backstop, but the acceptance bar is that real cards fit *without* triggering it.
- [ ] **Overflowing-card wording is approved before edit.** The set of cards whose `desc` was
      shortened, with old→new text, is recorded in this issue's Resolution section, and the wording
      was approved per the per-item loop.
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean; lands as a focused `jj` commit. If any
      test asserts a card's `desc` substring (log/probes are brittle per prior naming passes), update
      it to the new wording.

## Implementation notes (anchors)

- **Hand card box:** `styles.css:528-536` `.card { width:132px; min-height:158px; padding:28px 10px
  10px }` → fixed `height`. `.card::before` family pill at `:538-541`. Text: `.cname`
  (`styles.css:655`) and `.cdesc` (`styles.css:656`). Rendered in `Card.tsx:118-121` (`.cost`,
  `.heal`, `.cname = card.name`, `.cdesc = card.desc`).
- **Member card box:** `styles.css:270-274` `.member { max-width:210px; min-height:204px }`; grid
  `.party` at `styles.css:269` (3 fixed columns); `.member h3` at `:281`.
- **Empty slots:** `Party.tsx:32-33` renders `.member-card.member-empty`; styled `styles.css:1260-1261`.
  Reserve empty: `styles.css:182-185`.
- **Card data (the text to shorten):** card defs live in `src/constants.ts` (`CARDS`, the `desc`
  field per card). Measure the longest descriptions against the fixed box and shorten only those
  that overflow; leave the rest verbatim.
- **Finding overflow:** enumerate `CARDS` by `desc` length; the longest handful are the candidates.
  Verify against the actual rendered box (the maintainer eyeballs final fit per `CLAUDE.md`).

## Tests

- `test/engine.test.ts`: this is CSS + data wording; the only engine-relevant risk is a renamed/short
  `desc` breaking a substring assertion. Grep tests for any `.desc`/log-substring probe on the
  edited cards and update. No new mechanic to test.

## Resolution (2026-07-17)

**CSS — locked every card/slot to a fixed size** (`styles.css`):

- `.card`: `min-height:158px` → `height:158px` + `overflow:hidden` (backstop only — real
  text is kept short enough not to trigger the clip).
- `.reserve-empty`: `min-height:158px` → `height:158px` (matches a filled reserved `.card`).
- `.member`: `min-height:204px` → `height:204px`.
- `.member-empty`: was un-sized (relied on grid stretch, collapsing when all slots empty);
  now `width:100%; max-width:210px; height:204px; margin-inline:auto` — exactly a `.member`.

Global `* { box-sizing: border-box }` means each fixed height IS the rendered box, so filled
and empty slots match to the pixel and grids never reflow.

**Card text — shortened the 11 descs that overflowed the fixed 132×158 box** (measured via a
word-wrap line-count model; all other cards fit verbatim). Wording approved per the per-item
loop, mechanics/numbers/interpolated constants preserved. Old → new:

| Card | Old | New |
|---|---|---|
| En Garde | Through the Duelist, a chosen member Provokes (enemy aims at them) and gains Riposte for 3 enemy turns — they counter every hit that strikes them. | A member Provokes (enemy aims at them) and gains Riposte for 3 turns — they counter every hit. |
| Feat of Strength | Through the Strongman, pay 4 HP (no clamp — it can kill him); every living member's auto deals +2 for 2 enemy turns. | Pay 4 HP (no clamp — can kill him); every member's auto deals +2 for 2 turns. |
| Strongest in the World | The Strongman pays 5 HP (no clamp — it can kill him); every living member's auto lands doubled this turn. | Pay 5 HP (no clamp — can kill him); every member's auto lands doubled this turn. |
| Sacrifice | A chosen ally pays 6 HP (clamps to 1); the Warlock gains +2 damage & +2 ability power for the fight. Consumed after one use. | An ally pays 6 HP (min 1); the Warlock gains +2 damage & +2 ability power this fight. One use. |
| Sap | Channel: each turn make the enemy more Vulnerable (+25% up to +75%), for up to 4 turns. Playing any card ends it. | Channel: each turn the enemy grows +25% Vulnerable (up to +75%), for 4 turns. Ends on any card. |
| Concentrated Venom | Double the enemy's current Poison-per-turn (its duration is unchanged). | Double the enemy's Poison-per-turn (its duration is unchanged). |
| Mending Stream | Channel: heal a member for 3 each turn (up to 4 turns). Ends if they die or you play a card. | Channel: heal a member 3/turn (up to 4). Ends on death or any card. |
| Hold the Line | The Tank braces (Defense 3 for 2 turns); while it stands, the damage he soaks banks double for Grudge. | The Tank braces (Defense 3, 2 turns); while it holds, damage he soaks banks double Grudge. |
| Drain Life | Deal 3 to the enemy (more if it is Vulnerable); the most wounded member heals for the damage dealt. | Deal 3 (more if Vulnerable); the most wounded member heals for the damage dealt. |
| Goo Burst | Consume the enemy's Poison and deal its whole remaining damage (per-turn × turns left) at once. | Consume the enemy's Poison and deal its whole remaining damage at once. |
| Arcane Lens | Your next single-target heal this turn also heals the most wounded other member for the same amount. | Your next single-target heal this turn also hits the most wounded other member. |

**Test touch:** Mending Stream's shorter tail ("Ends on death…") changed the channel-effect-line
derivation. Generalized `channelEffectLine`'s cancel-sentence regex (`src/channelView.ts`) to
strip `Ends (if|on) …`, and updated the one asserting test (`engine.archetypes.test.ts`) to the
new effect line. `npm test` (all suites), `npm run typecheck`, `npm run build` clean.

## Out of scope

- Ellipsis/font-auto-scale as the *primary* fit strategy (rejected in favor of rewriting text; a CSS
  backstop is allowed but must not be what makes real cards fit).
- The hand's second-row/overlap behavior — that is #93 (this issue only fixes per-card size; #93
  consumes the now-guaranteed fixed size).
- Changing card **mechanics**, cost, heal values, or names — wording of the `desc` only.
- Reserve caption truncation (`styles.css:171`) is already ellipsis'd and is not a card box.
