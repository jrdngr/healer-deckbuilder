# Issue 36 — Run-layer screens show classic-trio names for drafted parties (UI playtest 2026-07-04)

- **Roadmap phase:** post-demo (party track)   **Size:** S–M (one resolver + call-site sweep)
- **Depends on:** #27 (draft)   **Blocks:** shipping the draft as a visible feature
- **Addresses:** UI playtest 2026-07-04 (live-verified in Chrome)

## Why

Every run-layer screen resolves member names via `MEMBER_DEFS[slot].name` — the classic trio —
regardless of what was drafted. Live-verified with a drafted Mage/Skald/Grave-Augur party:

- **Training Hall** (`PartyUpgradeShopScreen.tsx:49`) offered "**Ranger** — HP 9 · DMG 5" (those
  are the *Mage's* stats), "**Tank** — HP 10 · DMG 0" (the Skald), "**Mage** — HP 10 · DMG 4"
  (the Augur). Buying "+1 Damage for the Tank" trains the Skald.
- **Dev panel** heal buttons (`DevPanel.tsx:14-16`) are hardcoded `Ranger/Tank/Mage`; clicking
  "Tank" healed the Skald (slot-based).
- Same pattern in **EventScreen** (mercenary `:78`, shrine `:128`, blood altar `:141`, medic
  `:148`, plus the three `MEMBER_DEFS.map` pickers at `:217/:248/:272`), **MapScreen** (injured
  list `:32`), and **InfirmaryScreen** (`:30`).

The in-fight screens are correct (the engine seats identity from `PartyMemberConfig.member`, fixed
in the balance round); this is purely the run-layer display path. Note the *stats* shown are the
real drafted stats — only the names/flavor lie, which makes it worse (it reads like a bug, not a
placeholder).

## Scope / acceptance criteria

- [ ] A single resolver — e.g. `memberDefAt(party, slot): MemberDef` in `src/constants.ts`
      (`MEMBER_POOL[p.member] ?? MEMBER_DEFS[slot]`) — and every run-layer screen reads names,
      abilities, and home-slot flavor through it: PartyUpgradeShopScreen, InfirmaryScreen,
      EventScreen (all four member-picking events), MapScreen's injured list, DeckPicker if it
      names members.
- [ ] DevPanel heal buttons label themselves from the live game's `members[slot].name` (they
      already act on the right slot — only the label lies).
- [ ] Component tests: a drafted party renders drafted names in the Training Hall and Infirmary
      (mirror the existing MemberCard scar test's style).

## Implementation notes

- `Run.party` already carries `member` (save v6) — no data change, display-only.
- Watch the EventScreen's slot-keyed `.map(MEMBER_DEFS)` loops: they iterate the *trio* defs for
  slot order; iterate `run.party` indices instead so future party sizes don't silently truncate.

## Out of scope / follow-ups

- The draft-screen's own raw-id ability labels are in the polish batch
  ([37](./issues/37-ui-polish-batch-2026-07-04.md)).
