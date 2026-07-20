// The relic / passive hook bus (#103).
//
// Relics and hero passives had NO dispatch table: each was an inline `hasRelic('x')` or
// `m.id === 'y'` guard at the seam it affected — 20 and 11 sites respectively. This
// replaces the declaration half of that with data, keeping the seams themselves in the
// engine where they belong.
//
// TWO HOOK KINDS, and the distinction is load-bearing:
//
//   VALUE hooks fold over the owned set and return a NUMBER or a BOOLEAN. They must be
//   PURE READS. `memberDamage` feeds `attackTargets()`'s telegraph preview, and a
//   side-effecting hook there would make the preview disagree with the damage applied —
//   the invariant core.ts:1445-1450 exists to protect. So a value hook is a restricted
//   `{when?, add?}` shape, deliberately NOT the full action DSL.
//
//   EVENT hooks run an action list and may do anything. They fire at moments, not
//   inside reads.
//
// PERFORMANCE. `memberDamage` is the hottest function in the sim. Hooks are compiled
// into a Map ONCE per Game, so the common case is a `Map.get` returning undefined —
// cheaper than the two `Set.has` calls it replaces. Nothing walks a generic interpreter
// tree on that path.
import type { Amount, Condition, Action } from './schema/dsl';
import { AmountSchema, ConditionSchema, ActionListSchema } from './schema/dsl';
import { z } from 'zod';

/** Value hooks: pure reads that adjust a number or veto a decision. */
export const VALUE_HOOKS = [
  'modifyMemberDamage', 'modifyEnemyAttack', 'modifyHealAmount', 'modifyCardHealBonus',
  'modifyPoisonTurns', 'modifyPassiveMp',
  // NOTE: no modifyMaxMana / modifyMaxHp. Thinking Cap and Roomy Tent apply in the
  // Game CONSTRUCTOR, before the hook index is compiled — they are config-time, not
  // runtime, and stay as constructor reads of config.relics.
  'allowRest', 'channelExempt', 'revealHidden', 'vetoDeath',
  // Flavour, not mechanics: the doubled-strike line reads differently when the War Drum
  // is what you own. A boolean answer rather than a string-returning `logVariant` hook
  // kind — one use does not justify a third hook category.
  'narratesDoubleStrike',
  // The Duelist's Riposte Master. A BOOLEAN HOOK, never a permanent `riposteTurns` — that
  // field is timed and has four other owners (it decays each enemy turn, the death
  // pipeline zeroes it, Resurrect clears it, and En Garde plain-assigns it), so parking a
  // permanent property in it would let a single En Garde cast overwrite her passive with a
  // 3-turn timer and delete it for good when that expired. Never overload a timed field to
  // express a permanent property.
  'ripostes',
  /**
   * The party-phase auto strike, AFTER memberDamage has produced the base. Deliberately a
   * second seam rather than part of memberDamage: this one is consuming (Feral Bond spends
   * its prime on the swing) and memberDamage feeds `attackTargets()`'s telegraph preview,
   * where a side effect would make the preview disagree with the damage applied.
   */
  'modifyAutoStrike',
] as const;
export type ValueHookName = (typeof VALUE_HOOKS)[number];

/**
 * Event hooks: fire-and-forget action lists.
 *
 * EVERY NAME HERE MUST HAVE A REAL `_hookEvent` CALL SITE. A declared hook with no seam
 * validates cleanly and then silently does nothing — the exact failure this bus exists to
 * prevent, and one the content validator cannot see. `test/content/hook-sites.test.ts`
 * scans the engine and run-layer sources and fails if a name here is never fired (or a
 * name is fired that is not listed here). Adding a hook is therefore a two-part change:
 * the seam AND the name.
 *
 * `onMemberDamaged` vs `onMemberSurvived` is a deliberate split, not a duplicate:
 * the first fires the instant HP drops, BEFORE the death veto (that is where damage
 * banking belongs); the second fires after the veto and only for a member still standing
 * (that is where survival payoffs belong). Collapsing them silently changes what a
 * Martyr-saved member ends the hit holding.
 */
export const EVENT_HOOKS = [
  'onAbilityCast', 'onHealApplied', 'onHealCard', 'onReshuffle',
  'onMemberDamaged', 'onMemberSurvived', 'onRest', 'onMemberDied', 'onTurnStart',
  // After a member's party-phase auto resolves. The Tank's Grudge SPENDS its bank on the
  // strike (memberDamage folds it in) and zeroes it here — a third site distinct from the
  // read and from the banking.
  'onAfterAutoAttack',
] as const;
export type EventHookName = (typeof EVENT_HOOKS)[number];

/**
 * The ctx contract: which `{var}` names each seam binds before it runs its hooks.
 *
 * This is the other half of the declared-but-never-fired problem. A seam that passes
 * `{hpBefore, hpAfter}` and a hook that reads `{var: "hpBefor"}` agree about nothing, and
 * the mistake is invisible at runtime — `{var}` on an unbound name evaluates to 0, so the
 * comparison just quietly stops being true. Declaring the payload here lets the validator
 * check hook bodies against it exactly the way it already checks card action lists against
 * their own bindings, so a typo is a startup error naming the nearest match.
 *
 * KEEP IN SYNC WITH THE SEAM. Adding a var to a `_hookEvent` call without adding it here
 * makes it unusable (the validator rejects reads of it); adding it here without the seam
 * makes it silently 0. `test/content/hook-sites.test.ts` catches the missing seam; only
 * review catches a payload that drifts.
 */
export const HOOK_CTX_VARS: Record<string, readonly string[]> = Object.freeze({
  onAbilityCast: [],
  onHealApplied: ['direct', 'reachedFull', 'healed', 'overheal'],
  onHealCard: ['amount'],
  onReshuffle: [],
  onMemberDamaged: ['dmg', 'hpBefore', 'hpAfter'],
  onMemberSurvived: ['dmg', 'hpBefore', 'hpAfter'],
  onRest: ['regen'],
  onMemberDied: [],
  onTurnStart: [],
  onAfterAutoAttack: ['dmg'],
});

export interface ValueHook {
  /** Gate. Absent means "always". */
  when?: Condition;
  /**
   * The three ways a value hook can move a number, applied in the order SET, MUL, ADD
   * regardless of the order the keys appear in JSON. Fixing the order matters because
   * `{set: 10, add: 2}` is otherwise ambiguous; declaring more than one is legal and
   * means exactly this pipeline. Most hooks use exactly one.
   */
  set?: Amount;
  mul?: Amount;
  add?: Amount;
  /** Returned as a boolean answer (allowRest, revealHidden, channelExempt, vetoDeath). */
  answer?: boolean;
  /** A once-per-fight consumable flag on the Game, for vetoDeath-style saves. */
  consumes?: string;
  /**
   * The same idea on the MEMBER rather than the Game: gate on the flag being falsy, then
   * set it true. Martyr's Icon is once per fight for the PARTY (`consumes: martyrUsed`);
   * the Strongman's Last Stand is once per fight for HIM, and a per-Game flag would let
   * one hero's save spend everybody's.
   */
  consumesMember?: string;
  /**
   * The opposite polarity: a member flag that GATES the hook while set and is cleared by
   * using it. Feral Bond is primed by the Boar's death and spent by the next swing.
   * Separate from `consumesMember` because "require unset, then set" and "require set,
   * then unset" are genuinely different, and one field doing both would read as a puzzle.
   */
  clearsMember?: string;
  /**
   * Actions to run when a CONSUMING hook is actually used — how a veto or a spent prime
   * narrates itself. Only the consuming dispatchers honour it; a plain value hook stays a
   * pure read, because `memberDamage` feeds the telegraph preview and must not act.
   */
  onApply?: Action[];
}

export interface HookBlock {
  [name: string]: ValueHook | Action[];
}

export const ValueHookSchema: z.ZodType<ValueHook> = z.strictObject({
  when: ConditionSchema.optional(),
  set: AmountSchema.optional(),
  mul: AmountSchema.optional(),
  add: AmountSchema.optional(),
  answer: z.boolean().optional(),
  consumes: z.string().optional(),
  consumesMember: z.string().optional(),
  clearsMember: z.string().optional(),
  onApply: ActionListSchema.optional(),
});

/**
 * RUN-LAYER value hooks. Same JSON shape, different bus: these are read by `Run`, which
 * has no `Game`, no members and no combat state — so their amounts must be STATIC
 * (a number or a {tune}/arithmetic tree over numbers). `evalStaticAmount` enforces that,
 * and the validator rejects a run hook whose amount reaches for game state, because at
 * runtime such an amount would silently evaluate to 0 and quietly zero a price or a gold
 * reward.
 *
 * Deliberately NOT indexed per-Run the way the combat hooks are indexed per-Game. That
 * index exists because `memberDamage` runs in the sim's hottest loop; the run layer reads
 * these a handful of times per screen, over a relic list that is never more than a dozen
 * long. A cache here would buy nothing and would need invalidating on every relic gain and
 * every save load — a real bug surface traded for no measurable win.
 */
export const RUN_HOOKS = [
  'modifyShopPrice', 'modifyRecoveryPct', 'modifyFightGold', 'modifyRewardSize',
] as const;
export type RunHookName = (typeof RUN_HOOKS)[number];
export const isRunHookName = (n: string): n is RunHookName =>
  (RUN_HOOKS as readonly string[]).includes(n);

export const HookBlockSchema = z.record(z.string(), z.union([ValueHookSchema, ActionListSchema]));

export const isValueHookName = (n: string): n is ValueHookName =>
  (VALUE_HOOKS as readonly string[]).includes(n);
export const isEventHookName = (n: string): n is EventHookName =>
  (EVENT_HOOKS as readonly string[]).includes(n);
export const ALL_HOOK_NAMES: readonly string[] = Object.freeze(
  [...VALUE_HOOKS, ...EVENT_HOOKS, ...RUN_HOOKS].sort(),
);

/**
 * One hook plus who declared it.
 *
 * `ownerSlot` is what makes hero passives expressible at all. A relic hook is owned by the
 * PARTY and applies to whoever the seam names; a passive is owned by ONE HERO and must
 * apply only to them — the inline form was literally `m.id === 'ranger'`. So a compiled
 * hook with an ownerSlot fires only when the seam's member is that slot, which reproduces
 * the id check exactly while keeping the id out of the engine. Relic hooks leave it
 * undefined and keep applying to everyone.
 *
 * Slot, not member id: slots are stable for the life of a Game, ids are not unique in
 * principle, and the seam already has a Member in hand.
 */
export interface CompiledValueHook { owner: string; ownerSlot?: number; hook: ValueHook }
export interface CompiledEventHook { owner: string; ownerSlot?: number; actions: Action[] }

/**
 * Hooks where a member-owned hook fires only when the event's member IS the owner —
 * "this happened TO me". The default for anything not listed is "this happened to
 * someone; I react", which is what Dark Bargain needs: the Warlock reacts to a death that
 * by definition is not his own. Getting this backwards makes a reaction passive
 * unreachable, since its own trigger excludes it.
 */
export const SUBJECT_SCOPED_HOOKS: readonly string[] = Object.freeze([
  'onTurnStart', 'onMemberDamaged', 'onMemberSurvived', 'onAbilityCast',
  'onAfterAutoAttack',
]);

export interface HookIndex {
  value: Map<string, CompiledValueHook[]>;
  event: Map<string, CompiledEventHook[]>;
}

/**
 * Build the per-Game index from the hook blocks of everything currently owned
 * (relics held, heroes fielded). Called once at construction.
 */
export function compileHooks(
  blocks: Array<{ owner: string; ownerSlot?: number; hooks?: HookBlock }>,
): HookIndex {
  const value = new Map<string, CompiledValueHook[]>();
  const event = new Map<string, CompiledEventHook[]>();
  for (const { owner, ownerSlot, hooks } of blocks) {
    if (!hooks) continue;
    for (const [name, def] of Object.entries(hooks)) {
      if (Array.isArray(def)) {
        const list = event.get(name) ?? [];
        list.push({ owner, ownerSlot, actions: def });
        event.set(name, list);
      } else {
        const list = value.get(name) ?? [];
        list.push({ owner, ownerSlot, hook: def });
        value.set(name, list);
      }
    }
  }
  return { value, event };
}

export const EMPTY_HOOKS: HookIndex = { value: new Map(), event: new Map() };
