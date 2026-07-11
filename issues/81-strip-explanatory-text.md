# Issue 81 — Strip explanatory text across the UI

- **Status:** 📋 Open
- **Phase:** post-demo (UI polish)   **Size:** M (full self-driven sweep)
- **Depends on:** —   **Blocks:** —   **Relates:** #80, #82 (deck-selection screen)
- **Addresses:** intake 2026-07-11 — "There's a ton of explanatory text all over the UI. Remove all
  of it. Do a full pass yourself; here are some examples."

## Why

The UI carries a lot of instructional/flavor prose that the maintainer wants gone. This is a **full
pass** — the listed examples are a starting point, not the complete set; sweep every screen and
remove the descriptive/instructional paragraphs. Tooltips and mechanical numbers **stay** (decision:
"Keep tooltips + mechanical text").

## Acceptance criteria

- [ ] **Remove** the multi-sentence descriptive / instructional / flavor prose blocks across screens.
      Named examples that MUST go (there will be more — find them):
  - Act-structure blurb under **"Your run begins"** (start screen).
  - **"Pick up where you left off"** on the continue card.
  - **"The opening battle is a solo…"** on the new-run card.
  - **"Each preset…"** on the deck-selection screen.
  - The **ability descriptions on the deck-selection preset options**.
  - The **setup description** on the Deploy page.
  - **"Visit the stops…"** on the choose-your-path screen.
- [ ] **Preserve:** hover `title=` tooltips; any text that states a mechanical number or cost (card
      cost, status-pill numbers, badge tooltips, price tags); screen/node headings and button labels;
      the **draft/recruit** member ability descriptions in battle and on the draft cards (#37) — that
      is the draft screen, **distinct** from the preset deck-selection screen whose ability lines are
      removed above.
- [ ] Rule of thumb where ambiguous: remove sentence/paragraph prose; keep short helper **labels**
      (a word or two) and all tooltips.
- [ ] Typecheck/build clean; update any component test that asserts removed copy.

## Implementation notes (anchors)

- Sweep the screen components: the start / continue / new-run entry (App entry + start-screen
  component), the **deck-selection** screen (renders `STARTER_DECKS[...].desc` and per-preset ability
  lines — stop rendering both; the `desc`/type data can stay in `constants.ts` unused, or be trimmed),
  the **Deploy** screen, and the **fork / choose-your-path** screen.
- `src/components/nodeMeta.ts` holds short per-node `desc` one-liners (e.g. `Sanctum` → "Improve the
  healer's resources."). These are **short helper labels**, not prose — leave them (and note the
  Sanctum entry itself is removed by #83), unless a specific one reads as a full explanatory sentence.
- Coordinate with **#82**: that issue rebuilds the preset card lists but does **not** rely on the
  on-screen preset descriptions, so removing the deck-selection prose here is safe either order.

## Tests

- Component tests that asserted the removed copy are updated to assert its absence (or the surviving
  heading/labels). No engine changes.

## Out of scope

- Rewording or restyling the kept text; layout changes beyond removing the text blocks.
- Removing tooltips or any mechanical/number text.
