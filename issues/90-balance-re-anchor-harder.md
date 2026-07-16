# Issue 90 — Balance re-anchor: make the game hard again

- **Status:** 📋 Open
- **Phase:** post-demo (balance)   **Size:** L (multi-commit: measure → tune → re-pin)
- **Depends on:** —   **Blocks:** —
- **Addresses:** intake 2026-07-16 — "The game is way too easy now. Enemies die too fast and the
  player never really falls behind in MP."

## Why

The 2026-07-13 content cut (28 cards / 16 relics / 4 heroes) was **not** a rebalance — winrates were
allowed to drift, and the pinned sim baseline rose across the board to
`[200,200,195,194,191,188,184,180,170]`. The last real anchor was 2026-07-09: optimal **76.5%** /
average **29%** / poor **~0%**. Post-cut, the game plays too easy in two specific ways the maintainer
named:

1. **Enemies die too fast.** Enemy HP was eased hard in the 2026-07-07 pass (Gatewarden 64→35,
   Hexweaver 174→120, Devourer 172→120) to let a flawless line reach 75%, and the content cut then
   removed the dilution that partly offset it.
2. **The player never falls behind on MP** — which is a *pillar violation*, not a preference.
   [[balance-tuning-constraints]] #1 protects MP scarcity precisely so the player "should run out of
   MP in nearly every fight and *need* to Rest/skip to recover." That is no longer happening.

**Target feel:** wins should be **rare** — reserved for a genuinely good deck played extremely well.
Overshooting into "too hard" is **acceptable** so long as the game stays *technically winnable*
(some seed × deck × flawless line wins). Undershooting is not.

## Constraint change (supersedes [[balance-tuning-constraints]] #1)

**The MP economy is unlocked in the harder direction only**, mirroring how the healing constraint
already works:

| Lever | Tighten | Loosen |
|---|---|---|
| `MP_START`, `MP_MAX`, `SKIP_REGEN`, `SKIP_REGEN_DECAYED`, passive MP, Refresh/Font caps | ✅ | ❌ |
| Heal magnitudes / costs / coverage | ✅ | ❌ |

All other standing constraints hold: **magnitudes stay small single digits** (enemy HP *pools* are
exempt); round numbers are a **soft** preference, not a gate.

### Levers, in priority order

1. **Enemy HP / damage back up** — the most direct answer to "enemies die too fast".
   ⚠️ [[balance-pass-bosses-2026-07]] warns boss-HP levers are **steep** — move in small steps and
   re-measure.
2. **Tighten healing throughput** — heal amounts down / costs up / coverage narrowed.
3. **MP tightening** — per the constraint change above; restores the run-dry-every-fight pillar.
4. **New punishing content** — new enemy mechanics, harder nodes, curse relics. Adding pressure is
   preferred over subtracting player power where it makes the game more interesting.

**Gold economy is deliberately NOT a lever this pass** — maintainer's explicit call, despite it being
open under the standing constraints. Leave `GOLD_PER_FIGHT`, salaries, shop/relic prices, and
`EMPTY_SEAT_GOLD_BONUS` alone.

## Phases

### Phase 1 — Re-measure (no tuning). **Ends in a maintainer decision gate.**

Establish the true post-content-cut baseline before touching a single constant.

- [ ] Run the existing tier matrix — `npx tsx sim/experiments/balance-tiers.ts 1000` — over
      tier (OPTIMAL / AVERAGE / POOR / STICK) × party size (deploy cap 1/2/3), plus the forced
      solo line. **N = 1000 seeds, 95% CIs**, per the repo ground rules.
- [ ] Report a table: per tier × party size — full-run winrate, the three cumulative boss-survival
      milestones, deaths/boss, and scars/run. Include the same diagnostics the prior passes tracked,
      because they are what tell "too easy" apart from "too swingy".
- [ ] **Report MP starvation directly** — the intake claim "the player never falls behind in MP" is
      currently an *impression*, not a measurement, and it is the pillar this pass has to restore.
      Add whatever instrumentation the harness lacks (e.g. fraction of fights where the player hits
      0 MP; average turns spent MP-starved; Rest frequency). Pillar: the player runs dry in **nearly
      every fight**.
- [ ] Commit the harness/instrumentation work on its own.

> 🛑 **STOP HERE.** Phase 1 ends by presenting the numbers to the maintainer, who then sets the
> targets. **Do not pick targets yourself and do not start Phase 3.** If this issue is being worked
> by a subagent (the "implement all open issues" flow), the subagent's job **ends at the end of
> Phase 1** — report the table and stop. Targets are the maintainer's call, explicitly.

### Phase 2 — Maintainer sets targets

Maintainer fills in, from Phase 1's numbers:

| Tier | Baseline (Phase 1) | Target |
|---|---|---|
| Optimal (flawless, lean deck, trio) | _tbd_ | _tbd_ |
| Average | _tbd_ | _tbd_ |
| Poor | _tbd_ | _tbd_ |
| Solo (forced line) | _tbd_ | _tbd_ |

### Phase 3 — Tune to the targets

- [ ] Tune using the levers above, in priority order, re-measuring at N = 1000 between steps.
- [ ] **Winnability proof:** demonstrate at least one seed where an optimal line wins the full run.
      A 0% optimal tier is a **failure**, not an overshoot — "technically winnable" is the floor.
- [ ] Every damage-modifying change keeps `attackTargets()` telegraph == applied damage (the
      standing property test).
- [ ] Re-pin the sim baseline vector in `test/sim.test.ts` and widen/narrow the tier bands to the new
      anchor.
- [ ] `npm test` green; `npm run typecheck` clean.
- [ ] Land tuning and test-re-pin as their own commits (per `CLAUDE.md`: one logical unit per commit,
      never a catch-all).

## Implementation notes (anchors)

- `sim/experiments/balance-tiers.ts` — the tier × party-size matrix harness.
- `sim/profile.ts:70-105` — `STICK` / `OPTIMAL` / `AVERAGE` / `POOR`. **`STICK` is the pinned default
  and must stay byte-identical** (mistakeProb 0 draws no policy RNG — changing it invalidates the
  pinned vector for reasons unrelated to balance).
- `src/data/tuning.ts:186-189` — `MP_START`, `SKIP_REGEN`, `SKIP_REGEN_DECAYED`.
- `src/data/enemies.ts` — `ENEMY_HP_BY_FIGHT` and enemy damage.
- `src/data/tuning.ts` — heal magnitudes, `HEX_VULN_BY_SIZE`, `WARBAND_HP_PER_SEAT`, `LONE_WOLF_DMG`
  (the last three are the solo-only levers gated on `SMALL_PARTY_MAX`; trio is untouched by them).
- Prior-pass lessons worth re-reading before pulling anything:
  [[balance-pass-skill-tiers-2026-07-07]] (deck dilution is the dominant ~15pp skill lever under
  `HAND_SIZE` 3; a single muted tactic is ~0pp — model slips as whole wasted phases),
  [[balance-reanchor-2026-07-09]], [[playtest-2026-07-04]] (MP/hand/relic levers are extremely
  coarse — tune by magnitude, not by 1s).
- `toBattleConfig` **drops fields silently** ([[playtest-2026-07-04]]) — if a new tuning field does
  not seem to bite, check it survives the config conversion before concluding the lever is weak.

## Tests

- `test/sim.test.ts` — re-pin the baseline vector + tier bands (Phase 3).
- Any new enemy mechanic or curse relic gets its own engine test per `CLAUDE.md`, plus the
  telegraph-equality property test if it modifies damage.
- The winnability proof lands as a committed test//scenario, not just a number quoted in a summary.

## Out of scope

- **Gold economy** (explicitly deprioritized this pass — see above).
- **Loosening** MP or healing in any form.
- Content cuts/additions beyond punishing content added *as a balance tool*.
- The UI issues 88/89 — independent of this pass.
