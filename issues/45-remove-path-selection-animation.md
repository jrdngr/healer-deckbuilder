# Issue 45 — Remove the path-selection travel animation

- **Phase:** fix (quick, isolated)   **Size:** XS
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-06 — "path selection animation makes it look like the player is skipping both nodes"

## Why

After the player picks a branch and hits "Take this path", the map token animates down the
chosen trail, sweeping past the two node markers straight to the next fight. It reads as though
the player *skips* both nodes rather than travelling through the one they chose. The animation
adds nothing and misleads — remove it entirely and advance immediately.

## Acceptance criteria

- [ ] Picking a path advances the run with **no travel animation** — no token sweep, no delay.
- [ ] The other (unchosen) branch no longer fades/dims as part of a leaving state.
- [ ] No leftover `leaving` / `travel-*` state or dead CSS keyframes remain.
- [ ] Tests still pass; typecheck/build clean.

## Implementation notes (anchors)

- `src/components/MapScreen.tsx:15` `LEAVE_MS = 780`, `:53-59` `take(b)` (sets `leaving` +
  `setTimeout(() => onChoose(b), …)`), `:61-65` `canvasCls` (`leaving` / `chosen-${leaving}`),
  `:86` the `map-token …travel-${leaving}` element, `:88` branch `chosen` class. Collapse
  `take(b)` to call `onChoose(b)` immediately and drop the `leaving` state entirely.
- `styles.css:751-770` (`.map-token.travel-0/1` + `@keyframes token-travel-0/1`), `:747`
  (`.map-canvas.leaving .map-branch-group:not(.chosen)` fade), and the reduced-motion override
  at `:696` — remove the now-dead rules.

## Tests

- No engine logic changes; this is UI-only. Confirm the map→fight transition still routes
  correctly (existing run/map tests) and add nothing new unless a helper is extracted.

## Out of scope

- Any other map visuals (node icons, hover states) — leave them.
