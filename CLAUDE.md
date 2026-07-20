# CLAUDE.md

Guidance for agents working in this repo. Healer Deckbuilder is a prototype of a single
battle loop. The UI is **React + Vite + TypeScript**; the battle engine is a pure,
DOM-free TypeScript module that the UI and the tests both consume.

## Source control — use `jj`, never `git`

- Use Jujutsu (`jj`) for all version control. **Do not invoke `git` directly.**
- Commit every logical feature as its own commit: `jj commit -m "<msg>"`.
- **All work must end in a commit** — never leave changes uncommitted at the end of a task.
- Work spanning multiple phases or features must be split into multiple commits, one per
  logical unit, not squashed into a single catch-all commit.

## Tests are required

- Add tests for **every new feature** in `test/engine.test.ts` (or a sibling test file).
  Run them with `npm test` (which runs `tsx test/engine.test.ts`). They must pass before
  you commit.
- Design code to be testable: keep game logic pure and DOM-free (see `src/engine.ts`), so
  mechanics can be unit-tested directly without a browser. Put new logic in the engine, not
  the React components, whenever it can be tested in isolation.
- Run `npm run typecheck` (or `npm run build`, which type-checks then bundles) to catch
  type errors before committing.

## Visual verification — do not use the Chrome DevTools plugin

- Do **not** use the Chrome DevTools MCP plugin (or other browser-automation tooling) to
  verify UI changes unless you are told to do so. The maintainer verifies visual/UI changes manually.
- For UI work, make the change, ensure tests still pass, and leave visual confirmation to
  the maintainer rather than driving a browser yourself.

## Authoring content — `src/content/*.json`

**All game content is JSON.** Cards, abilities, relics, heroes, enemies, events,
upgrades and card modifiers live in `src/content/`, are validated at startup, and need
no TypeScript to change or extend. Adding a card that composes existing effects is a
JSON edit and nothing else.

### Adding a card

Add an entry to `src/content/cards.json`:

```json
"quickWard": {
  "id": "quickWard", "name": "Quick Ward", "cost": 2, "target": "single",
  "type": "holy", "rarity": "common", "family": "ward", "buyValue": 3,
  "heal": 3,
  "desc": "Heal a member for {heal} and shield them for {SHIELD_TURNS} enemy turns.",
  "actions": [
    { "op": "heal", "to": "$target", "amount": { "card": "heal" }, "direct": true, "bind": "healed" },
    { "op": "status", "on": "$target", "tag": "shield", "turns": { "tune": "SHIELD_TURNS" }, "mode": "set" },
    { "op": "log", "kind": "heal", "text": "Quick Ward: {target.name} heals {healed} and raises a Shield." },
    { "op": "emit", "kind": "heal", "slot": "$target", "amount": { "var": "healed" }, "hp": { "stat": "hp", "of": "$target" } },
    { "op": "emit", "kind": "shieldApplied", "slot": "$target" }
  ]
}
```

The card is playable immediately. Note it will move the sim baseline — new content
dilutes the shop pool, and `test/sim.test.ts` pins per-fight winrates on purpose.

### The vocabulary

- **Ops** (`op`) — `heal` `damage` `strike` `bloodPay` `drain` `status` `clearStatus`
  `consume` `enemyStatus` `consumeEnemyStatus` `partyBuff` `draw` `mp` `primeRefresh`
  `revive` `purge` `telegraph` `addStat` `queueDelayed` `regenEnded` `healCardSplash`
  `let` `letStr` `letBool` `collect` `forEach` `if` `log` `emit` `native`.
- **Amounts** — a number, `{tune}` (any balance constant by name), `{card}` (a field on
  the RESOLVED card, so upgrades are folded in), `{var}`, `{stat, of}`, `{auto}`,
  `{abilityPower}`, `{missingHp}`, `{enemyStat}`, `{gameStat}`, `{telegraphStat}`,
  `{vulnerable}`, `{bloodCost}`, `{sanguineSurcharge}`, `{holyHealBonus}`,
  `{sum|mul|max|min}`, `{floor}`, `{clampMin, atLeast}`, `{if, then, else}`.
- **Selectors** — `$target` `$self` `$targetOrSelf` `$allLiving` `$allLivingOther`
  `$mostWoundedOther` `$mostWounded` `$lowestHp` `$enemy`, plus `{sel, where}`.
- **Templates** — `{path}`, `{path|s}` (plural), `{path|pct}`, `{cond ? a : b}`, and
  `{$selector.field}`. Descs and log text share one grammar.

`src/content/schema/dsl.ts` is the authoritative list; the validator's error messages
name the nearest valid identifier when you typo one.

### Rules worth knowing

- **Use `{tune}`, not a literal**, for anything that is a balance number. `tuning.ts`
  stays TypeScript because its comments carry sim-anchored rationale, but every numeric
  constant in it (and in `relics.ts`/`run.ts`) is addressable by name.
- **`{card: "heal"}` reads the RESOLVED card**, with Potent/Lingering/Efficient already
  applied. Inlining the constant instead silently deletes card upgrades.
- **Bindings are lexical.** `{var}` only sees names bound earlier in the same list or an
  enclosing one; a binding made inside an `if` branch does not leak out.
- **Every `bind` reports what happened**, not what was asked for — `heal` binds the
  clamped amount, `draw` binds what was actually drawn.
- **Status effects stay engine code**, referenced by `tag`. Adding a genuinely new
  status means adding a writer to `STATUS_WRITERS` in `src/content/interpreter/run.ts`.

### Relic behaviour — the hook bus

Relics may declare behaviour in `relics.json` under `hooks`. Two kinds:

```json
"vanguardsBanner": {
  "hooks": { "modifyMemberDamage": { "when": { "hpFull": "$self" }, "add": { "tune": "VANGUARD_BONUS" } } }
},
"warDrum": {
  "hooks": { "onAbilityCast": [ { "op": "status", "on": "$self", "tag": "drumPrimed", "mode": "set" } ] }
}
```

- **Value hooks** (`modifyMemberDamage`, `modifyAutoStrike`, `modifyEnemyAttack`,
  `modifyHealAmount`, `modifyCardHealBonus`, `modifyPoisonTurns`, `modifyPassiveMp`,
  `allowRest`, `channelExempt`, `revealHidden`, `ripostes`, `narratesDoubleStrike`,
  `vetoDeath`) take `{when?, set?, mul?, add?, answer?, consumes?, consumesMember?,
  clearsMember?, onApply?}`. `set`/`mul`/`add` apply in that fixed order.
  **The reads must be pure** — `memberDamage` feeds the telegraph preview. The consuming
  ones (`vetoDeath`, `modifyAutoStrike`) run through their own dispatchers, never through
  `_hookValue`, precisely so the preview path cannot act.
- **Event hooks** (`onAbilityCast`, `onHealApplied`, `onHealCard`, `onReshuffle`,
  `onMemberDamaged`, `onMemberSurvived`, `onRest`, `onMemberDied`, `onTurnStart`,
  `onAfterAutoAttack`) take an action list. `onMemberDamaged` fires BEFORE the death veto,
  `onMemberSurvived` after it and only for a survivor — do not collapse them.
- **Run-layer hooks** (`modifyShopPrice`, `modifyRecoveryPct`, `modifyFightGold`,
  `modifyRewardSize`) are read by `Run`, which has no `Game`. Their amounts must be static
  (a number or arithmetic over `{tune}`) and they may not take a `when`; the validator
  enforces both.

Hooks compile into a per-`Game` index once, so an unhooked read is a `Map` miss. Hero
passives ride the same bus, tagged with the hero's **slot**, so a passive fires only for
its own hero — that is what replaced the old `m.id === '…'` guards. A passive reacting to
something that happened to someone else reaches its own hero via the `$owner` selector.

**Adding an event hook is a TWO-part change**: the `_hookEvent(...)` call at the seam AND
the name in `EVENT_HOOKS`. A declared name with no seam validates cleanly and then does
nothing — `test/content/hook-sites.test.ts` fails the build if you do half of it. Payload
vars go in `HOOK_CTX_VARS`, and a hook reading a var its seam does not provide is a startup
error.

### What is still code

`stuntDouble` (the Showstopper's dive: a speculative `_wardedDamage` preview that swaps the
hit's recipient mid-loop) and the three `m.ability`-keyed damage bands in `memberDamage`.
Both are declared in `members.json` as `passiveNative`, and a validator check refuses to
start if a hero has `passiveFlavor` text with neither `hooks` nor a `passiveNative` behind
it — so an unimplemented passive cannot hide.

### Validation

Importing `src/constants` validates all content and refuses to start on any error,
reporting **every** problem at once with file → JSON path → cause and a nearest-match
suggestion. That covers the app, all test suites and every sim script, since they all
reach `constants`.

## Do not touch the design doc

- `docs/healer-deckbuilder-spec.md` is a **historical artifact**. Do not reference it as a
  source of truth and do not modify it. Treat the code as the source of truth.

## Project orientation

- **Stack:** React + Vite + TypeScript. There is no global state library — the engine is a
  plain class, and `src/useGame.ts` binds it to React (a ref holds the single instance; a
  tick reducer forces a re-render after each action).
- **Run:** `just run` (Vite dev server with HMR, opens the browser), or `npm run dev`, then
  open the printed URL (default http://localhost:5173).
- **Test:** `npm test`. **Type-check:** `npm run typecheck`. **Build:** `npm run build`.
- **Keep the engine pure and DOM-free** so it stays unit-testable: do not import React or
  touch the DOM from `src/engine.ts`, `src/constants.ts`, or `src/rng.ts`.
- **Layout:**
  - `src/engine/` — pure battle engine (no DOM), the source of truth for mechanics.
    `core.ts` holds the `Game` class (state, turn/mitigation pipeline, most methods);
    `effects.ts` attaches the big card/ability effect methods (`_applyCard`,
    `_fireAbility`) to the prototype (every Game member is public); `index.ts` is the
    barrel — import the engine as `./engine`, never a sub-file.
  - `src/content/` — **all game content as JSON** plus the DSL that interprets it:
    `*.json` (cards, abilities, relics, members, enemies, events, upgrades, modifiers),
    `schema/` (the op vocabulary + zod), `interpreter/` (the action runner and template
    engine), `validate/` (the startup checks and error reporter). See the authoring
    guide above.
  - `src/constants.ts` — the barrel. Re-exports `src/data/*` and, LAST, `src/content` —
    that final line is what makes importing constants validate all content.
  - `src/data/tuning.ts` — balance numbers, still TypeScript so their sim-anchored
    rationale comments survive; addressable from JSON as `{"tune": "NAME"}`.
  - `src/rng.ts` — seedable PRNG + shuffle/weighted-pick (keeps games deterministic by seed).
  - `src/useGame.ts` — React hook binding the engine to the UI.
  - `src/App.tsx`, `src/main.tsx` — app entry and the screen-routing seam.
  - `src/components/` — React components (BattleScreen, EnemyPanel, Party/MemberCard,
    Hand/Card, ManaBar, Actions, CombatLog, AttackLines, GameOverlay, Topbar). DOM lives
    here only.
  - `styles.css` — global, class-based styles; imported from `src/main.tsx`.
  - `index.html`, `vite.config.ts` — Vite HTML entry and config.
  - `test/engine.test.ts` — the test/scenario harness (runs via `tsx`).
