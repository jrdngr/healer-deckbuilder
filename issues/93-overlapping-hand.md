# Issue 93 — Overlapping single-row hand (Slay-the-Spire style), no second row

- **Status:** ✅ Complete (2026-07-17 — hand is a single non-wrapping row; cards overlap only when crowded via a container-query `margin-left`, hover lifts the card to the top z-order and pushes neighbors apart)
- **Phase:** ui (battle polish)   **Size:** M
- **Depends on:** #92 (relies on a fixed card size)   **Blocks:** —
- **Addresses:** intake 2026-07-17 — "Get rid of the second row of hand cards… Instead, start
  overlapping cards. Mousing over a card moves the cards on either side so that the moused-over
  card's text is clear and readable. This is the system used by Slay the Spire."

## Why

When the hand holds more fixed-width cards than fit the row, `.hand`'s `flex-wrap: wrap`
(`styles.css:527`) breaks them onto a **second row**, which looks bad and shifts layout. Slay the
Spire never wraps: extra cards overlap into a single row and the hovered card pops forward while its
neighbors slide apart so its text is readable. The current CSS already tilts/fans cards and lifts the
hovered one (`styles.css:544-576`) but keeps a fixed `gap: 12px`, so cards never actually overlap —
they just wrap. This issue replaces wrap with dynamic overlap.

## Approach (maintainer decision, intake 2026-07-17)

**Overlap only when crowded.** Cards keep their normal spacing until the row would overflow, then
overlap by exactly enough (negative margin / reduced per-card advance) to fit every card on **one**
row. Few cards look unchanged; a full hand compresses. Not an always-on fanned arc.

## Acceptance criteria

- [ ] **Never a second row.** The hand stays a single row at any card count (test with a large hand
      — e.g. 8–10 cards). `flex-wrap: wrap` is removed / overridden.
- [ ] **Overlap kicks in only when needed.** With few cards (they fit at normal spacing) the layout
      is visually unchanged from today. Beyond the fit threshold, per-card horizontal advance shrinks
      so all cards fit the available hand width; the more cards, the more overlap.
- [ ] **Hover reveals the card.** Hovering a card lifts it above its neighbors (higher `z-index` +
      the existing lift) and pushes the cards on **either side** apart so the hovered card's full
      name and description are unobscured — the StS reveal. Returning the mouse restores the packed
      layout.
- [ ] **Left-to-right stacking order** is stable (later cards overlap earlier ones, or vice-versa)
      so hover math is predictable; the hovered card always wins z-order.
- [ ] Works with the existing deal-in animation (`card-in`, `styles.css:556-561`) and does not
      reintroduce per-card size changes (relies on #92's fixed size).
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean; focused `jj` commit. Update any render
      test that asserts the old `flex-wrap`/gap hand layout.

## Implementation notes (anchors)

- **Hand container:** `styles.css:527` `.hand { display:flex; gap:12px; flex-wrap:wrap; min-height:158px }`
  — drop `flex-wrap`; replace static `gap` with a computed per-card overlap. `.hand-area` at
  `styles.css:525` is the draw-pile | reserve | hand | discard row (keep).
- **Fan variables already passed:** `Hand.tsx:82` sets `style={{ '--i': i, '--n': game.hand.length }}`
  per card, and cards are uid-keyed (`Hand.tsx:70`) so only new cards deal-in. `--n` (hand size) is
  the hook for computing overlap purely in CSS (e.g. via `calc` against a max-advance), or compute a
  per-card `margin-left` in `Hand.tsx` from `--i`/`--n` and the container width.
- **Existing fan/hover geometry to adapt:** `styles.css:544-576` — `.hand .card` transform
  (`--o` offset, tilt, `translateY`), hover lift at `:562-570` (already nudges neighbors via `--part`
  on `+ .card` siblings), selected/dragging states at `:576/:582-583`. Extend the neighbor-nudge so
  it opens a readable gap around the hovered card; add explicit `z-index` on `:hover`.
- **Threshold math:** overlap = 0 while `n × (cardWidth + gap) ≤ handWidth`; otherwise distribute so
  `n` cards span `handWidth` (negative margin). A CSS-only `calc` on `--n` with `clamp()` is
  sufficient; measuring container width in JS is acceptable if CSS can't express it cleanly.
- Drag-to-Reserve/drag-to-play must still work — the drag source is the card element (`:582-583`);
  overlap only changes horizontal placement, not the drag wiring.

## Tests

- Layout/CSS-heavy; covered by existing render tests. Add a component/render assertion if the
  single-row invariant is expressible (e.g. hand renders `n` cards with no wrap wrapper). Visual fit
  is maintainer-verified per `CLAUDE.md`.

## Out of scope

- Always-on fanned arc regardless of count (rejected — overlap only when crowded).
- Per-card size changes / text fit — owned by #92.
- Draw/discard fly-to-pile animation and draw timing — that is #94 (this issue is static layout +
  hover only).
- Reserve zone layout (`.hand-area` order) beyond keeping it intact.
