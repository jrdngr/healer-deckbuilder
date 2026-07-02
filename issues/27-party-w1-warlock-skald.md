# Issue 27 — Party W1: Hexen Warlock + Skald + draft skeleton

- **Roadmap phase:** post-demo (party wave 1)   **Size:** M
- **Depends on:** #08 (member-identity refactor)   **Blocks:** #28
- **Addresses:** review §3.4 (roster wave 1)

## Why
First post-demo wave: two members that change **how you heal**, behind a minimal draft entry point.
The Warlock converts the MP bottleneck into an HP bottleneck; the Skald attacks Rest timing. Both
are the cheapest new-decision members to build.

## Scope / acceptance criteria
- [ ] **Hexen Warlock** — 15 HP, **7 dmg** (highest in game). *Soul Tithe:* −2 HP at end of each
      party phase, after his strike (can kill him). *Dark Bargain* (2 MP): he loses **3 + 3×(prior
      casts this fight)** HP; healer gains **+3 MP**. Constants: `TITHE_AMOUNT 2, BARGAIN_HP_BASE 3,
      BARGAIN_HP_GROWTH 3, BARGAIN_MP 3`.
- [ ] **Skald** — 10 HP, 0 base; strikes for **2 × cards played this player phase, cap 8**.
      *Crescendo* (2 MP): draw 2 (counts as 1 card played). Crescendo is **engine-tagged**.
- [ ] **Draft skeleton:** a new `draft` `RunLocation` + minimal pick screen (can be crude this wave).
- [ ] Per-wave sim policy handles the Warlock's burn-out timing and Skald's rest-timing tension.

## Implementation notes
- Members as data via #08's `MEMBER_POOL`. New `RunLocation` in `src/run.ts` +
  `src/components/` pick screen. Crescendo joins the engine-card tag (#03).

## Tests (required per CLAUDE.md)
- Soul Tithe can kill the Warlock; Dark Bargain HP cost grows per cast and grants +3 MP; Skald
  damage = 2×cards (cap 8); Crescendo counts as a card and is engine-tagged.

## Out of scope / follow-ups
- Berserker + Grave Augur are #28; pet subsystem (Beast Warden) is #29.
