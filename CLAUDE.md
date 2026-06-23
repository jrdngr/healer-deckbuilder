# CLAUDE.md

Guidance for agents working in this repo. Healer Deckbuilder is a zero-dependency,
no-build prototype of a single battle loop: plain HTML/CSS + vanilla ES-module JS.

## Source control — use `jj`, never `git`

- Use Jujutsu (`jj`) for all version control. **Do not invoke `git` directly.**
- Commit every logical feature as its own commit: `jj commit -m "<msg>"`.
- **All work must end in a commit** — never leave changes uncommitted at the end of a task.
- Work spanning multiple phases or features must be split into multiple commits, one per
  logical unit, not squashed into a single catch-all commit.

## Tests are required

- Add tests for **every new feature** in `test/engine.test.js` (or a sibling test file).
  Run them with `node test/engine.test.js` (or `npm test`). They must pass before you commit.
- Design code to be testable: keep game logic pure and DOM-free (see `src/engine.js`), so
  mechanics can be unit-tested directly without a browser. Put new logic in the engine, not
  the UI, whenever it can be tested in isolation.

## Do not touch the design doc

- `docs/healer-deckbuilder-spec.md` is a **historical artifact**. Do not reference it as a
  source of truth and do not modify it. Treat the code as the source of truth.

## Project orientation

- **Run:** `just run` (serves and opens the browser), or `node server.js` / `npm run serve`,
  then open http://localhost:8080. ES modules must be served over HTTP, not opened as `file://`.
- **Test:** `node test/engine.test.js` or `npm test`.
- **No build step, no dependencies.** Don't add a bundler or npm packages unless asked.
- **Layout:**
  - `src/engine.js` — pure battle engine (no DOM), the source of truth for mechanics.
  - `src/constants.js` — all tunable numbers; change balance values here.
  - `src/rng.js` — seedable PRNG + shuffle/weighted-pick (keeps games deterministic by seed).
  - `src/ui.js` — browser controller: renders state, handles input. DOM lives here only.
  - `server.js` — tiny zero-dep static file server.
  - `test/engine.test.js` — the test/scenario harness.
