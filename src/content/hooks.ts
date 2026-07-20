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
] as const;
export type EventHookName = (typeof EVENT_HOOKS)[number];

export interface ValueHook {
  /** Gate. Absent means "always". */
  when?: Condition;
  /** Added to the running value. */
  add?: Amount;
  /** Returned as a boolean answer (allowRest, revealHidden, channelExempt, vetoDeath). */
  answer?: boolean;
  /** A once-per-fight consumable flag on the Game, for vetoDeath-style saves. */
  consumes?: string;
}

export interface HookBlock {
  [name: string]: ValueHook | Action[];
}

export const ValueHookSchema: z.ZodType<ValueHook> = z.strictObject({
  when: ConditionSchema.optional(),
  add: AmountSchema.optional(),
  answer: z.boolean().optional(),
  consumes: z.string().optional(),
});

export const HookBlockSchema = z.record(z.string(), z.union([ValueHookSchema, ActionListSchema]));

export const isValueHookName = (n: string): n is ValueHookName =>
  (VALUE_HOOKS as readonly string[]).includes(n);
export const isEventHookName = (n: string): n is EventHookName =>
  (EVENT_HOOKS as readonly string[]).includes(n);
export const ALL_HOOK_NAMES: readonly string[] = Object.freeze([...VALUE_HOOKS, ...EVENT_HOOKS].sort());

/** One hook plus the id that declared it, for diagnostics and consumable flags. */
export interface CompiledValueHook { owner: string; hook: ValueHook }
export interface CompiledEventHook { owner: string; actions: Action[] }

export interface HookIndex {
  value: Map<string, CompiledValueHook[]>;
  event: Map<string, CompiledEventHook[]>;
}

/**
 * Build the per-Game index from the hook blocks of everything currently owned
 * (relics held, heroes fielded). Called once at construction.
 */
export function compileHooks(blocks: Array<{ owner: string; hooks?: HookBlock }>): HookIndex {
  const value = new Map<string, CompiledValueHook[]>();
  const event = new Map<string, CompiledEventHook[]>();
  for (const { owner, hooks } of blocks) {
    if (!hooks) continue;
    for (const [name, def] of Object.entries(hooks)) {
      if (Array.isArray(def)) {
        const list = event.get(name) ?? [];
        list.push({ owner, actions: def });
        event.set(name, list);
      } else {
        const list = value.get(name) ?? [];
        list.push({ owner, hook: def });
        value.set(name, list);
      }
    }
  }
  return { value, event };
}

export const EMPTY_HOOKS: HookIndex = { value: new Map(), event: new Map() };
