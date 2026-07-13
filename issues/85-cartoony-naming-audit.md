# Issue 85 — Cartoony naming audit: soften dark/serious entity names

- **Status:** 📋 Open
- **Phase:** content (flavor/naming)   **Size:** M
- **Model:** ⚠️ **Fable only — do NOT use Opus.** If you are asked to resolve this issue with
  Opus (or any non-Fable model), **stop and ask the maintainer before proceeding.** The naming
  voice is the whole point; run it on Fable.
- **Depends on:** —   **Blocks:** none
- **Addresses:** intake 2026-07-13 — "Some of the content naming doesn't match the cartoony theme.
  Go through all of the named entities in the game and ensure that the names don't feel dark or
  serious."

## Why

The game's tone is meant to be **cartoony/light**, but a lot of the named content reads dark or
grim (e.g. Devourer, Devourling, Maw, Gorge, Hexweaver, Grim Harvest, Piercing Bolt). Names train
the player's read of the whole game; a grimdark name on a whimsical prototype is a tonal mismatch.
This issue audits **every named entity** and swaps the ones that feel dark/serious for cartoony
alternatives — **identity/mechanics unchanged**, flavor only.

## Approach (maintainer decision, intake 2026-07-13)

**Audit all, flag offenders, approve-then-apply.** Fable reviews every named entity across the data
layer, but only proposes renames for the ones that read dark/serious — keepers stay as-is. Fable
presents the proposed rename shortlist (old → new, with a one-line reason each) and the maintainer
approves/edits the list **before any code changes are applied**. This matches the repo's per-item
approval loop for content.

Concretely, the implementing agent should:

1. **Enumerate** every player-facing `name:` / display string across the entity categories below.
2. **Judge** each against the cartoony bar and build a shortlist of only the ones that feel too
   dark/serious, each with a proposed lighter name and a short reason.
3. **Present the shortlist to the maintainer and wait for sign-off** (do not rename unilaterally).
4. **Apply** the approved renames — display strings only; **do not touch ids/keys** (see below).

## Scope — entity categories to audit

Only the **display names / player-facing strings**, not the code ids. Categories:

- **Enemies** — `name:` on every `EnemyDef` (`src/data/enemies.ts`): Brute, Swarm, Stalker, Cleaver,
  Ironmaw, Needler, Leech, Juggernaut, Lancer, Devourling, Gatewarden, Hexweaver, Devourer.
- **Enemy attacks/channels/casts** — `ATTACK_INTENT_NAMES` (`src/data/enemies.ts:36`) and every
  channel/rotation-step `name:` (Crushing Blow, Siegebreak, Overrun, Skewer, Gorge, Maw, Piercing
  Bolt, Needle Shot, Hex, Siphon, Consume). **Constraint preserved:** no attack/channel name may
  collide with another (a channel is a bigger threat than the plain attack it replaces — sharing a
  name trains the wrong read; see the comments at `src/data/enemies.ts:31-35` and `:228`).
- **Party members** — `name:` on `MEMBER_POOL`/`MEMBER_DEFS` (`src/data/members.ts`): Ranger, Tank,
  Mage, Warlock, Skald, Berserker, Beast Warden, Sentinel, Duelist, Flagellant — plus
  `MEMBER_ABILITY_FLAVOR` (`src/data/members.ts:158`) text.
- **Cards** — `name:` on every `CardDef` (`src/data/cards.ts`), e.g. Grim Harvest, Shadow Bolt,
  Siphon Life, Blood Tithe.
- **Relics** — `name:` on every `RelicDef` (`src/data/relics.ts`).
- **Ability flavor / misc display strings** — any other player-facing name string in `src/data/`.

## Acceptance criteria

- [ ] Fable produced a rename shortlist (only the dark/serious offenders), maintainer approved it,
      and the applied renames match the approved list.
- [ ] **Only display strings changed.** No `id:`/map-key/`CardId`/`MemberId`/`AttackType`/enemy-`id`
      value was renamed — save compatibility and engine lookups are untouched.
- [ ] The **no-collision** invariant on attack/channel/cast names still holds (no two share a name;
      no channel shares its plain-attack's name).
- [ ] Any test/fixture that asserts a specific display string was updated to the approved new name.
- [ ] Typecheck/build clean; `npm test` passes; ends in its own `jj` commit.

## Implementation notes (anchors)

- Names are centralized in `src/data/`: `enemies.ts`, `members.ts`, `cards.ts`, `relics.ts`,
  `tuning.ts`. Prefer editing these data files; components read names from them.
- **Ids vs names:** the `id:` fields and record keys are the stable engine/save identifiers — leave
  them. This issue only rewrites the human-readable `name:` (and flavor) strings.
- `ATTACK_INTENT_NAMES` (`src/data/enemies.ts:36`) is the generic per-`AttackType` label; scripted
  channels/steps carry explicit `name:` on the `ChannelDef`/`RotationStep`.
- Search for hard-coded display strings in tests: e.g. `test/engine.test.ts` /
  `test/run.test.ts` reference `ATTACK_INTENT_NAMES` and some names directly.

## Tests

- No new mechanics, so no behavioral tests. Update any existing test that asserts a changed display
  string. Confirm `npm test` and `npm run typecheck` are green after the renames.

## Out of scope

- Renaming ids/keys or any save-format change.
- Retuning stats, costs, weights, rotations, or mechanics — flavor only.
- New art/icons (relic emoji, etc.) unless a rename makes an existing icon obviously wrong.
