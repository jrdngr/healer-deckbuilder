# Issue 46 — "Continue saved run" button doesn't work

- **Phase:** fix (bug)   **Size:** S
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "Continue saved run button doesn't work"

## Why

The Start screen's **Continue** button is present when a save exists but does not resume the run.
A returning player loses their in-progress run — a serious regression. Reproduce first, then fix
the root cause (don't just paper over the symptom).

## Acceptance criteria

- [ ] Reproduce the failure and identify the actual cause (add a regression test that fails
      before the fix).
- [ ] Clicking **Continue** on a valid in-progress save restores the run to its saved position
      (map/fight/screen, roster, deck, relics, gold, seed) and resumes play.
- [ ] A save from an older `RUN_SAVE_VERSION` fails **gracefully** (button hidden or a clear
      "save from an older version" message) instead of a silent no-op or a throw.
- [ ] A corrupt/partial snapshot does not crash the app — `continueRun()` handles a throwing
      `Run.fromJSON`.
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- `src/useRun.ts:15` `SAVE_KEY`, `:17-25` `loadSnapshot()` (**strict `snap.version === RUN_SAVE_VERSION`
  gate** — any older save silently yields `null`), `:27-34` `saveRun()`, `:59-64` mount refs
  (`hasSaveRef`/`savedFightRef` computed **once**), `:90-96` `continueRun()` (`Run.fromJSON` here
  is **not** wrapped in try/catch, unlike `loadSnapshot`).
- `src/run.ts:198-223` `Run.fromJSON` — note the `nodeContent` re-link at `:218-220` and the
  roster/deployment defaults at `:204-205`; a malformed snapshot most likely throws here.
- `src/components/StartScreen.tsx:26-39` Continue button (gated on `hasSave`).
- `src/App.tsx:40,46,57-62` `onContinue` (guards on `s != null`, so a null/throw reads as a no-op).

**Prime suspects to check in order:** (1) does `loadSnapshot()` return non-null for a fresh save
written this session? (2) is `continueRun()`'s returned seed being applied, or is the render still
showing the Start screen because `hasSaveRef` went stale? (3) does `Run.fromJSON` throw on the
current save shape (nodeContent re-link / deployment)?

## Tests

- `test/run.test.ts`: round-trip a live run through `toJSON`/`fromJSON` and assert the resumed
  run matches (position + roster + deck + gold + seed). Add a case for a version-mismatched and a
  truncated snapshot (graceful failure, no throw).

## Out of scope

- Migrating old-version saves forward — a clean "too old" rejection is acceptable.
