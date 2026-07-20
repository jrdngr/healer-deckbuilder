// The action interpreter (#100).
//
// Executes a DSL action list against a live Game. This is what replaces the
// `switch (card.id)` and `switch (ability)` arms in #101/#102.
//
// IMPORT DISCIPLINE: this module imports only TYPES from the engine, never values.
// src/data/cards.ts:335 documents a prior TDZ import-cycle bite (#84) in this
// dependency layer, and a value import here would recreate it — the engine imports
// content, so content must not import the engine back.
import type { Game, Member } from '../../engine';
import type { Action, Amount, Condition, Selector, StatusTag, WriteMode } from '../schema/dsl';
import { renderTemplate } from './template';
import { TUNING } from '../../data/tuning-table';

/** What an action list is running against. */
export interface ActionCtx {
  /** The resolved card, when a card is being played (upgrades already folded in). */
  card?: Record<string, unknown> & { id: string; name: string };
  /** The acting member — an ability's caster. */
  self?: Member;
  /** The picked slot for a `target: 'single'` play. */
  target?: number | null;
  /** Runtime bindings created by `let`/`letStr`/`bind`. */
  vars: Record<string, unknown>;
}

/** A native implementation, for the handful of arms the DSL deliberately does not model. */
export type NativeFn = (game: Game, ctx: ActionCtx) => void;

// ---------------------------------------------------------------------------
// Status writers — the code half of the "status effects stay in code, referenced
// by tag" contract. Every StatusTag needs an entry; the validator enforces that.
// ---------------------------------------------------------------------------

interface StatusWrite { amount?: number; turns?: number; mode: WriteMode }

function combine(existing: number, next: number, mode: WriteMode, active: boolean): number {
  switch (mode) {
    case 'set': return next;
    case 'add': return existing + next;
    case 'mul': return existing * next;
    case 'keepStronger': return Math.max(existing, next);
    case 'keepLonger': return Math.max(existing, next);
    // The `x.defense > 0 ? max(x.defenseAmount, N) : N` idiom shared by taunt,
    // shieldWall, holdLine, consecration and sharpen: a stronger bonus is kept only
    // while its timer is still running; an expired one is overwritten.
    case 'keepStrongerIfActive': return active ? Math.max(existing, next) : next;
    default: return next;
  }
}

export const STATUS_WRITERS: Record<StatusTag, (m: Member, w: StatusWrite) => void> = {
  taunt: (m, w) => { m.taunt = combine(m.taunt, w.turns ?? 0, w.mode, m.taunt > 0); },
  defense: (m, w) => {
    m.defenseAmount = combine(m.defenseAmount, w.amount ?? 0, w.mode, m.defense > 0);
    m.defense = Math.max(m.defense, w.turns ?? 0);
  },
  guard: (m, w) => { m.guardDR = w.amount ?? 0; m.guardTurns = w.turns ?? 0; },
  shield: (m, w) => { m.shield = true; m.shieldTurns = combine(m.shieldTurns, w.turns ?? 0, w.mode, true); },
  regen: (m, w) => { m.regen = combine(m.regen, w.amount ?? 0, w.mode, m.regen > 0); },
  riposte: (m, w) => {
    if (w.turns != null) m.riposteTurns = combine(m.riposteTurns, w.turns, w.mode, m.riposteTurns > 0);
    else m.riposte = true;
  },
  poison: (m, w) => { m.poison += w.amount ?? 0; m.poisonTurns = Math.max(m.poisonTurns, w.turns ?? 0); },
  heroPoison: (m, w) => { m.poison += w.amount ?? 0; m.poisonTurns = Math.max(m.poisonTurns, w.turns ?? 0); },
  charge: (m, w) => { m.charge = combine(m.charge, w.amount ?? 0, w.mode, true); },
  strike: (m, w) => {
    m.strikeBonus = combine(m.strikeBonus, w.amount ?? 0, w.mode, m.strikeTurns > 0);
    m.strikeTurns = w.turns ?? m.strikeTurns;
  },
  empower: (m, w) => { m.empowerBonus = w.amount ?? 0; },
  drumPrimed: (m) => { m.drumPrimed = true; },
  feralPrimed: (m) => { m.feralPrimed = true; },
  untargetable: (m, w) => { m.untargetable = combine(m.untargetable, w.turns ?? 0, w.mode, true); },
  bloomBurst: (m, w) => { m.bloomBurst = w.amount ?? 0; },
  mark: (m, w) => { m.markTurns = w.turns ?? 0; },
  boar: (m, w) => { m.boarHp = w.amount ?? 0; m.boarTurns = w.turns ?? 0; },
  holdLine: (m, w) => { m.holdLineTurns = w.turns ?? 0; },
  // Enemy-side tags are written by `enemyStatus`, never per-member; these exist so the
  // tag vocabulary is one closed set. Reaching them via `status` is a content bug.
  vulnerable: () => { throw new Error('vulnerable is an enemy status — use the enemyStatus op'); },
  stun: () => { throw new Error('stun is a telegraph effect — use the telegraph op'); },
  doom: () => { throw new Error('doom is an enemy status — use the enemyStatus op'); },
};

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

function anchor(game: Game, ctx: ActionCtx): Member {
  return ctx.self ?? game.members[(ctx.target ?? 0) as number];
}

/** Resolve a selector to the members it names. `$enemy` yields []. */
export function resolveSelector(game: Game, sel: Selector, ctx: ActionCtx): Member[] {
  if (typeof sel !== 'string') {
    const base = resolveSelector(game, sel.sel, ctx);
    return base.filter((m) => evalCondition(game, sel.where, { ...ctx, vars: { ...ctx.vars, it: m } }, m));
  }
  switch (sel) {
    case '$target': {
      const m = ctx.target != null ? game.members[ctx.target] : undefined;
      return m ? [m] : [];
    }
    case '$self': return ctx.self ? [ctx.self] : [];
    case '$targetOrSelf': {
      const t = ctx.target != null ? game.members[ctx.target] : undefined;
      return t && t.alive ? [t] : (ctx.self ? [ctx.self] : []);
    }
    case '$allLiving': return game.livingMembers();
    case '$allLivingOther': {
      const a = anchor(game, ctx);
      return game.livingMembers().filter((m) => m.slot !== a.slot);
    }
    case '$mostWoundedOther': {
      const other = game._mostWoundedOther(anchor(game, ctx));
      return other ? [other] : [];
    }
    // drainLife's reduce, SEEDED WITH THE CASTER (effects.ts:687): with nobody
    // wounded the caster is the answer, not "nobody". The tie-break is first-wins
    // over livingMembers order, exactly as the reduce behaves.
    case '$mostWounded': {
      const a = anchor(game, ctx);
      return [game.livingMembers().reduce((x, y) => ((y.maxHP - y.hp) > (x.maxHP - x.hp) ? y : x), a)];
    }
    case '$lowestHp': {
      const slot = game._lowestHpSlot();
      return slot == null ? [] : [game.members[slot]];
    }
    case '$enemy': return [];
    default: return [];
  }
}

/** The single member a selector names, or undefined. */
export function resolveOne(game: Game, sel: Selector, ctx: ActionCtx): Member | undefined {
  return resolveSelector(game, sel, ctx)[0];
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

export function evalAmount(game: Game, amt: Amount, ctx: ActionCtx): number {
  if (typeof amt === 'number') return amt;
  const a = amt as Record<string, unknown>;

  if ('tune' in a) return TUNING[a.tune as string] ?? 0;
  if ('card' in a) {
    const v = ctx.card?.[a.card as string];
    if (typeof v === 'number') return v;
    return a.else !== undefined ? evalAmount(game, a.else as Amount, ctx) : 0;
  }
  if ('var' in a) {
    const v = ctx.vars[a.var as string];
    return typeof v === 'number' ? v : 0;
  }
  if ('stat' in a) {
    const m = resolveOne(game, a.of as Selector, ctx);
    const v = m ? (m as unknown as Record<string, unknown>)[a.stat as string] : 0;
    return typeof v === 'number' ? v : 0;
  }
  if ('auto' in a) {
    const m = resolveOne(game, a.auto as Selector, ctx);
    return m ? game.memberDamage(m) : 0;
  }
  if ('abilityPower' in a) {
    const m = resolveOne(game, a.abilityPower as Selector, ctx);
    return m ? m.abilityPower : 0;
  }
  if ('missingHp' in a) {
    const m = resolveOne(game, a.missingHp as Selector, ctx);
    return m ? Math.max(0, m.maxHP - m.hp) : 0;
  }
  if ('enemyStat' in a) {
    const v = (game.enemy as unknown as Record<string, unknown>)[a.enemyStat as string];
    return typeof v === 'number' ? v : 0;
  }
  if ('telegraphStat' in a) {
    const t = game.telegraph as unknown as Record<string, unknown> | null;
    const v = t ? t[a.telegraphStat as string] : 0;
    return typeof v === 'number' ? v : 0;
  }
  if ('vulnerable' in a) return game.vulnerableAmount(evalAmount(game, a.vulnerable as Amount, ctx));
  if ('bloodCost' in a) return ctx.card ? game._bloodCost(ctx.card as never) : 0;
  if ('sanguineSurcharge' in a) return game._sanguineSurcharge();
  if ('holyHealBonus' in a) return ctx.card ? game._holyHealBonus(ctx.card as never) : 0;
  if ('sum' in a) return (a.sum as Amount[]).reduce<number>((s, x) => s + evalAmount(game, x, ctx), 0);
  if ('mul' in a) return (a.mul as Amount[]).reduce<number>((s, x) => s * evalAmount(game, x, ctx), 1);
  if ('max' in a) return Math.max(...(a.max as Amount[]).map((x) => evalAmount(game, x, ctx)));
  // clampMin BEFORE min: they are distinct forms and clampMin must not be mistaken
  // for the variadic min. (Its second field is `atLeast` precisely so they cannot
  // share a key, but the ordering is kept explicit anyway.)
  if ('clampMin' in a) return Math.max(a.atLeast as number, evalAmount(game, a.clampMin as Amount, ctx));
  if ('min' in a) return Math.min(...(a.min as Amount[]).map((x) => evalAmount(game, x, ctx)));
  if ('floor' in a) return Math.floor(evalAmount(game, a.floor as Amount, ctx));
  return 0;
}

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export function evalCondition(game: Game, cond: Condition, ctx: ActionCtx, subject?: Member): boolean {
  const c = cond as Record<string, unknown>;
  const pick = (sel: unknown): Member | undefined =>
    subject ?? resolveOne(game, sel as Selector, ctx);

  if ('not' in c) return !evalCondition(game, c.not as Condition, ctx, subject);
  if ('all' in c) return (c.all as Condition[]).every((x) => evalCondition(game, x, ctx, subject));
  if ('any' in c) return (c.any as Condition[]).some((x) => evalCondition(game, x, ctx, subject));
  if ('hpFull' in c) { const m = pick(c.hpFull); return !!m && m.hp >= m.maxHP; }
  if ('alive' in c) { const m = pick(c.alive); return !!m && m.alive; }
  if ('exists' in c) return resolveSelector(game, c.exists as Selector, ctx).length > 0;
  if ('hpAtOrBelow' in c) {
    const m = pick(c.of); return !!m && m.hp <= evalAmount(game, c.hpAtOrBelow as Amount, ctx);
  }
  if ('hpBelowFrac' in c) {
    const m = pick(c.of); return !!m && m.hp < m.maxHP * (c.hpBelowFrac as number);
  }
  if ('hasStatus' in c) {
    const m = pick(c.on);
    if (!m) return false;
    const v = (m as unknown as Record<string, unknown>)[c.hasStatus as string];
    return typeof v === 'number' ? v > 0 : Boolean(v);
  }
  if ('enemyHasStatus' in c) {
    const v = (game.enemy as unknown as Record<string, unknown>)[c.enemyHasStatus as string];
    return typeof v === 'number' ? v > 0 : Boolean(v);
  }
  if ('hasRelic' in c) return game.hasRelic(c.hasRelic as never);
  if ('berserkerBandHot' in c) {
    const m = pick(c.berserkerBandHot);
    return !!m && m.hp <= game.berserkerThresholds()[1];
  }
  if ('telegraph' in c) {
    const t = game.telegraph;
    switch (c.telegraph) {
      case 'damaging': return !!t && !t.cast && t.damage > 0;
      case 'redirectable': return !!t && !t.cast && !t.hidden && !t.ignoreTaunt && t.targets.length > 0;
      case 'interruptible': return !!t && !t.stunned;
      default: return false;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Ops
// ---------------------------------------------------------------------------

/** Render a log/emit template against the live scope. */
function render(game: Game, tpl: string, ctx: ActionCtx): string {
  const target = ctx.target != null ? game.members[ctx.target] : undefined;
  return renderTemplate(tpl, {
    vars: { ...ctx.vars, self: ctx.self, target, enemy: game.enemy, card: ctx.card },
    fields: ctx.card as Record<string, unknown> | undefined,
    tuning: TUNING,
  }).text;
}

/** Resolve every amount-valued key in an emit payload, then emit it. */
function emitPayload(game: Game, action: Record<string, unknown>, ctx: ActionCtx): void {
  const payload: Record<string, unknown> = { kind: action.kind };
  for (const [k, v] of Object.entries(action)) {
    if (k === 'op' || k === 'kind') continue;
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') payload[k] = v;
    else if (Array.isArray(v)) payload[k] = v;
    else if (v && typeof v === 'object') {
      // A selector resolves to its slot; anything else is an amount expression.
      if ('sel' in (v as object) || typeof v === 'string') {
        payload[k] = resolveOne(game, v as Selector, ctx)?.slot;
      } else payload[k] = evalAmount(game, v as Amount, ctx);
    }
  }
  // Bare selector strings ('$target') arrive as strings; map the common slot keys.
  for (const key of ['slot']) {
    const raw = action[key];
    if (typeof raw === 'string' && raw.startsWith('$')) {
      payload[key] = resolveOne(game, raw as Selector, ctx)?.slot;
    }
  }
  game._emit(payload as never);
}

/**
 * Run an action list. `natives` supplies the escape-hatch implementations; the
 * validator has already proven every referenced fn exists.
 */
export function runActions(
  game: Game, actions: readonly Action[], ctx: ActionCtx,
  natives: Record<string, NativeFn> = {},
): void {
  for (const action of actions) {
    const a = action as Record<string, unknown>;
    const bind = (v: unknown) => { if (typeof a.bind === 'string') ctx.vars[a.bind] = v; };

    switch (action.op) {
      case 'heal': {
        const amount = evalAmount(game, action.amount, ctx);
        let total = 0;
        for (const m of resolveSelector(game, action.to, ctx)) {
          const healed = game._healMember(m, amount, action.direct ?? true);
          total += healed;
          if (action.splash) game._healCardSplash(m, amount);
        }
        bind(total);
        break;
      }
      case 'damage': {
        const amount = evalAmount(game, action.amount, ctx);
        const killed = game._damageEnemy(amount, action.source ?? ctx.card?.name ?? 'effect');
        if (action.nuke) game._emitEnemyNuke(amount, killed);
        bind(amount);
        break;
      }
      case 'strike': {
        const from = resolveOne(game, action.from, ctx);
        if (!from) break;
        const times = action.times ? evalAmount(game, action.times, ctx) : 1;
        for (let i = 0; i < times; i++) {
          const dmg = evalAmount(game, action.amount, ctx);
          if (game._strikeEnemy(from, dmg, action.label ?? from.name)) break;
        }
        break;
      }
      case 'bloodPay': {
        const from = resolveOne(game, action.from, ctx);
        bind(from ? game._bloodPay(from, evalAmount(game, action.amount, ctx)) : 0);
        break;
      }
      case 'drain': {
        const from = resolveOne(game, action.from, ctx);
        bind(from ? game._drainMember(from, evalAmount(game, action.amount, ctx)) : 0);
        break;
      }
      case 'status': {
        const write = {
          amount: action.amount ? evalAmount(game, action.amount, ctx) : undefined,
          turns: action.turns ? evalAmount(game, action.turns, ctx) : undefined,
          mode: action.mode,
        };
        for (const m of resolveSelector(game, action.on, ctx)) STATUS_WRITERS[action.tag](m, write);
        break;
      }
      case 'clearStatus': {
        for (const m of resolveSelector(game, action.on, ctx)) {
          for (const tag of action.tags) STATUS_WRITERS[tag](m, { amount: 0, turns: 0, mode: 'set' });
        }
        break;
      }
      case 'consume': {
        const m = resolveOne(game, action.on, ctx);
        if (!m) { ctx.vars[action.bind] = 0; break; }
        ctx.vars[action.bind] = m.regen;
        m.regen = 0;
        if (!action.deferEndHook) game._onRegenEnded(m, true);
        break;
      }
      case 'enemyStatus': {
        const amount = action.amount ? evalAmount(game, action.amount, ctx) : 0;
        const turns = action.turns ? evalAmount(game, action.turns, ctx) : 0;
        const e = game.enemy as unknown as Record<string, number>;
        if (action.tag === 'poison') {
          if (action.mode === 'keepStronger') {
            e.poison = Math.max(e.poison, amount);
            e.poisonTurns = turns;
          } else if (action.mode === 'mul') {
            e.poison *= amount;
          } else {
            game._applyPoison(amount, turns);
          }
        } else if (action.tag === 'vulnerable') {
          e.vulnerable = combine(e.vulnerable, amount, action.mode, e.vulnerableTurns > 0);
          e.vulnerableTurns = Math.max(action.mode === 'keepLonger' ? e.vulnerableTurns : 0, turns);
        } else if (action.tag === 'doom') {
          e.doomTurns = turns;
        }
        break;
      }
      case 'consumeEnemyStatus': {
        const e = game.enemy as unknown as Record<string, number>;
        if (action.tag === 'poison') {
          ctx.vars[action.bind] = e.poison * e.poisonTurns;
          e.poison = 0; e.poisonTurns = 0;
        }
        break;
      }
      case 'partyBuff': {
        const g = game as unknown as Record<string, number | boolean>;
        const amount = action.amount ? evalAmount(game, action.amount, ctx) : 0;
        const turns = action.turns ? evalAmount(game, action.turns, ctx) : 0;
        if (typeof g[action.field] === 'boolean') g[action.field] = true;
        else {
          const cur = g[action.field] as number;
          g[action.field] = combine(cur, action.turns != null ? turns : amount, action.mode, cur > 0);
        }
        break;
      }
      case 'draw': {
        const n = evalAmount(game, action.count, ctx);
        const before = game.hand.length;
        for (let i = 0; i < n; i++) {
          const c = game._drawOne();
          if (c == null) break;
          game.hand.push(c);
        }
        bind(game.hand.length - before);
        break;
      }
      case 'mp': {
        const before = game.mp;
        game.mp = Math.min(game.maxMana, Math.max(0, game.mp + evalAmount(game, action.delta, ctx)));
        bind(game.mp - before);
        break;
      }
      case 'primeRefresh': {
        game.refresh = Math.max(game.refresh, evalAmount(game, action.amount, ctx));
        game.refreshTurns = evalAmount(game, action.turns, ctx);
        game.refreshRestored = 0;
        game.refreshCap = evalAmount(game, action.cap, ctx);
        break;
      }
      case 'revive': {
        const m = resolveOne(game, action.on, ctx);
        if (m) game._reviveMember(m, action.hpFraction);
        break;
      }
      case 'purge': {
        const had = game._purgeParty();
        bind(had);
        break;
      }
      case 'telegraph': {
        const t = game.telegraph;
        if (!t) break;
        if (action.mode === 'reduceDamage') {
          t.damage = Math.max(action.floor ?? 0, t.damage - evalAmount(game, action.amount!, ctx));
        } else if (action.mode === 'retargetTo') {
          const m = resolveOne(game, action.to!, ctx);
          if (m) t.targets = t.targets.map(() => m.slot);
        } else if (action.mode === 'stun') {
          t.stunned = true;
        }
        break;
      }
      case 'addStat': {
        const amount = evalAmount(game, action.amount, ctx);
        const cap = action.cap ? evalAmount(game, action.cap, ctx) : undefined;
        for (const m of resolveSelector(game, action.on, ctx)) {
          const rec = m as unknown as Record<string, number>;
          const next = rec[action.stat] + amount;
          rec[action.stat] = cap != null ? Math.min(cap, next) : next;
        }
        break;
      }
      case 'queueDelayed':
        game.delayedStartEffects.push({ kind: action.kind } as never);
        break;
      case 'regenEnded': {
        const m = resolveOne(game, action.on, ctx);
        if (m) game._onRegenEnded(m, action.consumed);
        break;
      }
      case 'healCardSplash': {
        const m = resolveOne(game, action.primary, ctx);
        if (m) game._healCardSplash(m, evalAmount(game, action.amount, ctx));
        break;
      }
      case 'let':
        ctx.vars[action.bind] = evalAmount(game, action.value, ctx);
        break;
      case 'letStr':
        ctx.vars[action.bind] = render(game, action.value, ctx);
        break;
      case 'collect': {
        const picked: unknown[] = [];
        for (const m of resolveSelector(game, action.over, ctx)) {
          if (action.where && !evalCondition(game, action.where, ctx, m)) continue;
          picked.push((m as unknown as Record<string, unknown>)[action.pick]);
        }
        ctx.vars[action.bind] = picked;
        break;
      }
      case 'forEach': {
        for (const m of resolveSelector(game, action.over, ctx)) {
          const inner: ActionCtx = action.as
            ? { ...ctx, vars: { ...ctx.vars, [action.as]: m } }
            : { ...ctx, self: ctx.self, target: m.slot, vars: ctx.vars };
          runActions(game, action.do, inner, natives);
        }
        break;
      }
      case 'if': {
        const branch = evalCondition(game, action.when, ctx) ? action.then : action.else;
        // Bindings made inside a branch are scoped to it (the validator enforces the
        // same rule statically), so the branch gets its own vars object.
        if (branch) runActions(game, branch, { ...ctx, vars: { ...ctx.vars } }, natives);
        break;
      }
      case 'log':
        game._log(render(game, action.text, ctx), action.kind);
        break;
      case 'emit':
        emitPayload(game, a, ctx);
        break;
      case 'native': {
        const fn = natives[action.fn];
        if (fn) fn(game, ctx);
        break;
      }
      default: break;
    }
  }
}
