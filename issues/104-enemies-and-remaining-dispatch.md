# Issue 104 — Enemies and the remaining dispatch surfaces (`enemies.json`, `casts.json`, channel ticks, delayed effects)

- **Status:** ✅ Complete (2026-07-20 — enemies.json: defs, rosters, encounter table)
- **Phase:** content-migration (phase 4 of 6)
- **Depends:** **#99** (the characterization suite is the regression gate for this and every
  issue in #100–#106 — in particular **A6**, the 5 cast kinds + `mendingStream`/`sap` channel
  ticks + `delayedStartEffects`, and **A9**, the enemy defs), then **#100**, **#101**,
  **#102**, **#103**.
- **Addresses:** approved migration plan 2026-07-20, phase 4.

## Why

Three dispatch surfaces are left after cards (#101) and abilities (#102), and they are the
three that decide whether the migration actually delivers its promise. **Without this issue,
a new channeled card or a new delayed effect still requires an engine edit** — so "author
content without writing code" would be false for two whole card shapes.

| Surface | Site | Arms |
|---|---|---|
| Enemy casts | `src/engine/core.ts:1716` `switch (t.cast)` | 5 — `wound`, `siphon`, `poison`, `curse`, `consume` |
| **Cast preview text** | `src/engine/core.ts:639-656` `switch (t.cast)` | 5 — a full duplicate of the cast kinds, for the UI |
| Channel ticks | `src/engine/core.ts:1182-1200` `switch (id)` | 2 — `mendingStream`, `sap` |
| Delayed start effects | `src/engine/core.ts:1943-1955` | 1 — union closed at `core.ts:89` |

The preview switch is the interesting one. `telegraphDetail` at `core.ts:639-656` re-states
every cast's effect in prose ("Curses the party — all healing is halved for N turns. Cleanse
removes it.") purely so the player can read the telegraph. It is a **second, hand-maintained
copy** of the cast table, and it drifts the instant anyone edits one and not the other.

`delayedStartEffects` is worse: its type is a closed one-member union,
`export type DelayedStartEffect = { kind: 'sunriseVigil' };` (`core.ts:89`), and the resolver
at `core.ts:1943-1955` hardcodes the Sunrise Vigil party heal. Adding a second delayed effect
today means editing a type, an engine branch, and a card arm.

## Approach (decisions locked — do not re-ask)

- **Derive `telegraphDetail`'s cast text from `casts.json`**, do not port the switch. Each
  cast def carries a `detail` **template** resolved by #100's interpolator (`{WOUND_TURNS}`,
  `{amount|s}`, etc.). The duplicate switch at `core.ts:639-656` is then deleted, not
  migrated. This is the point of the phase: one definition, two readers.
- **Channel ticks become action lists** on the channelled card's def
  (`"channel": { "tickActions": [...] }`), run through the same `runActions` as every other
  effect. `_channelTick`'s surrounding contract stays in code: the `decrement` flag, the
  `this.channelTurns -= 1`, and the trailing
  `this._emit({ kind: 'channelPulse', card: id, turnsLeft: this.channelTurns })`
  (`core.ts:1200-1202`) are shell, not content.
- **`delayedStartEffects` becomes an action list too.** The queued item carries its own
  actions rather than a `kind` tag; `DelayedStartEffect` stops being a closed union.
  #101's `queueDelayed` op is what enqueues them.
- **Enemy defs are already near-pure data** (`src/data/enemies.ts`: `DEFAULT_ENEMY_DEF` `:112`,
  `BOSS_ENEMY_DEF` `:116`, the five `ENEMY_*` normals from `:147`, the three
  `bossDef(...)` acts from `:200`/`:222`/`:250`, `ACT_BOSS_DEFS` `:272`, and the
  `normalDef(...)` roster from `:285`). This is a mechanical port — but the `bossDef` /
  `normalDef` **factory functions** must be preserved as JSON defaults, not flattened by hand,
  or every shared default becomes 17 opportunities to typo.

## Ordering contract that must not move (currently pinned only by #99 A6)

`delayedStartEffects` fires **at the start of the next player phase, after the Regen tick,
before the draw, stacking per cast** — documented at `src/engine/effects.ts:106-113` and
implemented at `core.ts:1943-1955` (note `_drawTo(this.handSize)` follows at `core.ts:1974+`,
after the passive-MP block). Until #99, **nothing in the entire test directory referenced
`delayedStartEffects` at all.** It is the single easiest thing in this phase to regress
silently, and the *only* reason it is now safe to touch is that A6 pins it.

## Acceptance criteria

- [x] **Commit 1 — `enemies.json`.** All enemy defs ported, with `bossDef`/`normalDef`
      defaults expressed as JSON defaults (a shared base object the schema merges), not
      copy-pasted per enemy. `src/content/index.ts` re-exports every existing name with an
      identical shape: `DEFAULT_ENEMY_DEF`, `BOSS_ENEMY_DEF`, `ENEMY_SPAMMER`, `ENEMY_SWARM`,
      `ENEMY_STALKER`, `ENEMY_CLEAVER`, `ENEMY_MARKER`, `GATEWARDEN_DEF`, `HEXWEAVER_DEF`,
      `DEVOURER_DEF`, `ACT_BOSS_DEFS`, `IRONMAW_DEF`, `NEEDLER_DEF`, `LEECH_DEF`,
      `VENOMANCER_DEF`, `JUGGERNAUT_DEF`, `ENCOUNTER_TABLE`, and the per-enemy damage/duration
      consts. **Grep each name's import sites before deleting the old module.**
- [x] Validator: every enemy's `cast` references a cast in `casts.json`; every
      `ENCOUNTER_TABLE` entry names a real enemy def; every attack `type` is a known
      `AttackType`; rotation/phase entries are internally consistent.
- [x] **Commit 2 — `casts.json` + derived preview text.** All 5 cast kinds as action lists.
      **`telegraphDetail`'s `switch (t.cast)` at `core.ts:639-656` is deleted** and its prose
      is generated from each cast's `detail` template. The player-visible strings are
      byte-identical (A6 asserts them exactly).
- [x] `core.ts:1716`'s `switch (t.cast)` is deleted; casts resolve through `runActions`.
- [x] **Commit 3 — channel-tick actions.** `mendingStream` and `sap` move to
      `channel.tickActions` on their card defs; `core.ts:1182-1200`'s switch is deleted. The
      shell keeps `decrement`, `channelTurns -= 1`, and the `channelPulse` emit
      (`core.ts:1200-1202`) in that exact order.
- [x] `sap`'s two clamps survive exactly: `Math.min(SAP_VULN_CAP, vulnerable + SAP_VULN_PER_TICK)`
      and `Math.max(vulnerableTurns, SAP_VULN_TURNS)` (`core.ts:1195-1196`) — a `min` and a
      `max`, not the same operator twice.
- [x] **Commit 4 — action-list delayed effects.** `DelayedStartEffect` stops being a closed
      union at `core.ts:89`; queued entries carry their own actions; `core.ts:1943-1955`
      becomes a generic drain loop. `sunriseVigil`'s delayed party heal is expressed entirely
      in `cards.json`.
- [x] **The phase's real acceptance test:** a **new** channelled card and a **new** delayed
      effect can each be added to `cards.json` with **no TypeScript edit anywhere** and appear
      in a run. Demonstrate at least one of the two in the commit (it may be reverted after
      demonstrating, but say so in the message).
- [x] Each commit ships an empty `sim/trace.ts` diff **and** an empty `exerciseAll()` log diff
      against its parent, per #100's procedure.
- [x] `npm test` green and `npm run typecheck` clean at **every** commit.

## Implementation notes (anchors)

- **Cast resolution:** `core.ts:1716-1760`, arms at `:1717` (`wound`), `:1723` (`siphon`),
  `:1730` (`poison`), `:1743` (`curse`), `:1756` (`consume`).
- **Cast preview:** `core.ts:639-656`, arms at `:640` (`wound`), `:642` (`siphon`), `:644`
  (`poison`), `:649` (`curse`), `:653` (`consume`). Note `wound` and `siphon` are
  brace-less single-expression returns while the others are blocks — the shapes differ, so
  the `detail` template must handle both without special-casing.
- **`lantern` interacts with the preview:** `core.ts:673` (`if (t.hidden && !this.hasRelic('lantern'))`)
  sits inside `telegraphDetail`, and `core.ts:877` is its sibling. Those became a
  `revealHidden` value hook in **#103** — this issue must not reintroduce a direct
  `hasRelic` read while rewriting the surrounding function.
- **Channel tick:** `core.ts:1182-1202`. `mendingStream` at `:1183` reads
  `this.members[this.channelTarget as number]` — the target is channel state, not a selector
  argument; keep it as an explicit `$channelTarget` selector rather than smuggling it in.
- **Delayed effects:** type at `core.ts:89`, enqueued from `effects.ts:106-113`, drained at
  `core.ts:1943-1955`, with `_drawTo(this.handSize)` following at `core.ts:1974+`.
- **Enemy data:** `src/data/enemies.ts` — `ATTACK_BASE_DAMAGE` `:7`, `TYPE_WEIGHTS` `:15`,
  `SLOT_WEIGHTS` `:26`, `ATTACK_INTENT_NAMES` `:36`. These are tuning-flavoured tables;
  port them as JSON only if they carry no rationale comments, otherwise leave them in TS
  under the `tuning.ts` argument.
- **Save/load:** `currentEnemyDef` is embedded **by value** in the save at `src/run.ts:150`.
  Changing an enemy def's shape therefore invalidates saves. The `RUN_SAVE_VERSION` bump for
  the whole migration lands in **#106**; if this issue changes the persisted enemy-def shape,
  say so in the commit message so #106's bump is not mistaken for optional.

## Tests

- **No new behavioral tests.** #99's A6 (casts, channel ticks, delayed effects, including the
  `effects.ts:106-113` ordering contract) and A9 (12 enemy defs: rotation ordering, phase
  transitions, telegraph generation) are the oracle; the unmodified files must pass before
  and after each commit.
- New tests only for what this issue introduces:
  - the derived `telegraphDetail` text equals the previously hardcoded string, for all 5
    casts, in both the hidden and revealed (`lantern`) variants;
  - the generic delayed-effect drain runs **multiple** queued entries in enqueue order and
    stacks per cast (the old code's `for (const eff of queued)` behavior);
  - validator coverage: enemy `cast` refs, `ENCOUNTER_TABLE` refs, unknown attack type.
- Per-commit: `npm test`, `npm run typecheck`, empty `sim/trace.ts` diff, empty
  `exerciseAll()` log diff.
- Visual/UI confirmation is maintainer-verified manually per `CLAUDE.md`.

## Out of scope

- Run-layer content — events, upgrades, modifiers — **#105**.
- `EnemyId`/`CastId` becoming `string`, the `RUN_SAVE_VERSION` bump, and the CLAUDE.md
  authoring guide — **#106**.
- The difficulty arrays (`src/data/run.ts:535-554`, `ENEMY_HP_BY_FIGHT` and siblings). They
  stay TypeScript: they are heavily comment-annotated with sim history, the same argument
  that keeps `tuning.ts` in TS (decision 6).
- Rebalancing any enemy. HP, damage and rotation values move by reference, not by value.
- Adding new enemies or casts beyond the one throwaway demonstration required above.
