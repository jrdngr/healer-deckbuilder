# Issue 22 — Relics phase B: rule-changers + curses (P9b)

- **Roadmap phase:** P9 (b) — **in-demo stretch / designated cut line**   **Size:** M
- **Depends on:** #21   **Blocks:** none
- **Addresses:** review §3.3, §3.5, §3.6; **Open Q1 (accepted: in-demo stretch, this is the cut line)**

## Why
The relics that bend the rules and the high-risk curses. These carry the most engine burden and the
most combo risk, so they are the explicit place to stop if the demo needs to shed scope.

## Scope / acceptance criteria
- [ ] **Aegis Font** (R 100g) — overhealing from **direct cast heals** converts to **Ward** (buffer,
      max 4, persists until consumed, larger replaces, independent of Shield, preview-visible).
      **Regen-tick overheal does NOT convert** (fixes the §3.6.3 broken combo).
- [ ] **First-Light Taper** (R 100g) — first card each turn costs 0 **if effective cost ≤ 2 AND not
      engine-tagged**; draw 1 fewer (hand 3→2). Extending the engine tag to Taper closes the
      free-Inspiration loop (§3.6.1) — **required**, not optional.
- [ ] **Dusk Chime** (R 100g) — once per fight, a telegraph totalling 6+ is **delayed one turn**.
- [ ] **Martyr's Icon** (R 100g) — first member death each fight becomes survival at 1 HP (statuses
      cleared, charge zeroed; wipe check sees the survival). Coexists with Martyr's Gift (card).
- [ ] **Curses** (25g, or Shrine "Accept a burden": random curse +50g; curses never in spoils,
      never forced):
  - **Pact of Silence** — you can no longer Rest; +1 passive MP/turn.
  - **Cracked Hourglass** — enrage on turn 8; Poison & Bolt +2 power; **Taunt's Defense
    unaffected**. Re-cost with #18 if poison is nerfed (+2 → 24 total, not 35).
  - **Rusty Crown** — all enemies +1 attack bonus; fight wins +40g (renumber vs P3's ~40g/fight).
- [ ] **Gates:** every curse within ±5% of the baseline full-run rate with its intended build; every
      rare rule-changer keeps boss winrate in-band (above ceiling = it solved the boss; below floor =
      trap).

## Implementation notes
- Ward: a new buffer distinct from Shield in `src/engine.ts`, preview-visible via `attackTargets()`;
  overheal conversion only on the **direct** heal path (not the regen tick at `engine.ts:452`).
- Taper: effective-cost display; extend the #03 engine tag (do not skip — this is the cross-system
  safety rule).
- Curses: Pact touches the Rest/Actions state; Cracked Hourglass threads a per-fight `enrageTurn`
  (default 11) and poison/bolt power; Rusty Crown extends `ENEMY_ATTACK_BONUS` at runtime.

## Tests (required per CLAUDE.md)
- Aegis Font converts only cast-heal overheal (not regen); Taper refuses engine-tagged & >2-cost
  cards; Dusk Chime delays once/fight; Martyr's Icon saves once/fight and the wipe check respects it;
  each curse's numbers; sim gates.

## Out of scope / follow-ups
- If the demo cuts scope, this whole issue defers post-demo (per Q1's accepted framing).
