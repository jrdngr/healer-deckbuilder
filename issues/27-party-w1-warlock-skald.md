# Issue 27 — Party W1: Hexen Warlock + Skald + draft skeleton

- **Roadmap phase:** post-demo (party wave 1)   **Size:** M
- **Depends on:** #08 (member-identity refactor)   **Blocks:** #28
- **Addresses:** review §3.4 (roster wave 1)

## Why
First post-demo wave: two members that change **how you heal**, behind a minimal draft entry point.
The Warlock converts the MP bottleneck into an HP bottleneck; the Skald attacks Rest timing. Both
are the cheapest new-decision members to build.

## Scope / acceptance criteria
- [x] **Hexen Warlock** — 15 HP, **7 dmg** (highest in game). *Soul Tithe:* −2 HP at end of each
      party phase, after his strike (can kill him). *Dark Bargain* (2 MP, fired via the Ability card):
      he loses **3 + 3×(prior casts this fight)** HP; healer gains **+3 MP** (lethal — overcasting
      burns him out). Constants in `constants.ts`: `TITHE_AMOUNT 2, BARGAIN_HP_BASE 3,
      BARGAIN_HP_GROWTH 3, BARGAIN_MP 3`.
- [x] **Skald** — 10 HP, 0 base; strikes for **`SKALD_DMG_PER_CARD 2` × cards played this player
      phase, cap `SKALD_DMG_CAP 8`** (folded into `memberDamage`). *Crescendo* (2 MP): draw
      `CRESCENDO_DRAW 2` (the Ability card that fires it already counts as the 1 card played).
      `isEngineAbility('crescendo')` / `('darkBargain')` tag them as economy effects.
- [x] **Draft skeleton:** a `draft` `RunLocation` + `NodeContent` + `beginDraft`/`chooseDraft` on
      `Run`, and a minimal `DraftScreen` reached via a "Draft your party" button on the start screen.
      Save format bumped to v6 (drafted `member` identity + draft location round-trip).
- [x] Per-wave sim policy: `tryDarkBargain` (bargain only when MP-starved and the Warlock keeps a
      safety cushion) + `tryCrescendo`; `tryBolt`/`tryPoison` now find their member by ability (not
      slot) so any drafted composition is pilotable. A turn guard backstops the tactic loop.

## Implementation notes
- Members as data via #08's `MEMBER_POOL`. New `RunLocation` in `src/run.ts` +
  `src/components/` pick screen. Crescendo joins the engine-card tag (#03).

## Tests (required per CLAUDE.md)
- [x] `test/engine.test.ts`: drafted identity is seated per slot; Dark Bargain cost grows per cast
      and grants +3 MP; Dark Bargain can burn out the Warlock (and marks a DR1 death); Soul Tithe
      drains each party phase and can kill; Skald damage = 2×cards (cap 8); Crescendo draws 2, counts
      as a card, and `isEngineAbility` tags Crescendo/Dark-Bargain (not Poison).
- [x] `test/run.test.ts`: `beginDraft`/`chooseDraft` seat a party and open fight 0; malformed picks
      are refused; the classic-trio path works; drafted identity survives save/resume (v6).
- [x] `test/sim.test.ts`: the policy resolves a drafted Warlock/Skald fight (no stall) and wins
      ordinary fights; Soul Tithe chips but doesn't insta-kill the Warlock on turn 1. Trio pins stay
      bit-identical.

## Out of scope / follow-ups
- Berserker + Grave Augur are #28; pet subsystem (Beast Warden) is #29.
