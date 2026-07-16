# Issue 88 — Warn on undeployed party members + strip gold from the Fight button

- **Status:** 📋 Open
- **Phase:** post-demo (UI polish)   **Size:** S
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-16 — "warning when the player has party members that aren't deployed"

## Why

On the Deploy screen it is easy to walk into a fight having forgotten to seat a recruited hero —
the empty seat reads as intentional, and nothing calls it out. Fielding fewer is a *real* strategy
(`EMPTY_SEAT_GOLD_BONUS` pays a bounty premium per empty seat, #42), so this is a **warning, not a
gate**: it must be loud enough to catch the mistake and cheap enough to ignore on purpose.

Separately, the Fight button currently doubles as a gold readout —
`Fight with 3 · +14g` (`DeployScreen.tsx:79`) — duplicating the `deploy-salary-line` directly above
it (`:74`), which already spells out bounty − wages = net. The button should just say **Fight**.

## Acceptance criteria

- [ ] **Warning fires on any benched member with a free seat.** Red warning text renders **above the
      three deploy slots** when at least one roster member is not deployed *and* at least one slot is
      empty. Truth table:
      - roster 3, deployed 2 → ⚠ warning
      - roster 3, deployed 3 → no warning
      - roster 2, deployed 2 → no warning (nobody is benched)
      - roster 1, deployed 0 → ⚠ warning (and Fight stays disabled — see below)
- [ ] **Fight button turns red** under the same condition, reusing the existing `danger` button class
      (`styles.css:470`) rather than a new one-off color.
- [ ] **Warning is non-blocking.** The red Fight button starts the fight on the **first click** — no
      confirm dialog, no second click, no dismiss affordance. The existing `seatedCount === 0`
      disable stays exactly as it is (that one *is* a hard gate, and its
      `Deploy at least one` label is unchanged).
- [ ] **Fight button says only `Fight`.** No gold, no seat count. The `+${projectedNet}g` and
      `Fight with ${seatedCount}` text is gone from the button label.
- [ ] The `deploy-salary-line` above the button is **unchanged** — it remains the place gold is
      communicated.
- [ ] Typecheck/build clean; `npm test` green (update any component test asserting the old button
      label).

## Implementation notes (anchors)

- `src/components/DeployScreen.tsx:79` — the button label ternary. Keep
  `seatedCount === 0 ? 'Deploy at least one' : 'Fight'`; drop `projectedNet` from the label only.
  `projectedNet` is still needed at `:67`/`:74` for the salary line — do not delete the computation.
- `src/components/DeployScreen.tsx:80` — `className="primary map-take"`; add `danger` (or swap) when
  the warning is active.
- `src/components/DeployScreen.tsx:60` — `seatedCount`. The warning condition needs a benched count:
  roster entries with a `member` that are absent from `deploy`. `run.roster` is the roster source;
  `deploy` is the seat array (`null` = empty).
- Warning element goes between the `</header>` (`:83`) and `<div className="deploy-slots">` (`:85`).
- New CSS class next to the deploy styles; `--danger`/`.danger` color tokens already exist in
  `styles.css`.

## Tests

- `test/components.test.tsx` — render DeployScreen and assert: (a) warning text present with a
  benched member + free seat, absent when roster is fully deployed and when roster ≤ seats;
  (b) the Fight button carries the danger class exactly when the warning shows;
  (c) the button label is `Fight` and contains no `g`/gold substring.
- Per [[naming-pass-2026-07-13]], **do not** assert on log substrings — assert on rendered text and
  class names.

## Out of scope

- Blocking the fight, confirm dialogs, or a dismiss/remember-my-choice affordance (explicitly
  rejected: warning only, one click).
- Rebalancing `EMPTY_SEAT_GOLD_BONUS` or the field-fewer economy (that is issue 90's territory).
- Any change to the `deploy-salary-line` wording or the `seatedCount === 0` disable behavior.
