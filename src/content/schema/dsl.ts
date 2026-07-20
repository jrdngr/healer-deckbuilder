// The content DSL's type vocabulary and zod schemas (#100).
//
// Three layers: amount expressions, selectors, conditions — composed by ops.
//
// A NOTE ON UNION STYLE. Ops are TAGGED (`{"op": "heal", …}`) so zod's
// discriminatedUnion applies and reports one precise error instead of every branch's
// failure. Amounts and conditions are KEY-DISCRIMINATED (`{"tune": "X"}`) because
// tagging them would double the size of every action list for no authoring benefit —
// `{"op":"tune","key":"POISON_BASE"}` is noise. zod's plain union gives poor errors for
// that shape, so `describeAmountBranch` below names the branch a value *meant* to be,
// and the validator uses it to produce the real diagnostic. zod remains the shape
// backstop; the readable error comes from the validator's own walk.
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const SELECTOR_NAMES = [
  '$target', '$self', '$targetOrSelf', '$allLiving', '$allLivingOther',
  '$mostWoundedOther', '$mostWounded', '$lowestHp', '$enemy',
] as const;
export type SelectorName = (typeof SELECTOR_NAMES)[number];

export type Selector = SelectorName | { sel: SelectorName; where: Condition };

// ---------------------------------------------------------------------------
// Amount expressions
// ---------------------------------------------------------------------------

export type Amount =
  | number
  | { tune: string }
  /** The RESOLVED card's field — Potent/Lingering/Efficient are already folded in. */
  | { card: string; else?: Amount }
  | { stat: string; of: Selector }
  /** memberDamage() — the live auto-damage seam. */
  | { auto: Selector }
  | { abilityPower: Selector }
  | { missingHp: Selector }
  | { var: string }
  | { enemyStat: string }
  /** An engine-level field: hymnBonus, refresh, bloodBannerTurns… */
  | { gameStat: string }
  /** Empty deploy seats — warband scales on them. */
  | { emptySeats: true }
  | { telegraphStat: string }
  /** vulnerableAmount() — post-Vulnerability scaling. */
  | { vulnerable: Amount }
  /** _bloodCost(card): the card's selfDamage plus the Sanguine surcharge. */
  | { bloodCost: true }
  /** _sanguineSurcharge() alone — bloodBanner pays it without a selfDamage field. */
  | { sanguineSurcharge: true }
  /** _holyHealBonus(card) — Reliquary of Light's per-Holy-card bonus. */
  | { holyHealBonus: true }
  | { sum: Amount[] }
  | { mul: Amount[] }
  | { max: Amount[] }
  | { min: Amount[] }
  /** A conditional amount — the arithmetic counterpart to the `if` op. */
  | { if: Condition; then: Amount; else: Amount }
  | { floor: Amount }
  // `atLeast`, not `min`: a second key named `min` would collide with the {min: […]}
  // form, making the shape ambiguous to both the interpreter and describeAmountBranch.
  | { clampMin: Amount; atLeast: number };

/** The single key that decides which amount branch an object is. */
export const AMOUNT_KEYS = [
  'tune', 'card', 'stat', 'auto', 'abilityPower', 'missingHp', 'var', 'enemyStat',
  'telegraphStat', 'gameStat', 'emptySeats', 'vulnerable', 'bloodCost', 'sanguineSurcharge', 'holyHealBonus',
  'sum', 'mul', 'max', 'min', 'floor', 'clampMin', 'if',
] as const;

/**
 * Which branch an amount value is trying to be, for diagnostics. Returns null when
 * the shape names no known branch (or more than one, which is always a mistake).
 */
export function describeAmountBranch(v: unknown): string | null {
  if (typeof v === 'number') return 'number';
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return null;
  const hits = AMOUNT_KEYS.filter((k) => k in (v as object));
  return hits.length === 1 ? hits[0] : null;
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export type Condition =
  | { hpFull: Selector }
  | { hpAtOrBelow: Amount; of: Selector }
  | { hpBelowFrac: number; of: Selector }
  | { alive: Selector }
  | { exists: Selector }
  | { hasStatus: string; on: Selector }
  | { enemyHasStatus: string }
  | { telegraph: 'damaging' | 'redirectable' | 'interruptible' }
  | { hasRelic: string }
  | { berserkerBandHot: Selector }
  /** The enemy has just been defeated — gates the trailing defeatEnemy emits. */
  | { won: true }
  /** The selector resolves to the acting member — drives possessive prose. */
  | { isSelf: Selector }
  /** The amount evaluates to something other than 0 — gates conditional emits. */
  | { nonZero: Amount }
  /** Fielded party size is at or below SMALL_PARTY_MAX (loneWolf, focusStone). */
  | { smallParty: true }
  /** This fight is against a boss (rustyCrown spares them). */
  | { bossFight: true }
  /** The card in scope has this type (reliquaryOfLight is Holy-only). */
  | { cardType: string }
  /** Exactly N cards have been played this phase (chantersIdol's first-card rule). */
  | { cardsPlayedIs: number }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] };

export const CONDITION_KEYS = [
  'hpFull', 'hpAtOrBelow', 'hpBelowFrac', 'alive', 'exists', 'hasStatus',
  'enemyHasStatus', 'telegraph', 'hasRelic', 'berserkerBandHot', 'won', 'isSelf', 'nonZero', 'smallParty', 'bossFight', 'cardType', 'cardsPlayedIs', 'not', 'all', 'any',
] as const;

// ---------------------------------------------------------------------------
// Status tags — the code/data contract. Every tag here needs a STATUS_WRITERS entry.
// ---------------------------------------------------------------------------

export const STATUS_TAGS = [
  'taunt', 'defense', 'guard', 'shield', 'regen', 'riposte', 'poison', 'vulnerable',
  'charge', 'stun', 'doom', 'strike', 'empower', 'drumPrimed', 'untargetable',
  'bloomBurst', 'mark', 'heroPoison', 'boar', 'holdLine', 'feralPrimed',
] as const;
export type StatusTag = (typeof STATUS_TAGS)[number];

/** How a status write combines with what is already standing. */
export const WRITE_MODES = ['set', 'add', 'mul', 'keepStronger', 'keepLonger', 'keepStrongerIfActive'] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

/** Engine-level (not per-member) buffs an op may write. */
export const PARTY_BUFF_FIELDS = [
  'hymnBonus', 'penanceBonus', 'penanceTurns', 'bloodBannerTurns', 'bigTopTurns',
  'woundTurns', 'lensArmed',
] as const;

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

export const OP_NAMES = [
  'heal', 'damage', 'strike', 'bloodPay', 'drain', 'status', 'clearStatus', 'consume',
  'enemyStatus', 'consumeEnemyStatus', 'partyBuff', 'draw', 'mp', 'primeRefresh',
  'revive', 'purge', 'telegraph', 'addStat', 'queueDelayed', 'regenEnded',
  'healCardSplash', 'let', 'letStr', 'letBool', 'collect', 'forEach', 'if', 'log', 'emit', 'native',
] as const;
export type OpName = (typeof OP_NAMES)[number];

export type Action =
  | { op: 'heal'; to: Selector; amount: Amount; direct?: boolean; splash?: boolean; bind?: string }
  | { op: 'damage'; amount: Amount; source?: string; nuke?: boolean; bind?: string }
  | { op: 'strike'; from: Selector; amount: Amount; times?: Amount; label?: string }
  | { op: 'bloodPay'; from: Selector; amount: Amount; bind?: string }
  | { op: 'drain'; from: Selector; amount: Amount; bind?: string }
  | { op: 'status'; on: Selector; tag: StatusTag; amount?: Amount; turns?: Amount; mode: WriteMode }
  | { op: 'clearStatus'; on: Selector; tags: StatusTag[] }
  | { op: 'consume'; on: Selector; tag: 'regen'; bind: string; deferEndHook?: boolean }
  | { op: 'enemyStatus'; tag: string; amount?: Amount; turns?: Amount; mode: WriteMode }
  | { op: 'consumeEnemyStatus'; tag: string; bind: string }
  | { op: 'partyBuff'; field: string; amount?: Amount; turns?: Amount; mode: WriteMode }
  | { op: 'draw'; count: Amount; bind?: string }
  | { op: 'mp'; delta: Amount; bind?: string }
  | { op: 'primeRefresh'; amount: Amount; turns: Amount; cap: Amount }
  | { op: 'revive'; on: Selector; hpFraction: number }
  | { op: 'purge'; scope: 'party'; bind?: string }
  | { op: 'telegraph'; mode: 'reduceDamage' | 'retargetTo' | 'stun'; amount?: Amount; to?: Selector; floor?: number }
  | { op: 'addStat'; on: Selector; stat: string; amount: Amount; cap?: Amount }
  | { op: 'queueDelayed'; kind: string }
  | { op: 'regenEnded'; on: Selector; consumed: boolean }
  | { op: 'healCardSplash'; primary: Selector; amount: Amount }
  | { op: 'let'; bind: string; value: Amount }
  | { op: 'letStr'; bind: string; value: string }
  | { op: 'letBool'; bind: string; when: Condition }
  | { op: 'collect'; bind: string; over: Selector; where?: Condition; pick: string }
  | { op: 'forEach'; over: Selector; as?: string; do: Action[] }
  | { op: 'if'; when: Condition; then: Action[]; else?: Action[] }
  | { op: 'log'; text: string; kind: string }
  | { op: 'emit'; kind: string; [key: string]: unknown }
  | { op: 'native'; fn: string };

// ---------------------------------------------------------------------------
// zod schemas — the shape backstop. Recursive via z.lazy.
// ---------------------------------------------------------------------------

const SelectorName_ = z.enum(SELECTOR_NAMES);

export const SelectorSchema: z.ZodType<Selector> = z.lazy(() => z.union([
  SelectorName_,
  z.strictObject({ sel: SelectorName_, where: ConditionSchema }),
]));

export const AmountSchema: z.ZodType<Amount> = z.lazy(() => z.union([
  z.number(),
  z.strictObject({ tune: z.string() }),
  z.strictObject({ card: z.string(), else: AmountSchema.optional() }),
  z.strictObject({ stat: z.string(), of: SelectorSchema }),
  z.strictObject({ auto: SelectorSchema }),
  z.strictObject({ abilityPower: SelectorSchema }),
  z.strictObject({ missingHp: SelectorSchema }),
  z.strictObject({ var: z.string() }),
  z.strictObject({ enemyStat: z.string() }),
  z.strictObject({ gameStat: z.string() }),
  z.strictObject({ emptySeats: z.literal(true) }),
  z.strictObject({ telegraphStat: z.string() }),
  z.strictObject({ vulnerable: AmountSchema }),
  z.strictObject({ bloodCost: z.literal(true) }),
  z.strictObject({ sanguineSurcharge: z.literal(true) }),
  z.strictObject({ holyHealBonus: z.literal(true) }),
  z.strictObject({ sum: z.array(AmountSchema) }),
  z.strictObject({ mul: z.array(AmountSchema) }),
  z.strictObject({ max: z.array(AmountSchema) }),
  z.strictObject({ min: z.array(AmountSchema) }),
  z.strictObject({ if: ConditionSchema, then: AmountSchema, else: AmountSchema }),
  z.strictObject({ floor: AmountSchema }),
  z.strictObject({ clampMin: AmountSchema, atLeast: z.number() }),
]));

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() => z.union([
  z.strictObject({ hpFull: SelectorSchema }),
  z.strictObject({ hpAtOrBelow: AmountSchema, of: SelectorSchema }),
  z.strictObject({ hpBelowFrac: z.number(), of: SelectorSchema }),
  z.strictObject({ alive: SelectorSchema }),
  z.strictObject({ exists: SelectorSchema }),
  z.strictObject({ hasStatus: z.string(), on: SelectorSchema }),
  z.strictObject({ enemyHasStatus: z.string() }),
  z.strictObject({ telegraph: z.enum(['damaging', 'redirectable', 'interruptible']) }),
  z.strictObject({ hasRelic: z.string() }),
  z.strictObject({ berserkerBandHot: SelectorSchema }),
  z.strictObject({ won: z.literal(true) }),
  z.strictObject({ isSelf: SelectorSchema }),
  z.strictObject({ nonZero: AmountSchema }),
  z.strictObject({ smallParty: z.literal(true) }),
  z.strictObject({ bossFight: z.literal(true) }),
  z.strictObject({ cardType: z.string() }),
  z.strictObject({ cardsPlayedIs: z.number() }),
  z.strictObject({ not: ConditionSchema }),
  z.strictObject({ all: z.array(ConditionSchema) }),
  z.strictObject({ any: z.array(ConditionSchema) }),
]));

const Mode = z.enum(WRITE_MODES);

export const ActionSchema: z.ZodType<Action> = z.lazy(() => z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('heal'), to: SelectorSchema, amount: AmountSchema, direct: z.boolean().optional(), splash: z.boolean().optional(), bind: z.string().optional() }),
  z.strictObject({ op: z.literal('damage'), amount: AmountSchema, source: z.string().optional(), nuke: z.boolean().optional(), bind: z.string().optional() }),
  z.strictObject({ op: z.literal('strike'), from: SelectorSchema, amount: AmountSchema, times: AmountSchema.optional(), label: z.string().optional() }),
  z.strictObject({ op: z.literal('bloodPay'), from: SelectorSchema, amount: AmountSchema, bind: z.string().optional() }),
  z.strictObject({ op: z.literal('drain'), from: SelectorSchema, amount: AmountSchema, bind: z.string().optional() }),
  z.strictObject({ op: z.literal('status'), on: SelectorSchema, tag: z.enum(STATUS_TAGS), amount: AmountSchema.optional(), turns: AmountSchema.optional(), mode: Mode }),
  z.strictObject({ op: z.literal('clearStatus'), on: SelectorSchema, tags: z.array(z.enum(STATUS_TAGS)) }),
  z.strictObject({ op: z.literal('consume'), on: SelectorSchema, tag: z.literal('regen'), bind: z.string(), deferEndHook: z.boolean().optional() }),
  z.strictObject({ op: z.literal('enemyStatus'), tag: z.string(), amount: AmountSchema.optional(), turns: AmountSchema.optional(), mode: Mode }),
  z.strictObject({ op: z.literal('consumeEnemyStatus'), tag: z.string(), bind: z.string() }),
  z.strictObject({ op: z.literal('partyBuff'), field: z.string(), amount: AmountSchema.optional(), turns: AmountSchema.optional(), mode: Mode }),
  z.strictObject({ op: z.literal('draw'), count: AmountSchema, bind: z.string().optional() }),
  z.strictObject({ op: z.literal('mp'), delta: AmountSchema, bind: z.string().optional() }),
  z.strictObject({ op: z.literal('primeRefresh'), amount: AmountSchema, turns: AmountSchema, cap: AmountSchema }),
  z.strictObject({ op: z.literal('revive'), on: SelectorSchema, hpFraction: z.number() }),
  z.strictObject({ op: z.literal('purge'), scope: z.literal('party'), bind: z.string().optional() }),
  z.strictObject({ op: z.literal('telegraph'), mode: z.enum(['reduceDamage', 'retargetTo', 'stun']), amount: AmountSchema.optional(), to: SelectorSchema.optional(), floor: z.number().optional() }),
  z.strictObject({ op: z.literal('addStat'), on: SelectorSchema, stat: z.string(), amount: AmountSchema, cap: AmountSchema.optional() }),
  z.strictObject({ op: z.literal('queueDelayed'), kind: z.string() }),
  z.strictObject({ op: z.literal('regenEnded'), on: SelectorSchema, consumed: z.boolean() }),
  z.strictObject({ op: z.literal('healCardSplash'), primary: SelectorSchema, amount: AmountSchema }),
  z.strictObject({ op: z.literal('let'), bind: z.string(), value: AmountSchema }),
  z.strictObject({ op: z.literal('letStr'), bind: z.string(), value: z.string() }),
  z.strictObject({ op: z.literal('letBool'), bind: z.string(), when: ConditionSchema }),
  z.strictObject({ op: z.literal('collect'), bind: z.string(), over: SelectorSchema, where: ConditionSchema.optional(), pick: z.string() }),
  z.strictObject({ op: z.literal('forEach'), over: SelectorSchema, as: z.string().optional(), do: z.array(ActionSchema) }),
  z.strictObject({ op: z.literal('if'), when: ConditionSchema, then: z.array(ActionSchema), else: z.array(ActionSchema).optional() }),
  z.strictObject({ op: z.literal('log'), text: z.string(), kind: z.string() }),
  // `emit` carries a typed GameEvent payload whose keys vary by kind, so it is the one
  // op that cannot be strict. The validator cross-checks kind + payload separately.
  z.looseObject({ op: z.literal('emit'), kind: z.string() }),
  z.strictObject({ op: z.literal('native'), fn: z.string() }),
]) as unknown as z.ZodType<Action>);

export const ActionListSchema = z.array(ActionSchema);
