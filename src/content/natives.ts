// The `native` escape hatch registry (#100, populated in #102).
//
// A handful of effect arms are deliberately NOT modelled in the DSL, because doing so
// would warp the schema around a shape used exactly once. They live here as ordinary
// TypeScript and content references them by name: {"op": "native", "fn": "hexApply"}.
//
// The validator enforces the registry in BOTH directions: every referenced fn must
// exist here, and every key here must be referenced by some content. An unreferenced
// native is dead code that looks alive.
//
// FINAL COUNT: two, exactly as #99's A2 audit predicted — and zero of the 32 CARD arms
// needed one. Both survivors are ability arms whose shape is used once:
//   - hex   an array-table lookup indexed by fielded party size
//   - taunt a config-mode AND MP-gated telegraph retarget with its own extra log line
// If this file grows past ~6 entries, that is a signal the op vocabulary is missing
// something, not that the hatch is working.
//
// IMPORTS: only TYPES from the engine, and constants from data/tuning DIRECTLY rather
// than through the constants barrel — the barrel re-exports content, so importing it
// here would close a cycle (content -> constants -> content).
import type { NativeFn } from './interpreter/run';
import {
  HEX_TURNS, HEX_VULN_BY_SIZE, HEX_VULN_PER_POWER,
  TAUNT_TURNS, DEFENSE_AMOUNT, DEFENSE_TURNS, TAUNT_RETARGET_SURCHARGE,
} from '../data/tuning';

export const NATIVES: Record<string, NativeFn> = {
  /**
   * The Warlock's Evil Eye (effects.ts:527-540). Native because the magnitude is an
   * ARRAY-TABLE lookup indexed by fielded party size — HEX_VULN_BY_SIZE[min(size, len-1)]
   * — a shape used exactly once. Expressing it would mean inventing a table/index
   * amount form for a single arm.
   */
  hexApply: (game, ctx) => {
    const m = ctx.self;
    if (!m) return;
    const size = game.fieldedPartySize();
    const base = HEX_VULN_BY_SIZE[Math.min(size, HEX_VULN_BY_SIZE.length - 1)] ?? 0;
    const vuln = Math.max(0, base + m.abilityPower * HEX_VULN_PER_POWER);
    // Re-hexing refreshes the duration and keeps the stronger value (no stacking).
    game.enemy.vulnerable = Math.max(game.enemy.vulnerable, vuln);
    game.enemy.vulnerableTurns = HEX_TURNS;
    game._log(
      `${m.name} gives the enemy the Evil Eye — +${Math.round(vuln * 100)}% damage taken for ${HEX_TURNS} turns.`,
      'status',
    );
  },

  /**
   * The Tank's Taunt (effects.ts:491-512). Native because of the retarget branch: it
   * conditions on a CONFIG MODE and on available MP, then spends MP, mutates the
   * standing telegraph, and emits its own extra log line before the main one.
   *
   * Note the main log prints the BASE Defense constant rather than the abilityPower-
   * scaled value it actually applies. That is faithful to the arm — see #107, which
   * proposes fixing it deliberately rather than letting it drift here.
   */
  tauntApply: (game, ctx) => {
    const m = ctx.self;
    if (!m) return;
    // Floored at 0 (DR1): a Broken member's negative power may zero the bundled
    // Defense, but must never turn it into bonus incoming damage.
    const strength = Math.max(0, DEFENSE_AMOUNT + m.abilityPower);
    m.defenseAmount = m.defense > 0 ? Math.max(m.defenseAmount, strength) : strength;
    m.taunt = TAUNT_TURNS;
    m.defense = DEFENSE_TURNS;
    // Future telegraphs auto-aim at the taunter via _pickPrimary. The STANDING blow is
    // the costly part: it is not redirected for free.
    if (game.tauntRetargetMode === 'surcharge'
        && game._standingTelegraphRedirectable(m.slot)
        && game.mp >= TAUNT_RETARGET_SURCHARGE) {
      game.mp -= TAUNT_RETARGET_SURCHARGE;
      game._retargetTelegraphTo(m.slot);
      game._log(`${m.name} wrenches the incoming attack onto itself (-${TAUNT_RETARGET_SURCHARGE} MP).`, 'status');
    }
    // Print the APPLIED strength, not the base constant (#107): an ability-power
    // upgrade has to be visible in the log exactly when it is doing its job.
    game._log(`${m.name} Taunts and braces (Defense ${strength}) for ${TAUNT_TURNS} enemy turns.`, 'status');
    game._emit({ kind: 'taunt', slot: m.slot, turns: TAUNT_TURNS });
  },
};

export const NATIVE_NAMES: readonly string[] = Object.freeze(Object.keys(NATIVES).sort());
