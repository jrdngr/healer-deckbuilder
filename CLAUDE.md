# CLAUDE.md

Guidance for agents working in this repo. Healer Deckbuilder is a prototype of a single
battle loop. The UI is **React + Vite + TypeScript**; the battle engine is a pure,
DOM-free TypeScript module that the UI and the tests both consume.

## Source control — use `jj`, never `git`

- Use Jujutsu (`jj`) for all version control. **Do not invoke `git` directly.**
- Commit every logical feature as its own commit: `jj commit -m "<msg>"`.
- **All work must end in a commit** — never leave changes uncommitted at the end of a task.
- Work spanning multiple phases or features must be split into multiple commits, one per
  logical unit, not squashed into a single catch-all commit.

## Tests are required

- Add tests for **every new feature** in `test/engine.test.ts` (or a sibling test file).
  Run them with `npm test` (which runs `tsx test/engine.test.ts`). They must pass before
  you commit.
- Design code to be testable: keep game logic pure and DOM-free (see `src/engine.ts`), so
  mechanics can be unit-tested directly without a browser. Put new logic in the engine, not
  the React components, whenever it can be tested in isolation.
- Run `npm run typecheck` (or `npm run build`, which type-checks then bundles) to catch
  type errors before committing.

## Visual verification — do not use the Chrome DevTools plugin

- Do **not** use the Chrome DevTools MCP plugin (or other browser-automation tooling) to
  verify UI changes unless you are told to do so. The maintainer verifies visual/UI changes manually.
- For UI work, make the change, ensure tests still pass, and leave visual confirmation to
  the maintainer rather than driving a browser yourself.

## Do not touch the design doc

- `docs/healer-deckbuilder-spec.md` is a **historical artifact**. Do not reference it as a
  source of truth and do not modify it. Treat the code as the source of truth.

## Project orientation

- **Stack:** React + Vite + TypeScript. There is no global state library — the engine is a
  plain class, and `src/useGame.ts` binds it to React (a ref holds the single instance; a
  tick reducer forces a re-render after each action).
- **Run:** `just run` (Vite dev server with HMR, opens the browser), or `npm run dev`, then
  open the printed URL (default http://localhost:5173).
- **Test:** `npm test`. **Type-check:** `npm run typecheck`. **Build:** `npm run build`.
- **Keep the engine pure and DOM-free** so it stays unit-testable: do not import React or
  touch the DOM from `src/engine.ts`, `src/constants.ts`, or `src/rng.ts`.
- **Layout:**
  - `src/engine.ts` — pure battle engine (no DOM), the source of truth for mechanics.
  - `src/constants.ts` — all tunable numbers and shared types; change balance values here.
  - `src/rng.ts` — seedable PRNG + shuffle/weighted-pick (keeps games deterministic by seed).
  - `src/useGame.ts` — React hook binding the engine to the UI.
  - `src/App.tsx`, `src/main.tsx` — app entry and the screen-routing seam.
  - `src/components/` — React components (BattleScreen, EnemyPanel, Party/MemberCard,
    Hand/Card, ManaBar, Actions, CombatLog, AttackLines, GameOverlay, Topbar). DOM lives
    here only.
  - `styles.css` — global, class-based styles; imported from `src/main.tsx`.
  - `index.html`, `vite.config.ts` — Vite HTML entry and config.
  - `test/engine.test.ts` — the test/scenario harness (runs via `tsx`).
