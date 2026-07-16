# Issue 89 — Surface hero passives on member cards; remove all ability text from them

- **Status:** ✅ Complete (2026-07-16 — `MEMBER_PASSIVE_FLAVOR` added; passive name + tooltip on battle card / deploy tile / draft tile; all ability text stripped from member tiles)
- **Phase:** post-demo (UI polish)   **Size:** M
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-16 — "Hero passives should be visible on their cards as the name of
  the passive, with a tooltip with the full description"

## Why

Every hero has a passive (`cf5fc4d feat(engine): a passive for every hero`), and **not one of them is
visible to the player**. The passives exist only as engine behavior with their names buried in code
comments — there is no data table for them, unlike `MEMBER_ABILITY_FLAVOR`. A player cannot learn
that the Showstopper has Stunt Double except by noticing her eat a lethal blow aimed at someone else.

Meanwhile the member cards spend their text budget on **ability** flavor, which no longer belongs
there: abilities come from ability cards, and those cards state their own text. So the ability text
comes off the member cards entirely and the passive takes the freed space.

## Acceptance criteria

- [ ] **New passive data table.** `MEMBER_PASSIVE_FLAVOR: Record<MemberId, { name: string; desc:
      string }>` in `src/data/members.ts`, mirroring `MEMBER_ABILITY_FLAVOR`'s shape and conventions
      (interpolate tuning constants into `desc` — never hardcode numbers that live in `tuning.ts`).
      One entry per hero in `MEMBER_POOL`; **every** hero has a passive, so the record is total.
- [ ] **Names ship as-is from the code comments** — `Toxicologist`, `Grudge`, `Last Stand`,
      `Dark Bargain`, `Stunt Double`, `Riposte Master`, `Arcane Battery`, `Opening Act`,
      `Feral Bond`, … Do **not** rename, cartoony-ify, or "improve" them; #85's audit deliberately
      does not apply here.
- [ ] **Descriptions match engine behavior.** Each `desc` is derived by reading the passive's actual
      implementation in `src/engine/core.ts`, not by paraphrasing the comment. Anchors:
      Toxicologist/Grudge `:520`, Last Stand `:974`, Dark Bargain `:1018`/`:1024`, Stunt Double
      `:1808`, Riposte Master `:1839`, Arcane Battery `:1953`, Opening Act `:1960`, Feral Bond
      `:2262`. Audit for any passive not in this list.
- [ ] **Passive name + tooltip on the battle member card.** The passive name renders on `MemberCard`,
      with the full `desc` as a hover tooltip. Use the repo's tooltip convention — the native `title`
      attribute (`Card.tsx:125`, `EnemyPanel.tsx:34`) — via the existing `StatusBadge`
      (`MemberCard.tsx:19`), which already takes a `title`. No new tooltip component.
- [ ] **Passive name + tooltip on the Deploy screen roster tiles** (`DeployScreen.tsx:112-117`).
- [ ] **Passive name + tooltip on the Draft / recruit tiles** (`DraftScreen.tsx:13-20`).
- [ ] **NO ability references remain on any member card or tile, anywhere.** Remove both the inline
      ability text and the ability `title` tooltip. Nothing replaces them — no "see the card in
      hand", no ability name, no hint text pointing at abilities. Sites:
      - `DeployScreen.tsx:112` (`title={MEMBER_ABILITY_FLAVOR[id]}`) and `:117`
        (`<span className="draft-member-ability">`)
      - `DraftScreen.tsx:13` (`const flavor`), `:15` (`title={flavor}`), `:20` (the span)
      - `StarterDeckScreen.tsx:75` (`summaries[id]` in a `draft-member-ability` span) — audit what
        `summaries` holds; if it is ability text it goes, if it is something else leave it.
      - Sweep for any site this list misses.
- [ ] `MEMBER_ABILITY_FLAVOR` itself **stays in `data/members.ts`** if any non-member-card consumer
      still needs it; if the sweep leaves it with zero consumers, delete it and its tests rather than
      keeping dead data.
- [ ] Typecheck/build clean; `npm test` green.

## Implementation notes (anchors)

- Passive names currently exist **only** as comments in `src/engine/core.ts` (grep `passive`,
  excluding `passiveMp`/`PASSIVE_MP`, which are the unrelated healer MP stat). Keep the engine
  comments; the data table is additive — do not refactor engine behavior.
- `src/data/members.ts:165` — `MEMBER_ABILITY_FLAVOR`; put `MEMBER_PASSIVE_FLAVOR` beside it and
  follow its constant-interpolation style. Mind the leaf-first load order noted in `constants.ts`.
- `src/components/MemberCard.tsx:156` — the `.badges` row; `StatusBadge` at `:19`.
- `styles.css:1190` — `.draft-member-ability`. Reuse or rename for the passive line; delete if it
  ends up unused.
- Member identity must resolve through `memberDefAt()` (`data/members.ts`), not `MEMBER_DEFS[slot]`
  — reading the array directly shows classic-trio names for a drafted party (the #36 bug).
- Overlaps issue 88 in `DeployScreen.tsx` (that one edits the header button; this one edits the
  roster tiles). Different regions — but if 88 has already landed, rebase on it rather than reverting
  its button label.

## Tests

- **Data completeness:** every `MemberId` in `MEMBER_POOL` has a `MEMBER_PASSIVE_FLAVOR` entry with a
  non-empty `name` and `desc` (mirrors the existing flavor checks at
  `engine.archetypes.test.ts:132`).
- **Render:** `test/components.test.tsx` — the battle member card, deploy tile, and draft tile each
  show the passive `name` and carry its `desc` as a `title`.
- **Negative:** the rendered text of those three surfaces contains **no** ability flavor. Assert
  against `MEMBER_ABILITY_FLAVOR[id]` content directly, so the test fails if ability text creeps
  back in.
- **Update existing tests** that assert ability flavor on member cards:
  `components.test.tsx:177`, `engine.archetypes.test.ts:132`, `:524`, `:687`.

## Resolution (2026-07-16)

Built as specified, with these decisions on the acceptance criteria's `MEMBER_ABILITY_FLAVOR`
fork:

- **`MEMBER_ABILITY_FLAVOR` was deleted outright** (maintainer call, 2026-07-16). After the
  sweep it had zero production consumers — heroes no longer have inherent abilities; each
  ability's text lives on its ability **card**, the only place it belongs. The table and every
  test that referenced it were removed (`engine.test.ts` / `engine.archetypes.test.ts` imports
  and the three flavor-mention checks). The negative render tests now guard against the ability
  **card** name appearing on a member tile (`abilityCardName()` in `components.test.tsx`), which
  is the modern encoding of "ability text belongs on the card, not the member."
- **Passive names shipped verbatim** from the engine comments. The Berserker — absent from
  the criteria's name list — is **Rage** (`cf5fc4d`'s "Berserker's Rage bands"); the record is
  total over `MEMBER_POOL`.
- `.draft-member-ability` was **reused** (not renamed) for the passive line; a new
  `.badge.passive` pill styles the battle-card badge.
- `StarterDeckScreen.tsx:75` `summaries[id]` holds a **deck card-list** summary, not ability
  flavor — left untouched per the audit note.

## Out of scope

- Renaming any passive (explicitly rejected — ship the comment names).
- Changing passive **behavior**, or adding passives to heroes that lack one.
- The ability **cards'** own text — they keep stating what they do; only the member cards/tiles are
  stripped.
