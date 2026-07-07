# Issue 24 — Hardening & UX batch (P11)

- **Status:** ✅ Complete
- **Roadmap phase:** P11   **Size:** M
- **Depends on:** #23 (near-final)   **Blocks:** none (final ship gate)
- **Addresses:** flaws #15, #16, #20 (tooltips), #21; review §4 P11

## Why
The information and polish gaps that make the game hard to play well: no deck knowledge, blind map
forks, no status tooltips, unspent gold invisible. Batch them as the final hardening pass.

## Scope / acceptance criteria
- [ ] **Status tooltips** (flaw #20 follow-up): Shield / Defense / Regen / Taunt / Ward etc.
- [ ] **Modifier effect text** on cards (what Potent/Efficient/Lingering do, live numbers).
- [ ] **In-fight deck viewer** (flaw #16): draw pile / discard counts and contents.
- [ ] **Fork previews** (flaw #15): one concrete detail per node — enemy name + a threat pip.
- [ ] **Run stats + unspent-gold scoring** (flaw #21): summary screen; score penalizes hoarded gold.
- [ ] **DevPanel** gated behind `import.meta.env.DEV`.
- [ ] Stale-copy sweep.
- [ ] **Ship gate:** full suite green + Story/Standard sim sweep + clean `npm run build`.
      **➤ Human playtest #3 (maintainer, manual — final gate).**

## Implementation notes
- UI-heavy: `src/components/` (MemberCard, Card, Hand, EnemyPanel, NodeScreen/MapScreen,
  RunOverScreen, DevPanel, Topbar). Deck viewer reads engine draw/discard state.
- Per CLAUDE.md, leave visual confirmation to the maintainer — don't drive a browser.

## Tests (required per CLAUDE.md)
- Deck-viewer counts match engine state; unspent-gold scoring math; fork-preview data is populated.

## Out of scope / follow-ups
- The hand-4 carryover experiment is its own issue (#25); it interacts with any deck-viewer work.
