# Issue 77 — No blank map nodes (resolve availability when the fork is reached)

- **Status:** 📋 Open
- **Phase:** map/run   **Size:** S
- **Depends on:** none   **Blocks:** none
- **Addresses:** intake 2026-07-10 — "With seed 216002962, I got a blank node after the first
  fight. I should never get blank nodes."

## Why

A fork's branches are meant to show two typed stops each. But **unavailable** node types are
*hidden* on the map preview and in the branch hub, while they are only *rerolled into a usable
type* **after** the player commits to a branch. So the preview under-shows the branch: a slot the
player expects to hold a stop simply renders empty.

**Reproduced (seed 216002962, real run to the fork after fight 1):**

- After the first fight the roster is a single drafted member (ranger, 11/11 HP, no injuries).
- Fork 0, branch 0 rolled `[cardShop, infirmary]`. The **Infirmary is hidden because nobody is
  hurt** (`nodeAvailable('infirmary')` is false), so that branch shows only **one** node on the
  map — an empty second slot.
- A branch that rolls two currently-unavailable types (e.g. `[infirmary, recruit]` on a healthy,
  full roster) would show **zero** stops — a fully blank branch.

The maintainer's fix decision (intake 2026-07-10): **reroll at map-reach time** so every displayed
slot is always a real, enterable stop and the preview matches the hub.

## Root cause (anchors)

- **Hidden on preview, not rerolled:** `MapScreen.tsx:75`
  (`branch.nodes.filter((node) => run.nodeAvailable(node.type))`) and `BranchScreen.tsx:41`
  (`if (!run.nodeAvailable(node.type)) return null;`) both *drop* unavailable nodes.
- **Rerolled only after the branch is chosen:** `_resolveBranchAvailability` (`src/run.ts:779`) is
  called from `chooseBranch` (`src/run.ts:766`) — i.e. *after* the map preview has already been
  shown, and only for the branch that was picked.
- **`nodeAvailable`** (`src/run.ts:793`): `recruit` hides when the roster is full; `infirmary`
  hides when nobody is hurt or injured. Both are **state-dependent** and can flip during a run.

## The fix

Resolve availability for **every branch of a fork at the moment the fork is reached** (before the
map is shown), by rerolling unavailable node types into available ones — exactly what
`_resolveBranchAvailability` already does, but applied to all branches, up front, once.

- **Where "reached" is:** the two entry points that set `location = { kind: 'forkChoice', … }` —
  `_leaveCardReward` (`src/run.ts:666`, normal fights) and `_leaveSpoils` (`src/run.ts:688`, act
  bosses). Add a single `_enterForkChoice(fi)` helper that both call: it sets the location **and**
  resolves availability for all `BRANCHES_PER_FORK` branches of `map[fi]`.
- **Availability is time-dependent — do NOT resolve at run construction.** Rerolling in
  `_generateMap`/the constructor would evaluate availability against the *start-of-run* state
  (classic trio, full HP), which is wrong by the time the fork is reached. Resolution must run when
  the fork is entered, against the live roster/HP/injury state.
- **Keep the resolution idempotent.** `_resolveBranchAvailability` already `continue`s on
  already-available nodes (consuming no rng), so the existing `chooseBranch` call becomes a no-op
  after the up-front pass — leave it in as a safety net or drop it; either is fine as long as
  behavior is unchanged.
- **The reroll writes into `this.map`** (as it does today), so the resolved types are stable for
  the visit and survive save/resume once the fork has been entered.
- **Recruiter cadence stays structural.** Fork 0 (and each boss fork) still *guarantees* a Recruit
  node at generation (`_generateMap`, `src/run.ts:406-420`); if the roster is full when the fork is
  reached, that Recruit is unavailable and gets rerolled — the intended "hidden when full" behavior,
  now reflected on the map instead of leaving a gap.

### Decision for the implementer (flag, don't block)

- **Save compatibility:** the map is serialized (`RunSnapshot.map`). A save created *before* this
  fix that is sitting *at* a `forkChoice` already holds unresolved (hidden) nodes and is past the
  new resolution point. Recommended default: **bump `RUN_SAVE_VERSION`** (`src/run.ts:102`, add a
  v15 note) so stale mid-fork saves are discarded rather than resumed with a blank slot — consistent
  with how this repo already handles shape/behavior changes. (Alternative: resolve on load when the
  restored location is a `forkChoice`; the version bump is simpler and preferred.)
- Resolving all branches at fork-entry consumes rng where today only the chosen branch did, so
  **seeds shift** from this point. That is expected for the fix; no gate depends on pre-fix map rng.

## Acceptance criteria

- [ ] On the fork map (`MapScreen`) and in the branch hub (`BranchScreen`), **every branch always
      shows `NODES_PER_BRANCH` real, enterable stops** — no empty slot, no zero-stop branch — for
      any roster/HP/injury state, including the reproduced seed 216002962 after fight 1.
- [ ] Unavailable node types (Infirmary when healthy, Recruit when the roster is full) are **rerolled
      into available types when the fork is reached**, not hidden and not deferred to `chooseBranch`.
- [ ] The map preview **matches** what the hub shows: the node types visible on the preview are the
      same ones enterable in the hub (no "1 node on the map, 2 in the hub" mismatch).
- [ ] Resolution runs against the **live** roster/HP/injury state at fork-entry (not run-start), so a
      party that is hurt sees the Infirmary and a non-full roster sees the Recruit.
- [ ] Existing fork/branch behavior otherwise unchanged: distinct types within a branch, recruiter
      cadence guarantee intact, cached branch content (`branchContent`) still rolled on first entry.
- [ ] Save-version decision applied (recommended: `RUN_SAVE_VERSION` bumped with a note).
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean; lands as a focused `jj` commit.

## Implementation notes (anchors)

- **Reroll helper (reuse):** `_resolveBranchAvailability(forkIndex, branch)` — `src/run.ts:779`.
- **New fork-entry seam:** `_leaveCardReward` sets `forkChoice` at `src/run.ts:666`; `_leaveSpoils`
  at `src/run.ts:688`. Route both through a new `_enterForkChoice(fi)` that resolves all branches.
- **`chooseBranch`** — `src/run.ts:761` (existing per-branch resolve at `:766` becomes a no-op).
- **Availability rule:** `nodeAvailable` — `src/run.ts:793`; `anyoneNeedsInfirmary` — `src/run.ts:800`;
  `availableMembers` — `src/run.ts:272`.
- **Preview/hub filters (should never drop a node after the fix):** `MapScreen.tsx:75`,
  `BranchScreen.tsx:41`. They can stay as belt-and-suspenders, but must now never hide anything.
- **Save version:** `RUN_SAVE_VERSION` and the version log — `src/run.ts:81-102`.

## Tests (`test/engine.test.ts` or a sibling run test)

- **Repro seed:** `new Run(216002962)`, drive to the first `forkChoice` with the real flow (or set
  up the equivalent single-member, full-HP roster), then assert **both branches of fork 0 expose
  exactly `NODES_PER_BRANCH` available node types** — no branch reduces to fewer than two.
- **Worst case:** force a state where a branch rolled `[infirmary, recruit]` with a healthy, full
  roster; after fork-entry, assert neither slot is unavailable (both rerolled) and the branch shows
  two stops.
- **State-dependence:** a hurt/injured party keeps the Infirmary (not rerolled away); a non-full
  roster keeps the Recruit.
- **Idempotence:** entering the fork resolves once; `chooseBranch` on the resolved fork changes
  nothing (no further reroll, no extra rng draw beyond the entry pass).
- **Distinctness preserved:** rerolled branches contain no duplicate type within the branch.

## Out of scope

- Redesigning the fork layout, node weights (`NODE_TYPE_WEIGHTS`), or the recruiter/reliquary
  injection rules.
- Any visual restyle of the map beyond "no empty slot" (the maintainer verifies visuals per
  `CLAUDE.md`).
- Changing how `branchContent` is rolled/cached on first entry.
