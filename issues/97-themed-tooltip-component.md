# Issue 97 — Themed tooltip component (replace native `title=`, 250ms delay)

- **Status:** 📋 Open
- **Phase:** ui
- **Depends:** —
- **Addresses:** intake 2026-07-17 — "Tooltip revamp: use custom themed UI for tooltips instead of native; change tooltip delay before appearing to be 250ms"

## Why

Every tooltip in the app today is a native browser `title=` attribute (grep `title=` in
`src/components/` — ~30 call sites: relic badges, enemy intent, poison/enrage readouts,
draw/discard piles, card upgrades, the Reserve upkeep readout, the Hex banner, the siphon
pill, and more). Native tooltips are visually off-brand (OS-styled, uncontrollable),
appear on the browser's own (long, ~1s) delay, can't be styled, and can't carry rich
content like a colored keyword swatch. Issue #98 (status-effect keyword tooltips) needs a
themed tooltip surface it can render structured content into — this issue builds that
surface and cuts the whole app over to it, so #98 has one component to hang keyword glosses
on.

The maintainer also wants the reveal delay shortened to **250ms** (native is much slower).

## Approach (maintainer decision, intake 2026-07-17)

- Ship a **reusable themed tooltip component** and replace **all** native `title=` usage in
  `src/components/` with it. Do not leave a mix of native and themed tooltips.
- **Interaction: hover + keyboard focus** (a11y parity with the native `title` it replaces):
  - Opens on mouse hover after a **250ms** delay.
  - Opens on keyboard **focus** immediately (no delay) when the anchor is focusable.
  - Closes on mouse leave / blur, and on **Escape**.
  - Anchored to its trigger element (not cursor-following).
- This is the **infrastructure** issue. It does not change any tooltip *text* and does not
  add keyword highlighting — that is #98. After this lands, every current `title` string
  shows in the themed tooltip verbatim.

## Acceptance criteria

- [ ] A reusable tooltip primitive exists (e.g. `src/components/Tooltip.tsx`) that wraps or
      anchors to a trigger and renders arbitrary React content in a themed popover.
- [ ] Hover opens after **250ms**; a quick hover-through that leaves before 250ms never
      shows the tooltip (timer cleared on leave).
- [ ] Keyboard focus on a focusable trigger opens the tooltip with **no** delay; blur closes
      it; **Escape** closes it while open.
- [ ] The tooltip is themed to match the app (dark panel, app font, readable contrast) —
      not the OS default. Styles live in `styles.css` (class-based), per repo convention.
- [ ] **Every** native `title=` in `src/components/` is replaced by the themed tooltip (grep
      `title=` returns no product-tooltip usages afterward; `title` on non-tooltip elements
      like `<title>` in SVG icons is out of scope). Text content is preserved verbatim.
- [ ] Multi-line tooltips still work: the card-upgrades tooltip currently joins with `\n`
      (`Card.tsx:125`) — it must render as separate lines in the themed popover.
- [ ] The tooltip does not clip at viewport edges (it should flip/shift to stay on-screen)
      and does not break the battle screen's drag-and-drop or click targeting.
- [ ] The engine stays pure/DOM-free (this is UI-only; no `src/engine/**` changes).
- [ ] `npm test` green, `npm run typecheck` clean.

## Implementation notes (anchors)

- **Call sites to convert** (starting map — verify by grepping `title=` in `src/components/`):
  `Actions.tsx:27`, `DraftScreen.tsx:15`, `RunOverScreen.tsx:27`, `EnemyPanel.tsx:34,36,46,48,49,52`,
  `Topbar.tsx:32,42,49`, `Card.tsx:114,119,125`, `DeployScreen.tsx:124`, `HealerBoonScreen.tsx:23`,
  `Hand.tsx:55,87`, `BattleScreen.tsx:365`, `Party.tsx:22`, `ManaBar.tsx:22`, `ScreenChrome.tsx:5`,
  and any others the grep surfaces. Some triggers are `<button>`/`<span>`; the component must
  work anchored to either.
- **No portal library is available** and the CSP/dep story is minimal — implement with plain
  React state + a positioned element (absolute/fixed) measured against the trigger's
  `getBoundingClientRect()`. Follow-the-existing-code: no new runtime dependencies unless the
  maintainer approves one.
- Keep the API small: something like `<Tooltip content={...}><button …/></Tooltip>` or a
  render-prop/hook that yields the props to spread onto the trigger. Pick whichever composes
  cleanly with the existing call sites (several triggers already have their own `onClick`,
  `className`, `aria-*` — don't clobber them).
- The 250ms delay is a constant; put it somewhere obvious (module const), not scattered.
- Focus handling: only attach the focus-open path when the trigger is genuinely focusable
  (button, `tabIndex >= 0`). Don't add `tabIndex` to elements that shouldn't take focus.

## Tests

- Tooltip logic that can be pure should be extracted and unit-tested in a sibling test file
  (e.g. delay-timer gating, viewport-flip math if factored out). Add to `test/engine.test.ts`
  or a new `test/tooltip.test.ts` run the same way (`tsx`).
- Interaction/visual behavior (hover reveal, focus reveal, Escape) is **maintainer-verified
  manually** per `CLAUDE.md` — do NOT drive a browser. Assert the extractable pure pieces and
  leave the visual confirmation to the maintainer.
- Known-brittle: don't assert on exact pixel positions; assert on the decision (which side it
  flips to, whether it's shown) not on computed coordinates.

## Out of scope

- **Keyword highlighting / status-effect glosses / parenthetical removal** — that is #98,
  which depends on this. This issue changes zero tooltip *text*.
- Touch/long-press tooltip behavior — not requested; the game is mouse/keyboard.
- Reworking tooltip *content* wording anywhere. Preserve every current string verbatim.
- Animation polish beyond a basic fade is optional; don't gold-plate.
