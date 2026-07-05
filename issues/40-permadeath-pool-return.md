# Issue 40 — Permadeath returns the member to the pool as a fresh copy (scar laundering)

- **Roadmap phase:** post-campaign correctness   **Size:** S
- **Depends on:** the 2026-07 permanent-injury rework   **Blocks:** any reading of permadeath as a real cost
- **Addresses:** playtest 2026-07-05 — edge-case probe finding

## Why

`Run.availableMembers()` computes the draft/recruit pool as `DRAFT_POOL` minus the *current*
roster. A member removed by the 4th-death rule is not in the roster — so the "permanently" killed
hero is immediately re-offerable by the next post-boss draft or Recruit node, **at full base stats
and zero scars** (verified by direct probe: kill a 3-scar Warlock's 4th death → `availableMembers()`
includes `'warlock'` again).

Consequences:

- **"Injuries are permanent" is undermined.** The one cost the rework made irreversible (the db29a92
  commit retired the Infirmary *because* scars should stick) has a full reset button: a 3-scar member
  who dies a 4th time comes back scar-free. Only their stat `upgrades` are truly lost.
- **The incentive inverts at 3 scars.** A Broken (3-scar) member fights at −2 HP/−1 dmg/−1 ability
  and you *want* the 4th death: the replacement copy is strictly better than the scarred original.
  The deploy screen even prices the scarred one cheaper (−3g/scar), sweetening the ride to the cliff.
- The permadeath drama ("the 4th death removes the member") reads as a bluff once a player notices
  the same hero back in the next offer.

## Acceptance criteria

- [ ] Track permanently-dead member ids on the Run (a `graveyard: MemberId[]` field, save-version
      bump) and exclude them in `availableMembers()`.
- [ ] Decide the flavor edge (maintainer call): with a graveyard, a long unlucky run shrinks the
      8-member pool — acceptable (the roster never empties in practice: 0 wipes in 9000 playtest
      runs, and the pool outnumbers the 4-per-run acquisition rate) — **or** lean in the other
      direction and make re-hiring explicit: the dead member may return **keeping their scars**
      (the "same hero, worse for wear" reading) or at a gold price. Pick one; the silent fresh copy
      is the only wrong answer.
- [ ] `recordInjuries` populates the graveyard at the same splice; `fromJSON` defaults it to `[]`
      for older saves (which are discarded by version anyway).

## Tests

- run.test.ts: 4th death → member absent from `availableMembers()`, from subsequent draft offers,
  and from Recruit-node rolls; save/load round-trips the graveyard; a full-pool graveyard hides the
  Recruit node (`nodeAvailable` already keys on `availableMembers()`).

## Out of scope

- The Warlock-specific magnitude (issue 39) — this issue is the system rule, not who triggers it.
- Wipe-loss reachability / permadeath teeth (issue 42's design discussion).
