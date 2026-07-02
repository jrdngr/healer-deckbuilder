# Issue 15 — Card set phase A: existing-field cards (P7a)

- **Roadmap phase:** P7 (a)   **Size:** M
- **Depends on:** #14   **Blocks:** #16
- **Addresses:** review §3.2; part of the card set that supersedes the roadmap M6a placeholders

## Why
Deepen the healer fantasy and open archetypes beyond the taunt line. Phase A ships the five cards
that need **no new engine state** — just new definitions and the engine-card tag wiring — so the
riskier cards build on a proven base.

Anchors (from §3.2): instant single-target heal ≤ ~1.3–1.5 HP/MP; instant AoE ≤ 2.0; anything
above must be delayed/conditional/combo; nothing beats poison's 12.5 dmg/MP; Refresh's net +3 is
the common ceiling, +5/+6 the rare ceiling.

## Scope / acceptance criteria
- [ ] **Overgrowth** — 3 MP, all, uncommon 50g. Regen 1 for 3 turns to every living member
      (no stack, refresh-duration/keep-stronger). **Potent-ineligible.**
- [ ] **Cultivate** — 1 MP, single with active Regen, common 25g. +1 Regen strength & +1 duration,
      modifying **in place** (never overwrite; never forfeits Lifebloom's burst). Dead without a
      live Regen.
- [ ] **Bloom** — 2 MP, single with active Regen, uncommon 50g. **Consume** the Regen: heal 2 per
      remaining turn. (Finisher; on Lifebloom it triggers the burst — see #16.)
- [ ] **Font of Mana** — 3 MP, none, rare 75g. Refresh 3 for 3 enemy turns (net +6), same status
      slot as Refresh (no stack, keep-stronger). **Engine-tagged.**
- [ ] **Inspiration** — 2 MP, none, uncommon 50g. Draw 2. **Engine-tagged** (Efficient/Retain/Taper
      excluded).
- [ ] All join `CARD_POOL` with 60/30/10 weights.

## Implementation notes
- `src/constants.ts` card definitions + the engine-card tag from #03. Regen already exists in the
  engine (starting deck), so Overgrowth/Cultivate/Bloom reuse it.
- Keep Font of Mana in the same Refresh status slot; "keep-stronger" resolution.

## Tests (required per CLAUDE.md)
- Each card's numbers; Cultivate is dead without Regen and modifies in place; Bloom consumes and
  heals per remaining turn; Font shares the Refresh slot; Inspiration is engine-tagged.

## Out of scope / follow-ups
- Lifebloom, Surge, Battle Hymn, Barrier, and the Blood cards are #16; Bulwark Defense rework is #17.
