# Issue 103 — Relic hook bus, run-layer hooks, `relics.json`, and hero passives

- **Status:** ✅ Complete (2026-07-20 — all 21 relics and 10 of 11 hero passives are data; `stuntDouble` and the ability-keyed damage bands stay native BY DECLARATION, and a coverage check now enforces that every described passive is backed by hooks or a named native)
- **Phase:** content-migration (phase 3 of 6)
- **Depends:** **#99** (the characterization suite is the regression gate for this and every
  issue in #100–#106 — in particular **A7**, all 21 relics with not-owned control cases, and
  **A8**, all 11 hero passives), then **#100**, **#101**, **#102**.
- **Addresses:** approved migration plan 2026-07-20, phase 3.

> ## ⚠️ This is the riskiest issue in the migration
>
> The plan ranks it first of three: **the value-hook-bus commit, then #101's `cards.json`
> scaffold, then #106's string-id cutover.** The hook bus rewires the engine's hot path
> (`memberDamage`'s telegraph-preview purity, `core.ts:1445-1450`) **and** the death pipeline
> (`vetoDeath` ordering, `core.ts:990-1000`) *simultaneously*. The first draft of the plan
> did not flag this at all. Split it: value hooks, event hooks, run-layer hooks, `relics.json`
> and passives are **five separable, individually revertible commits**, and each one gets its
> own `sim/trace.ts` diff.

## Why

Relic and passive behavior is scattered as inline `if`s through the engine:

- **20 `hasRelic` sites** — 18 in `src/engine/core.ts`, 2 in `src/engine/effects.ts`
  (`:465` warDrum, `:486` venomGland). `hasRelic` itself is `core.ts:495`.
- **11 hardcoded `m.id === '…'` hero-passive sites** in `core.ts`.
- A parallel set in the run layer against `Run.hasRelic` (`src/run.ts:1173`).

Adding a relic today means finding the right line in a 2500-line engine file and inserting an
`if`. That is the opposite of the migration's goal, and it is also why nine relics exist only
as a boolean probe in `sim/exercise.ts:234` — there was no seam to test against.

## Approach (decisions locked — do not re-ask)

**Value hooks must be pure reads.** `memberDamage` feeds `attackTargets()`'s telegraph
preview (`core.ts:1445-1450` documents the "telegraph == applied" contract explicitly); a
side-effecting value hook corrupts previews and breaks the property test named in
`ISSUES.md`'s ground rules. Enforce purity structurally: value hooks return
`{add|mul|set|veto}` and are given a frozen read-only context.

**Value hooks** (`{when, add|mul|set|veto}`):

| Hook | Site(s) |
|---|---|
| `modifyMemberDamage` | `vanguardsBanner` `core.ts:510`, `loneWolf` `core.ts:530` |
| `modifyEnemyAttack` | `rustyCrown` `core.ts:595` |
| `modifyHealAmount` | `fieldTriage` `core.ts:1233` |
| `modifyCardHealBonus` | `reliquaryOfLight` `core.ts:1210` |
| `modifyPoisonTurns` | `venomGland` `core.ts:1343` **and `effects.ts:486`** (see below) |
| `modifyPassiveMp` | `pactOfSilence` `core.ts:1963` |
| `modifyMaxMana` | — (`focusStone` stays a constructor native, see below) |
| `modifyMaxHp` | — (`warband` stays a constructor native) |
| `allowRest` | `pactOfSilence` `core.ts:2308` |
| `channelExempt` | `chantersIdol` `core.ts:1130` |
| `revealHidden` | `lantern` `core.ts:673`, `core.ts:877` |
| `vetoDeath` | `martyrsIcon` `core.ts:990` (consuming) |

**Event hooks:** `onAbilityCast` (`warDrum` `effects.ts:465`) · `onHealApplied`
(`beaconOfSecondSun` `core.ts:1247`) · `onHealCard` (`twinCenser` `core.ts:1273`) ·
`onReshuffle` (`prayerBeads` `core.ts:1995`) · `onMemberDamaged` (`ossuaryBell`
`core.ts:1889` — a **crossing** detector: it compares `hpBefore >= half` against
`m.hp < half`, so the payload must carry `hpBefore`/`hpAfter`, not just the current HP) ·
`onRest` (`pilgrimsFlask` `core.ts:2343`).

**Run-layer hooks** (against `Run.hasRelic`, `src/run.ts:1173`) — same `RelicDef.hooks` JSON
shape, different hook set: `modifyShopPrice` (`hagglersCharm` `run.ts:1189`) ·
`modifyRecoveryPct` (`surgeonsThread` `run.ts:642` **and** `run.ts:687` — two sites, same
relic, easy to migrate one and forget the other) · `modifyFightGold` · `modifyRewardSize`
(`beggarsBowl` `run.ts:743`).

**Two constructor natives stay code:** `warband` (`core.ts:359`, reads
`emptySeatsAtStart` while building `this.members`) and `focusStone` (`core.ts:419`, reads
party size before `maxMana` exists). Both run before any hook bus could exist. Declare them
as natives so the validator knows they are accounted for.

**Dispatch:** compile the owned relics to a `Map<HookName, CompiledHook[]>` **once at `Game`
construction**. `memberDamage` is the hottest function in the sim; a generic interpreter walk
there is unacceptable. With 0–3 relics owned this is a `Map.get` returning `undefined` —
cheaper than today's two `Set.has` calls. If `npm run sim` regresses >15% after this issue,
the index is not being hit; that is a bug, not a cost of doing business.

## Two `hasRelic` sites the first inventory missed — do not lose these

1. **`src/engine/effects.ts:486`** — the `poison` **ability** duplicates venomGland's duration
   extension *inline*: `POISON_TURNS + (this.hasRelic('venomGland') ? VENOM_GLAND_BONUS_TURNS : 0)`.
   This is a **separate site** from `_applyPoison`'s `core.ts:1343`. Migrating only the
   `core.ts` one leaves the ability silently un-hooked (and, worse, still working — so a
   later refactor of the hook would break it without any test noticing unless #99's A7
   covers the ability path specifically).
2. **`src/engine/core.ts:2441`** — drum-doubling **log text** branches on
   `hasRelic('warDrum')`: `"The War Drum beats — X's strike doubles!"` vs
   `"X's strike lands doubled!"`. This is neither a value hook nor an event hook.
   **Decide between a `logVariant` hook and a native**, and record the decision in the commit
   message. #99 asserts both strings exactly, so getting it wrong is a loud failure, not a
   silent one.

## Hero passives

Of the 11 `m.id === '…'` sites:

- **Trivially data (3):** `mage` Arcane Battery (`core.ts:1974`), `skald` Opening Act
  (`core.ts:1978`), `tank` Grudge reset (`core.ts:2455`).
- **Value hooks (3):** `ranger` Toxicologist (`core.ts:539`), `tank` Grudge read
  (`core.ts:540`), and the `m.ability`-keyed damage bands at `core.ts:515-528`.
- **Event hooks (2):** `warlock` Dark Bargain (`core.ts:1044`), `beastWarden` Feral Bond
  (`core.ts:2447`).
- **`core.ts:1877` — Tank Grudge *banking*** with the `HOLD_LINE_BANK_MULT` doubling:
  `m.bankedDamage += w.dmg * (m.holdLineTurns > 0 ? HOLD_LINE_BANK_MULT : 1)`. **This is a
  third, separate Grudge site**, distinct from the read at `:540` and the reset at `:2455`,
  and it was missing from the first draft entirely. It is an `onMemberDamaged` hook. #99's
  A8 asserts it explicitly.
- **`sentinel` Stunt Double (`core.ts:1830-1840`) stays code.** It runs a speculative
  `_wardedDamage` preview and then swaps the hit's recipient mid-loop. Declare it as
  `{"passive": {"native": "stuntDouble"}}` so the validator knows it exists.
- **`flagellant` Last Stand (`core.ts:994`)** folds into the same `vetoDeath` hook as
  `martyrsIcon`, **priority-ordered so the Martyr wins** — the code today reads
  `const lastStand = !martyr && m.id === 'flagellant' && !m.lastStandUsed;`. This genuinely
  simplifies `core.ts`.

### ⚠️ `duelist` Riposte Master must stay a value hook — do NOT give her permanent `riposteTurns`

`core.ts:1858` reads `const ripostes = m.riposteTurns > 0 || m.id === 'duelist';`.

**An earlier draft proposed replacing that with permanently-set `riposteTurns` and called it
behavior-preserving. It is not — it is a bug.** `riposteTurns` is a *timed* field with four
other owners:

- it **decays each enemy turn** with a "lowers their guard — En Garde fades" log
  (`core.ts:1655-1657`);
- it is **zeroed by the death pipeline** (`core.ts:1019-1020`, "death ends the En Garde
  stance");
- it is **cleared on Resurrect** (`effects.ts:159`);
- and **En Garde plain-assigns it**, `holder.riposteTurns = EN_GARDE_TURNS`
  (`effects.ts:603`) — it does not `Math.max`.

So a single En Garde cast on the Duelist would set her to a finite count, which then decays
to zero and **permanently deletes her passive** for the rest of the fight. Death or a
Resurrect would do the same, instantly.

**Keep it as a value hook** — a `ripostes` predicate ORed into the existing read. The rule
generalizes: **never overload a timed field to express a permanent property.** Add a #99
regression test for it if A8 does not already have one: En Garde the Duelist, let it expire,
assert she still ripostes.

## Acceptance criteria

- [ ] **Commit 1 — value hook bus.** `Map<HookName, CompiledHook[]>` built once in the `Game`
      constructor. All 12 value-hook sites above route through it. Hooks are structurally
      pure (frozen context; no engine mutation reachable). `attackTargets()` preview still
      equals applied damage — the existing property test passes unchanged.
- [ ] `vetoDeath` handles `martyrsIcon` **and** `flagellant` Last Stand with the Martyr
      priority-ordered first, consuming exactly one save; `core.ts:990-1000` simplifies rather
      than grows.
- [ ] **Commit 2 — event hook bus.** All 6 event hooks plus the **2 missed sites**
      (`effects.ts:486`, `core.ts:2441`) migrated, with the `core.ts:2441` `logVariant`-vs-
      native decision recorded in the commit message. `onMemberDamaged` carries
      `hpBefore`/`hpAfter` so `ossuaryBell`'s crossing detection is expressible.
- [ ] **Commit 3 — run-layer hooks.** `modifyShopPrice`, `modifyRecoveryPct` (**both**
      `run.ts:642` and `run.ts:687`), `modifyFightGold`, `modifyRewardSize` route through the
      same `RelicDef.hooks` JSON with a run-layer hook set.
- [ ] **Commit 4 — `relics.json`.** All 21 relics as data with their `hooks` blocks;
      `src/data/relics.ts`'s `RELICS`/`RELIC_IDS` (`:125`, `:179`) re-exported from
      `src/content/index.ts` with identical shape. `warband` and `focusStone` declared as
      constructor natives. Validator: every hook name is known; every relic's referenced
      natives exist.
- [ ] **Commit 5 — hero passives.** The 3 data passives, 3 value hooks, 2 event hooks, and
      the `core.ts:1877` Grudge-banking `onMemberDamaged` hook moved into `members.json`.
      `sentinel` declared `{"passive": {"native": "stuntDouble"}}`. **`duelist` Riposte Master
      remains a value hook** (see the warning above).
- [ ] After all five: **zero `hasRelic` calls remain in `src/engine/`** except the constructor
      natives' `config.relics?.includes(…)` reads (`core.ts:359`, `:419`), and zero
      `m.id === '…'` passive branches remain except `stuntDouble`.
- [ ] Each of the five commits ships an empty `sim/trace.ts` diff **and** an empty
      `exerciseAll()` log diff against its parent, per #100's procedure.
- [ ] **Perf gate:** `npm run sim` wall time recorded and compared against the phase-0/1/2
      baselines. **A >15% regression means the hook index is not being hit** — investigate,
      do not accept.
- [ ] `npm test` green and `npm run typecheck` clean at **every** commit.

## Implementation notes (anchors)

- `hasRelic` (engine): `core.ts:495`. `Run.hasRelic`: `run.ts:1173`.
- Full engine `hasRelic` site list: `core.ts:510, 530, 595, 673, 877, 990, 1130, 1210, 1233,
  1247, 1273, 1343, 1889, 1963, 1995, 2308, 2343, 2441` and `effects.ts:465, 486`.
- Full passive site list: `core.ts:515-528` (ability-keyed bands), `539`, `540`, `994`,
  `1044-1045`, `1831`, `1858`, `1877`, `1974`, `1978`, `2447`, `2455`.
- `_bloodPay` and the death pipeline meet at `core.ts:990-1020`; note `:1019-1020` zeroes
  `riposteTurns` and `:1013-1018` clears the rest of the member's status block. `vetoDeath`
  must fire **before** the death event is emitted — `core.ts:1879-1881` documents that the
  Martyr's veto resolves before emission "so the animator never stages a death that didn't
  happen."
- The nine probe-only relics currently live as booleans in `sim/exercise.ts:234`
  (`RELIC_PROBES`). #99's A7 promotes them to real tests; **this issue must not regress them
  back into probes**, and the probes' log-substring matches will break if any hook changes
  log text (see #85 naming-pass memory: log-substring probes are brittle).

## Tests

- **No new behavioral tests.** #99's A7 (21 relics, each with a not-owned control) and A8
  (11 passives, including the `core.ts:1877` banking site) are the oracle; the unmodified
  files must pass before and after each commit.
- New tests only for the hook machinery itself:
  - hook compilation produces the expected `Map` for a given relic set, and an empty map for
    no relics;
  - a value hook that attempts to mutate is rejected/inert (purity is structural, and proven);
  - `vetoDeath` priority: Martyr's Icon wins over Last Stand, and exactly one save is spent;
  - **the Duelist regression:** En Garde her, let `riposteTurns` decay to 0
    (`core.ts:1655-1657`), assert she *still* ripostes; then kill and revive her and assert
    the same. This is the guard against the rejected "permanent `riposteTurns`" design.
- Validator tests: unknown hook name is reported; a relic referencing a missing native is
  reported; both with Levenshtein suggestions.
- Per-commit: `npm test`, `npm run typecheck`, empty `sim/trace.ts` diff, empty
  `exerciseAll()` log diff, and the `npm run sim` perf number.

## Out of scope

- Enemy defs and casts, channel ticks, delayed effects — **#104**.
- Run-layer *content* (events, upgrades, modifiers) — **#105**. This issue moves only the
  run-layer relic **hooks**.
- `RelicId` becoming `string` — **#106**.
- Rebalancing any relic or passive. Every value moves by reference, not by value.
- Fixing anything #99 characterized as looking wrong — that is a separate, deliberate change
  against a green suite.

## Progress (2026-07-20)

**Metadata done, behaviour not.** `relics.json` and `members.json` landed alongside
#106: names, rarities, icons, stats and descs (17 of 21 relic descs keep live tuning
references) are content now, and `RELICS`/`MEMBER_POOL` read from them.

**Still outstanding — the actual hook bus.** The 20 `hasRelic` sites and the 11
`m.id ===` hero-passive sites are unchanged. Relic *behaviour* remains inline engine
code.

**Why it was deferred to last, deliberately.** This is the plan's own "riskiest commit":
it rewires `memberDamage` (the hottest function in the sim, and a **pure read** because
`attackTargets()` uses it for the telegraph preview — a side-effecting hook there
corrupts previews, `core.ts:1445-1450`) and the `vetoDeath` death pipeline
(`core.ts:990-1000`) at the same time. Every other phase was independent of it, so the
sequencing in this file was convenience rather than necessity. Doing it against a fully
migrated, fully tested codebase is strictly safer than doing it mid-migration.

**What is already in place for it.** The `#99` A7 suite pins all 21 relics with
owned/not-owned controls and A8 pins all 11 passives including their non-firing cases;
`sim/trace.ts` gives a second net; and the interpreter, validator and native registry
all exist. The remaining work is the hook vocabulary itself plus the compiled per-`Game`
hook index that keeps `memberDamage` off a generic interpreter walk.

**Carried forward — do not lose these:**
- The Duelist's Riposte Master must stay a value hook. Giving her permanent
  `riposteTurns` is NOT behaviour-preserving (see the ⚠️ section above).
- Two easily-missed sites: `effects.ts:486` (the poison ability duplicates venomGland's
  extension inline — now visible as a `{if, hasRelic}` amount in `abilities.json`) and
  `core.ts:2441` (drum-doubling log text branches on `hasRelic`).
- `core.ts:1877` Tank Grudge *banking* is a third, separate site from the read at `:540`
  and the reset at `:2455`.

## Hook bus landed (2026-07-20)

The bus exists and 11 relics run through it. **Perf gate passed, measured not assumed:**
the pre-hook engine reads 0.57–0.60s on `npm run sim -- 200 1` and the hooked engine
0.58–0.62s — the compiled index costs nothing. The apparent regression against #100's
0.46s baseline is fixed per-process startup (content parse + validation, ~72ms,
dominated by module init rather than zod); marginal per-seed cost is identical at
N=200/1000/2000 (0.66ms/seed).

**Migrated (11):** `vanguardsBanner`, `loneWolf` (modifyMemberDamage) · `rustyCrown`
(modifyEnemyAttack) · `fieldTriage` (modifyHealAmount) · `reliquaryOfLight`
(modifyCardHealBonus) · `venomGland` (modifyPoisonTurns) · `pactOfSilence`
(modifyPassiveMp + allowRest) · `lantern` (revealHidden, both sites) · `chantersIdol`
(channelExempt) · `martyrsIcon` (vetoDeath, consuming) · `warDrum` (onAbilityCast).

**Deliberately not hooked:** `focusStone` and `warband` apply in the Game *constructor*,
before the index compiles. They stay constructor reads of `config.relics`, and the hook
name list omits `modifyMaxMana`/`modifyMaxHp` so nothing declares a hook that never fires.

---

# Remaining work — re-verified 2026-07-20 against the migrated tree

> **All line numbers below were re-checked after #101–#106.** The original write-up's
> citations are obsolete: `core.ts` grew by ~120 lines and `effects.ts` shrank from 794
> to 79, so every pre-migration anchor has moved.

## ⚠️ The blocker nobody would guess: 7 of the 8 event hooks are never fired

`EVENT_HOOKS` in `src/content/hooks.ts` declares eight names, but **the engine only
calls `_hookEvent` once** — `onAbilityCast`, at `src/engine/effects.ts:56`.

`onHealApplied` · `onHealCard` · `onReshuffle` · `onMemberDamaged` · `onRest` ·
`onMemberDied` · `onTurnStart` have **no call site**. Declaring one of them in
`relics.json` today validates cleanly and then silently does nothing.

**So each remaining event-hook relic is a two-part change:** add the `_hookEvent(...)`
call at the seam AND declare the hook in JSON. Doing only the second half is the exact
failure this bus was built to prevent, and the validator will not catch it.

**Sub-task worth doing first:** make the validator reject (or at minimum report) a
declared hook whose name has no call site — a `FIRED_HOOKS` set exported from the engine
and cross-checked, so this trap closes permanently.

## Remaining engine relics (5)

| Relic | Current site | Hook needed | Notes |
|---|---|---|---|
| `beaconOfSecondSun` | `core.ts:1317` in `_applyHeal` | `onHealApplied` | Gated on `direct && reachedFull`; the ctx must carry both, so the hook needs a payload richer than `{self}` — likely `vars: { direct, reachedFull }` plus a `{var}` condition. |
| `twinCenser` | `core.ts:1343` in `_twinCenserSplash` | `onHealCard` | Fires only for single-target heal CARDS, and routes back through `_applyHeal`, so guard against recursion. |
| `ossuaryBell` | `core.ts:1988` in `_resolveAttack` | `onMemberDamaged` | A **crossing** detector: needs `hpBefore` and `hpAfter` in the ctx. Fires on hits only — #99's A7 asserts a poison tick crossing the same threshold does NOT ring it. |
| `prayerBeads` | `core.ts:2094` in `_drawOne` | `onReshuffle` | Conditioned on `mp < maxMana && !channelActive()`. |
| `pilgrimsFlask` | `core.ts:2442` in `skipTurn` | `onRest` | Conditioned on `restRegenNow() > 0` — a Rest while channeling is not a real Rest. |

Also `core.ts:2540` — the drum-doubling **log text** branches on `hasRelic('warDrum')`
to pick between two strings. It fits neither hook kind. Either add a `logVariant` value
hook or accept it as a native; decide explicitly rather than leaving it.

## Remaining run-layer relics (3) — needs infrastructure that does not exist

`hagglersCharm` (`run.ts:1192`), `surgeonsThread` (`run.ts:642`, `:687`),
`beggarsBowl` (`run.ts:662`, `:663`, `:720`, `:721`, `:743`), plus `rustyCrown`'s gold
half (`run.ts:662`, `:720` — its combat half is already hooked).

**`Run` has no hook bus at all.** It has its own `hasRelic` (`run.ts:1176`,
`relics.includes`) and no `_hooks` index. This is not "declare a hook and go" — it means
building a second, smaller bus for the run layer with its own hook set:
`modifyShopPrice`, `modifyRecoveryPct`, `modifyFightGold`, `modifyRewardSize`. The same
`relics.json` `hooks` block can drive both; only the names differ.

## Hero passives (11) — none migrated

| Passive | Current site | Shape |
|---|---|---|
| Toxicologist (Ranger) | `core.ts:608` | value: `modifyMemberDamage`, `when {enemyHasStatus: "poison"}` |
| Grudge read (Tank) | `core.ts:609` | value: `modifyMemberDamage`, `add {floor {div [bankedDamage, GRUDGE_DIVISOR]}}` — **needs a `div` amount, which does not exist yet** |
| Grudge banking (Tank) | `core.ts:1976` | event: `onMemberDamaged`, with the `HOLD_LINE_BANK_MULT` doubling |
| Grudge reset (Tank) | `core.ts:2554` | event: after the auto — **no `onAfterAutoAttack` hook name exists yet** |
| Last Stand (Strongman) | `core.ts:1066` | value: `vetoDeath` with a per-MEMBER consumable (`m.lastStandUsed`), not the per-Game flag `consumes` currently supports |
| Dark Bargain (Warlock) | `core.ts:1117` | event: `onMemberDied`; needs an `$anyLiving(id)` selector that does not exist |
| Stunt Double (Showstopper) | `core.ts:1930` | **stays code.** It runs a speculative `_wardedDamage` preview then swaps the hit's recipient mid-loop. Declare it `{"passive": {"native": "stuntDouble"}}` so the validator knows it exists. |
| Riposte Master (Duelist) | `core.ts:1957` | value hook — see the ⚠️ below |
| Arcane Battery (Mage) | `core.ts:2073` | event: `onTurnStart`, `addStat charge +1 cap CHARGE_MAX` |
| Opening Act (Busker) | `core.ts:2077` | event: `onTurnStart`, `draw 1` |
| Feral Bond (Beast Warden) | `core.ts:2546` | a **consuming multiplier** on the strike — no hook shape supports this yet |

Plus the three `m.ability`-keyed damage bands at `core.ts:585` / `:588` / `:595`
(crescendo, rampage, callBoar). These key off the ABILITY, not the id, and #99's A8
asserts a hero who merely *learns* one does not inherit it — preserve that.

### ⚠️ The Duelist's Riposte Master must stay a value hook

`core.ts:1957` reads `const ripostes = m.riposteTurns > 0 || m.id === 'duelist';`.

**An earlier draft proposed replacing that with permanently-set `riposteTurns` and
called it behavior-preserving. It is not — it is a bug.** `riposteTurns` is a *timed*
field with four owners that would each break it:

- it **decays** every enemy turn and logs when it hits 0 — `core.ts:1756`
- the **death pipeline zeroes it** — `core.ts:1092`
- **Resurrect clears it** — `core.ts:1439`
- **En Garde plain-assigns it** — `abilities.json` → `enGarde`, `mode: "set"`

So one En Garde cast on the Duelist would overwrite her passive with a 3-turn timer and
permanently delete it when that expires. Keep it a `ripostes` value hook, or give her a
distinct non-decaying flag. Never overload the timed field.

## Vocabulary gaps this work will hit

None of these exist yet; each is needed by at least one item above:

- **`{div: [a, b]}` amount** — Grudge's `floor(banked / GRUDGE_DIVISOR)`.
- **Per-member consumables** — `ValueHook.consumes` writes a flag on the *Game*
  (`martyrUsed`). Last Stand needs it on the *member* (`m.lastStandUsed`).
- **`onAfterAutoAttack`** — for the Grudge reset.
- **A consuming multiplier hook** — Feral Bond multiplies the next strike and clears
  its flag; `{when, add}` cannot express it.
- **`$anyLiving(id)` selector** — Dark Bargain finds a living Warlock who is not the
  member who just died.
- **Richer event ctx** — `onHealApplied` needs `direct`/`reachedFull`,
  `onMemberDamaged` needs `hpBefore`/`hpAfter`.

## Acceptance criteria

- [ ] A `FIRED_HOOKS` cross-check so a declared-but-never-fired hook is a validation
      error. **Do this first** — it makes every later step self-checking.
- [ ] The 5 remaining engine relics migrated, each with its `_hookEvent` call site.
- [ ] The `core.ts:2540` drum log-variant decided explicitly.
- [ ] A run-layer hook set (`modifyShopPrice`, `modifyRecoveryPct`, `modifyFightGold`,
      `modifyRewardSize`) and the 3 run relics migrated.
- [ ] The 10 migratable hero passives on the bus; `stuntDouble` declared as a native.
- [ ] The vocabulary gaps above added as needed, each general rather than one-off.
- [ ] `npm test` green (especially #99's A7 relic and A8 passive suites, which pin every
      one of these with owned/not-owned and firing/non-firing controls).
- [ ] `tsx sim/trace.ts 30` diff empty after every step.
- [ ] `npm run sim -- 200 1` within 15% of the **pre-change** measurement on the same
      machine — compare against the current tree, not #100's 0.46s baseline, which was
      taken before content loading existed.

## Out of scope

- Relic and hero **metadata**, which already moved (`relics.json`, `members.json`).
- Card and ability effects, done in #101/#102.
- The two cosmetic inconsistencies in #107.

---

# Resolution (2026-07-20)

Landed as five commits, each with an empty `sim/trace.ts 30` diff against its parent and a
green suite. Final state: **zero `hasRelic` behaviour branches in `src/engine/`** (only the
definition, which the `{hasRelic}` condition and the run layer still use), **zero
`hasRelic` behaviour branches in `src/run.ts`** (only ownership queries, which are the
method's purpose), and **one `m.id === '…'` passive branch left**, `stuntDouble`, declared
as such.

1. **Hook seams + the never-fired trap.** Seven of the eight event hooks had NO call site.
   Added them, plus `test/content/hook-sites.test.ts`, which scans the real sources and
   asserts both directions — every declared name is fired, every fired name is declared.
   Source-scanned rather than a hand-written `FIRED_HOOKS` constant, because a hand-written
   list is one more thing that drifts from the seams it describes.
2. **The five remaining engine relics**, plus the drum log-variant decided as a boolean
   `narratesDoubleStrike` hook (a string-returning `logVariant` kind used once does not earn
   a third hook category).
3. **The run-layer bus** — four hooks, no compiled index (justified in `hooks.ts`), and
   static-amount enforcement so a run hook cannot silently read 0 from combat state.
4. **Seven passives** via `ownerSlot`, which is the mechanism the whole passive half rests
   on: a member-owned hook fires only for its own hero, which is exactly what
   `m.id === '…'` did by hand.
5. **The last three passives** (Last Stand, Dark Bargain, Feral Bond) plus
   `test/content/hook-bus.test.ts` for the machinery itself.

## Where this diverged from the plan, and why

- **`onMemberDamaged` became TWO seams.** `onMemberDamaged` fires before the death veto
  (where damage banking belongs — a lethal hit banks and `_killMember` then zeroes it,
  netting 0) and `onMemberSurvived` after it, for a member still standing (Ossuary Bell's
  actual contract). The issue described one hook; one hook would have left a Martyr-saved
  Tank holding a Grudge bank he does not hold today.
- **The three `m.ability`-keyed damage bands stayed code.** They key off the ABILITY, not
  the id, so they were never in scope for the "zero `m.id ===`" criterion — and A8 pins that
  a hero who merely learns the ability does not inherit the passive, which is the whole
  point of the distinction. Declared via `passiveNative: "abilityDamageBands"`.
- **`consumes` grew two siblings rather than being generalised.** `consumesMember`
  (require unset, then set — Last Stand) and `clearsMember` (require set, then unset —
  Feral Bond) are opposite polarities; one field doing both would read as a puzzle.
- **Value hooks gained `onApply`**, so a consuming veto narrates its own save. That is what
  let `_killMember` lose both its relic branch and its passive branch instead of trading one
  for the other.

## Two bugs this found, both silent

- **venomGland's rule was stated twice** — once as the `modifyPoisonTurns` hook and once as
  an inline `{if hasRelic}` in the poison ability. They did NOT double-count, because that
  ability uses `mode: keepStronger`, which bypasses `_applyPoison` entirely; verified
  empirically (5 turns bare, 6 owned, before and after) rather than reasoned about. Nothing
  made them agree, though, and a `when` added to the hook later would have desynced them.
  The keepStronger branch now applies the hook itself.
- **`{hasStatus}` silently read false for five tags.** A tag and the field holding it do not
  always share a name: `holdLine` lives in `holdLineTurns`, as do `guard`, `strike`, `mark`
  and `boar`. `m[tag]` returned undefined for all five, coercing to "no status" — valid
  content, valid tag, happy validator, gate that never fires. It bit immediately (the Tank's
  Hold the Line double-banking read as single) and was caught only because #99 pins the
  doubled NUMBER rather than asserting "it went up". No shipped content used any of the
  five, so main was never wrong — but everything was in place for it to be.

## What now guards this

Four checks that did not exist before, each verified by negative control rather than
assumed to work:

- a declared hook name with no call site fails the suite by name;
- a hook reading a `{var}` its seam does not provide is a startup error (this fired on the
  first run of commit 2, with five errors);
- a run-layer hook using a condition or a combat-state amount is a startup error;
- a passive with flavour text but no hooks and no declared native is a startup error (this
  fired immediately on the Berserker's Rage).

**Perf:** `npm run sim -- 200 1` at 0.57–0.58s against a 0.55–0.57s pre-change baseline on
the same machine — ~2%, well inside the 15% gate. The compiled index does its job; the
member hooks added to it cost nothing measurable.

## Deliberately left

- `stuntDouble` — a speculative `_wardedDamage` preview that swaps the hit's recipient
  mid-loop. No action vocabulary expresses that, and inventing one for a single hero would
  be worse than the declared exception.
- The ability-keyed damage bands, above.
