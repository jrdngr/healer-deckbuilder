# Issue 80 — Small UI tweaks batch (button placement / topbar height / banner theme)

- **Status:** ✅ Complete
- **Phase:** post-demo (UI polish)   **Size:** S (batch of small fixes, all in one commit)
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-11 — "Small UI tweaks" (all sub-bullets in one issue)

## Why

Three unrelated small UI adjustments, batched:

1. The Rest / End Turn button is below the hand; it should sit **to the right of the MP bar**.
2. The top header bar is taller than it needs to be — **reduce its height by ~20%**.
3. The phase banners (`ENEMY PHASE`, `ENEMY DEFEATED`, …) render on a **dark near-black band** that
   predates the current light/parchment theme — re-skin so the banner background matches the theme.

## Acceptance criteria

- [ ] **Rest/End Turn beside the MP bar.** The primary turn button renders to the right of the mana
      bar rather than after the hand. It keeps its existing label logic — `Rest & End Turn (+N MP)`
      when a rest yields MP, plain `End Turn` otherwise (`Actions.tsx:29`).
- [ ] **Topbar ~20% shorter.** Reduce the `.topbar` vertical size by about 20% (e.g. padding
      `12px 20px` → ~`9px 20px`, adjusting the title/controls if needed) with **no clipping** of the
      run-status, gold, relic row, or the View Deck / Speed / Seed / New Run controls.
- [ ] **Banners match the theme.** Replace the dark `rgba(8, 10, 14, .82)` band in `.fx-banner`
      (`styles.css:886-887`) with a parchment/panel-based background (`--panel` / `--hud-bg` / `--ink`
      border) that reads on the light theme, keeping each banner's accent text legible. Audit **every**
      banner so all match: `ENEMY PHASE` (`animations.ts:474`), `ENRAGED` (`:481`), the Devourer
      phase-change beat (`:872`), `ENEMY DEFEATED` (`:897`), `THE PARTY FALLS` (`:909`).
- [ ] Typecheck/build clean; existing component/render tests pass (update any that assert the old
      Actions placement).

## Implementation notes (anchors)

- Layout: `src/components/BattleScreen.tsx:252` (`<ManaBar>`) and `:265` (`<Actions>`) — regroup so
  Actions sits in a row beside ManaBar (a flex wrapper), instead of after `<Hand>`. `Actions.tsx`
  owns the button and its label.
- Topbar: `styles.css:94` `.topbar` (the `padding`/`border-bottom`); `.topbar h1` at `:98`.
- Banner skin: `styles.css:882-888` `.fx-banner` (the `background`/`text-shadow`/`color`). Banner
  text/color params come from `animations.ts` (`C.enemy` / `C.danger` / `C.taunt`) — keep those as
  the accent, only change the band background.

## Tests

- Markup/CSS-heavy; covered by existing render tests. Add/adjust a component test if the ManaBar +
  Actions row placement is assertable.

## Out of scope

- Changing banner **text**, timing, or animation curve (only the background skin).
- Any other topbar content or the mana-bar internals.
