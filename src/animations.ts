// Pure mapping from the engine's GameEvent feed to an animation timeline.
//
// No DOM, no timers, no React — just data. Given the ordered events from a single
// action, buildTimeline() returns a list of time-stamped entries: visual effects
// to spawn, display patches (staged HP / MP / death so bars and numbers move in
// step with the effects), and screen shakes. The view layer (useGame + FxLayer)
// walks the timeline with real timers and resolves the logical anchors below into
// on-screen coordinates. Keeping this pure means the whole feel can be unit-tested.

import type { GameEvent } from './engine';
import type { Slot, MemberId } from './constants';

// Where an effect is pinned. Slot indices point at party member cards; 'enemy'
// is the enemy panel, 'mp' the mana bar. The overlay measures these from the DOM.
export type Anchor = 'enemy' | 'mp' | 0 | 1 | 2;

type FxSpecBase =
  // `variant` shapes the projectile's flight: 'trail' drags a streak behind it,
  // 'arc' lobs it along a parabola. `scale` multiplies the comet size (tank slam
  // reads heavy at 1.6, ranger darts light at 0.7).
  | { type: 'projectile'; from: Anchor; to: Anchor; color: string;
      variant?: 'plain' | 'trail' | 'arc'; scale?: number }
  | { type: 'beam'; from: Anchor; to: Anchor; color: string }
  // `mode` picks the particle motion: 'radial' explodes outward (impacts),
  // 'rise' drifts upward (warm heal motes), 'fall' crumbles down (debuffs).
  | { type: 'burst'; at: Anchor; color: string; count: number; spread: number;
      mode?: 'radial' | 'rise' | 'fall' }
  | { type: 'float'; at: Anchor; text: string; color: string; big?: boolean }
  | { type: 'ring'; at: Anchor; color: string }
  | { type: 'shield'; at: Anchor; color: string }
  | { type: 'pillar'; at: Anchor; color: string }
  | { type: 'glow'; at: Anchor; color: string }
  // A blade streak sweeping across the anchor; `angle` in degrees (0 = horizontal).
  | { type: 'slash'; at: Anchor; color: string; angle?: number }
  // Anchorless, full-board effects: a text band sweeping the center of the board,
  // and an edge vignette ('tint') or center flash ('flash') wash.
  | { type: 'banner'; text: string; color: string }
  | { type: 'vignette'; color: string; mode: 'tint' | 'flash' }
  // A ghost of a just-played card: spawns at the card's measured hand position
  // (container-relative px) and flies into its target, dissolving into the
  // card's effect. 'center' is for board-wide plays with no single target.
  | { type: 'cardGhost'; from: CardOrigin; to: Anchor | 'center'; name: string; cost: number }
  // A card-shaped ghost flying between a deck pile and a hand slot (#94): the
  // end-of-turn discard-out (a captured hand box -> the discard pile, `fade: 'out'`) and
  // the start-of-turn draw-in (the draw pile -> a hand slot, `fade: 'in'`). Endpoints are
  // logical and resolved live against the DOM by FxLayer — 'draw'/'discard' are the pile
  // buttons, a number is that hand-slot card, a CardOrigin is an explicit measured box (a
  // hand card captured just before endTurn removes it from the DOM).
  | { type: 'cardFly'; from: CardFlyEnd; to: CardFlyEnd; fade: 'in' | 'out' };

// Where a played card sat on screen (px relative to the battle container),
// measured by the click handler before the engine removes it from the hand.
export interface CardOrigin { x: number; y: number; w: number; h: number; }

// An endpoint for a `cardFly`: a deck pile, a hand slot index, or an explicit box.
export type CardFlyEnd = 'draw' | 'discard' | number | CardOrigin;

// Every effect may override its default lifetime — a heavy slam's lobbed orb
// hangs in the air longer than a ranger dart even though both are projectiles.
export type FxSpec = FxSpecBase & { dur?: number };

// An effect's on-screen lifetime: its own override, else the per-type default.
export const fxDuration = (f: FxSpec): number => f.dur ?? FX_DURATION[f.type];

// A short-lived reaction played on a party member's card itself (flash, recoil,
// lunge, collapse) — the card moves, unlike FxLayer effects which overlay it.
export type MemberReactKind = 'hit' | 'heal' | 'death' | 'block' | 'lunge';
export interface MemberReact { slot: Slot; kind: MemberReactKind; }

// Staged view values applied at a moment in the timeline. They override live
// engine state on the bars/cards until the sequence finishes (then the view
// snaps back to the engine, which already holds the same final numbers).
export interface DisplayPatch {
  enemyHp?: number;
  mp?: number;
  memberHp?: { slot: Slot; hp: number };
  memberDead?: Slot;  // start showing this member as dead
  memberAlive?: Slot; // start showing this member as alive again (resurrect)
}

export interface TimelineEntry {
  at: number;          // ms offset from the start of the sequence
  fx?: FxSpec[];       // effects to spawn at this moment
  patch?: DisplayPatch;// view changes to apply at this moment
  shake?: number;      // screen-shake intensity (px); 0/undefined = none
  react?: MemberReact[]; // member-card reactions to trigger at this moment
}

export interface Timeline {
  entries: TimelineEntry[];
  total: number;       // ms until every effect has finished fading
  paceEnd: number;     // ms until the action's pacing ends — input can resume here,
                       // ahead of the cosmetic fade-out captured by `total`
}

// A spawned effect: a spec plus a stable id for React keys and removal.
export interface FxInstance {
  id: number;
  spec: FxSpec;
}

// How long each effect type lives on screen, so the runtime knows when to remove
// it and when the whole sequence is done.
export const FX_DURATION: Record<FxSpec['type'], number> = {
  projectile: 280,
  beam: 360,
  burst: 650,
  float: 850,
  ring: 520,
  shield: 720,
  pillar: 760,
  glow: 620,
  slash: 340,
  banner: 1200,
  vignette: 700,
  cardGhost: 420,
  cardFly: 460,
};

// Dead time inserted after the biggest impacts (kills, bolt, boss beats) so the
// blow visibly "stops the world" for a beat before the sequence moves on. The
// impact's own effects land at the moment of impact; the damage float and the
// rest of the timeline wait out the stop.
export const HITSTOP = 90;

// Palette mirrors the CSS custom properties in styles.css.
const C = {
  danger: '#e85d5d',
  enemy: '#d96b6b',
  hp: '#5ad17a',
  regen: '#7fe6a4',
  mp: '#6ea8fe',
  shield: '#7fd0ff',
  taunt: '#f2c14e',
  unknown: '#b388ff',
  poison: '#8fd14a',
  bolt: '#bfe0ff',
  smoke: '#6a7080',
  white: '#ffffff',
  damageText: '#ffd9d9',
  hex: '#c46bd9',   // Hexweaver curse (healing-reduction)
  drain: '#b06bfe', // MP siphon
  warm: '#ffdf9e',  // the golden warmth around heals
};

const TRAVEL = 240; // projectile flight time before impact lands

type Push = (e: TimelineEntry) => void;
type PartyAttackEv = Extract<GameEvent, { kind: 'partyAttack' }>;
type EnemyAttackEv = Extract<GameEvent, { kind: 'enemyAttack' }>;

// Each identity's strike signature: how its auto-attack looks and feels. Any
// member can occupy any slot in a drafted party, so signatures key off the
// event's memberId. A builder pushes its own launch/impact entries (the lunge
// react is shared by the caller) and returns the timeline cursor after settle.
// Exported so test/content/coverage.test.ts can assert every hero has an entry.
// With MemberId a plain string (#106) this map is no longer exhaustiveness-checked by
// the compiler, so the coverage test is what catches a hero added without an animation.
export const MEMBER_STRIKE: Record<MemberId, (ev: PartyAttackEv, push: Push, t: number) => number> = {
  ranger: (ev, push, t) => {
    // Dart volley: three quick, light trail-darts; the payload lands with the last.
    const c = '#a8e85d';
    for (let k = 0; k < 3; k++) {
      push({ at: t + k * 70, fx: [
        { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'trail', scale: 0.65, dur: 200 },
      ] });
      push({
        at: t + k * 70 + 200,
        shake: k === 2 ? 5 : 2,
        patch: k === 2 ? { enemyHp: ev.enemyHp } : undefined,
        fx: [{ type: 'burst', at: 'enemy', color: c, count: 6, spread: 34 }],
      });
    }
    push({ at: t + 140 + 200, fx: [
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return t + 140 + 200 + 160;
  },
  tank: (ev, push, t) => {
    // Wind-up, then a heavy lobbed slam that lands like a wall falling over.
    const c = '#cdd6e6';
    push({ at: t, fx: [{ type: 'glow', at: ev.slot, color: c, dur: 300 }] });
    push({ at: t + 220, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'arc', scale: 1.7, dur: 340 },
    ] });
    const impact = t + 220 + 340;
    push({ at: impact, shake: 10, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: -50 },
      { type: 'burst', at: 'enemy', color: c, count: 16, spread: 70 },
      { type: 'burst', at: 'enemy', color: C.smoke, count: 8, spread: 48, mode: 'fall' },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c, big: true },
    ] });
    return impact + 280;
  },
  mage: (ev, push, t) => {
    // Charge, then a crackling beam that blooms on impact.
    const c = '#b388ff';
    push({ at: t, fx: [{ type: 'glow', at: ev.slot, color: c, dur: 280 }] });
    push({ at: t + 240, fx: [{ type: 'beam', from: ev.slot, to: 'enemy', color: c }] });
    const impact = t + 240 + 180;
    push({ at: impact, shake: 7, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'ring', at: 'enemy', color: c },
      { type: 'burst', at: 'enemy', color: c, count: 14, spread: 64 },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return impact + 220;
  },
  warlock: (ev, push, t) => {
    // An occult bolt; what it touches decays and sloughs off downward.
    const c = '#b06bfe';
    push({ at: t, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'trail', scale: 1.1, dur: 300 },
    ] });
    const impact = t + 300;
    push({ at: impact, shake: 5, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'glow', at: 'enemy', color: c },
      { type: 'burst', at: 'enemy', color: c, count: 13, spread: 58, mode: 'fall' },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return impact + 200;
  },
  skald: (ev, push, t) => {
    // A rising chord — notes lift off the Skald as the strike flies.
    const c = '#f2c14e';
    push({ at: t, fx: [
      { type: 'burst', at: ev.slot, color: c, count: 7, spread: 44, mode: 'rise' },
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'trail', dur: 260 },
    ] });
    const impact = t + 260;
    push({ at: impact, shake: 5, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'ring', at: 'enemy', color: c },
      { type: 'burst', at: 'enemy', color: c, count: 11, spread: 54 },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return impact + 200;
  },
  berserker: (ev, push, t) => {
    // A wild rush ending in two crossing slashes.
    const c = '#e85d5d';
    push({ at: t, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'trail', scale: 1.2, dur: 190 },
    ] });
    const first = t + 190;
    push({ at: first, shake: 6, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: -35 },
      { type: 'burst', at: 'enemy', color: c, count: 9, spread: 48 },
    ] });
    push({ at: first + 110, shake: 9, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: 30 },
      { type: 'burst', at: 'enemy', color: c, count: 13, spread: 62 },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c, big: true },
    ] });
    return first + 110 + 240;
  },
  beastWarden: (ev, push, t) => {
    // A feral strike — the claw rakes across on arrival.
    const c = '#7fe6a4';
    push({ at: t, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'trail', dur: 220 },
    ] });
    const impact = t + 220;
    push({ at: impact, shake: 6, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: 12 },
      { type: 'burst', at: 'enemy', color: c, count: 12, spread: 56 },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return impact + 200;
  },
  sentinel: (ev, push, t) => {
    // A heavy shield bash — a slow wind-up into a blunt, grounding slam.
    const c = '#c9b26b';
    push({ at: t, fx: [{ type: 'glow', at: ev.slot, color: c, dur: 260 }] });
    push({ at: t + 200, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'arc', scale: 1.4, dur: 300 },
    ] });
    const impact = t + 200 + 300;
    push({ at: impact, shake: 9, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: -18 },
      { type: 'burst', at: 'enemy', color: c, count: 12, spread: 54, mode: 'fall' },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c, big: true },
    ] });
    return impact + 240;
  },
  duelist: (ev, push, t) => {
    // A fencer's lunge: a fast, straight thrust that pierces on the point.
    const c = '#e06b8b';
    push({ at: t, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'trail', scale: 0.9, dur: 170 },
    ] });
    const impact = t + 170;
    push({ at: impact, shake: 5, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: 0 },
      { type: 'burst', at: 'enemy', color: c, count: 9, spread: 40 },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return impact + 190;
  },
  flagellant: (ev, push, t) => {
    // A heavy, martyr's swing: a slow, blood-dark scourge that lands with weight (#75).
    const c = '#c0392b';
    push({ at: t, fx: [
      { type: 'projectile', from: ev.slot, to: 'enemy', color: c, variant: 'arc', scale: 1.1, dur: 240 },
    ] });
    const impact = t + 240;
    push({ at: impact, shake: 7, patch: { enemyHp: ev.enemyHp }, fx: [
      { type: 'slash', at: 'enemy', color: c, angle: 30 },
      { type: 'burst', at: 'enemy', color: c, count: 12, spread: 52 },
      { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: c },
    ] });
    return impact + 220;
  },
};

// Resolve one enemy-attack target at `at`: a whiff, a block, a hit, or a kill
// (which stops the world for a beat). `boost` deepens the shake for heavy
// geometry. Returns when the moment settles.
function resolveEnemyHit(ev: EnemyAttackEv, push: Push, at: number, color: string, boost = 0): number {
  if (ev.result === 'whiff') {
    push({ at, fx: [{ type: 'burst', at: ev.slot, color: C.smoke, count: 6, spread: 32 }] });
    return at + 160;
  }
  if (ev.result === 'shield') {
    push({ at, shake: 4, react: [{ slot: ev.slot, kind: 'block' }], fx: [
      { type: 'shield', at: ev.slot, color: C.shield },
      { type: 'ring', at: ev.slot, color: C.shield },
      { type: 'burst', at: ev.slot, color: C.shield, count: 12, spread: 58 },
      { type: 'float', at: ev.slot, text: 'BLOCK', color: C.shield },
    ] });
    return at + 360;
  }
  if (ev.killed) {
    push({
      at, shake: 13 + boost, react: [{ slot: ev.slot, kind: 'death' }],
      fx: [
        { type: 'vignette', color: C.white, mode: 'flash', dur: 320 },
        { type: 'burst', at: ev.slot, color, count: 14, spread: 62 },
        { type: 'burst', at: ev.slot, color: C.white, count: 22, spread: 90 },
      ],
      patch: { memberHp: { slot: ev.slot, hp: ev.hp }, memberDead: ev.slot },
    });
    push({ at: at + HITSTOP, fx: [
      { type: 'float', at: ev.slot, text: `-${ev.amount}`, color: C.danger, big: true },
    ] });
    return at + HITSTOP + 520;
  }
  push({
    at, shake: 7 + boost, react: [{ slot: ev.slot, kind: 'hit' }],
    fx: [
      { type: 'burst', at: ev.slot, color, count: 14, spread: 62 },
      { type: 'float', at: ev.slot, text: `-${ev.amount}`, color: C.danger },
    ],
    patch: { memberHp: { slot: ev.slot, hp: ev.hp } },
  });
  return at + 360;
}

// Play a whole enemy volley (the consecutive attack events of one geometry) with
// a signature per attack shape: aoe detonates once and strikes everyone at the
// same instant, sweep rakes the row left to right, heavy winds up then lobs a
// massive blow, two double-taps, single/hidden dart at their target.
function enemyVolley(run: EnemyAttackEv[], push: Push, t0: number): number {
  const type = run[0].attackType;
  const color = run[0].hidden ? C.unknown : C.enemy;
  let end = t0;

  if (type === 'aoe') {
    push({ at: t0, shake: 3, fx: [
      { type: 'ring', at: 'enemy', color },
      { type: 'glow', at: 'enemy', color, dur: 280 },
    ] });
    const impact = t0 + 260;
    for (const ev of run) end = Math.max(end, resolveEnemyHit(ev, push, impact, color, 2));
    return end;
  }

  if (type === 'sweep') {
    for (let k = 0; k < run.length; k++) {
      const ev = run[k];
      const at = t0 + k * 110;
      push({ at, fx: [{ type: 'slash', at: ev.slot, color, angle: -12 }] });
      end = Math.max(end, resolveEnemyHit(ev, push, at + 90, color));
    }
    return end;
  }

  if (type === 'heavy') {
    push({ at: t0, fx: [{ type: 'glow', at: 'enemy', color, dur: 340 }] });
    let cursor = t0 + 300;
    for (const ev of run) {
      push({ at: cursor, fx: [
        { type: 'projectile', from: 'enemy', to: ev.slot, color, variant: 'arc', scale: 1.8, dur: 360 },
      ] });
      cursor = resolveEnemyHit(ev, push, cursor + 360, color, 3);
    }
    return cursor;
  }

  if (type === 'two') {
    for (let k = 0; k < run.length; k++) {
      const ev = run[k];
      const at = t0 + k * 130;
      push({ at, fx: [{ type: 'projectile', from: 'enemy', to: ev.slot, color, dur: TRAVEL }] });
      end = Math.max(end, resolveEnemyHit(ev, push, at + TRAVEL, color));
    }
    return end;
  }

  // single / hidden / cast: one dart per target in sequence. Hidden attacks
  // drag a smear behind them — you saw it coming, just not what it was.
  let cursor = t0;
  for (const ev of run) {
    push({ at: cursor, fx: [
      { type: 'projectile', from: 'enemy', to: ev.slot, color,
        variant: ev.hidden ? 'trail' : 'plain', dur: TRAVEL },
    ] });
    cursor = resolveEnemyHit(ev, push, cursor + TRAVEL, color);
  }
  return cursor;
}

export function buildTimeline(events: GameEvent[]): Timeline {
  const entries: TimelineEntry[] = [];
  let t = 0;
  const push = (e: TimelineEntry): void => { entries.push(e); };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    switch (ev.kind) {
      case 'enemyPhase': {
        // A quick stinger, not a pause: the banner sweeps while the enemy's
        // first move is already winding up.
        push({ at: t, fx: [{ type: 'banner', text: 'ENEMY PHASE', color: C.enemy, dur: 900 }] });
        t += 300;
        break;
      }

      case 'enrage': {
        push({ at: t, shake: 11, fx: [
          { type: 'banner', text: 'ENRAGED', color: C.danger },
          { type: 'ring', at: 'enemy', color: C.danger },
          { type: 'burst', at: 'enemy', color: C.danger, count: 20, spread: 95 },
        ] });
        t += 680;
        break;
      }

      case 'poisonTick': {
        push({ at: t, patch: { enemyHp: ev.enemyHp }, fx: [
          { type: 'burst', at: 'enemy', color: C.poison, count: 11, spread: 50, mode: 'fall', dur: 780 },
          { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: C.poison },
        ] });
        t += 360;
        break;
      }

      case 'regenTick': {
        if (ev.amount > 0) {
          push({ at: t, patch: { memberHp: { slot: ev.slot, hp: ev.hp } },
            react: [{ slot: ev.slot, kind: 'heal' }], fx: [
            { type: 'burst', at: ev.slot, color: C.regen, count: 8, spread: 42, mode: 'rise', dur: 820 },
            { type: 'float', at: ev.slot, text: `+${ev.amount}`, color: C.regen, dur: 950 },
          ] });
          t += 320;
        }
        break;
      }

      case 'refreshTick': {
        if (ev.amount > 0) {
          push({ at: t, patch: { mp: ev.mp }, fx: [
            { type: 'burst', at: 'mp', color: C.mp, count: 8, spread: 40 },
            { type: 'float', at: 'mp', text: `+${ev.amount} MP`, color: C.mp },
          ] });
          t += 320;
        }
        break;
      }

      case 'enemyAttack': {
        // Gather the volley: consecutive attack events of one geometry play as
        // a single signature move (sweep rakes the row, aoe detonates once).
        const run: EnemyAttackEv[] = [ev];
        while (i + 1 < events.length) {
          const next = events[i + 1];
          if (next.kind !== 'enemyAttack' || next.attackType !== ev.attackType) break;
          run.push(events[++i] as EnemyAttackEv);
        }
        t = enemyVolley(run, push, t);
        break;
      }

      case 'partyAttack': {
        // The striker's card lunges toward the enemy; the rest of the strike is
        // the member's own signature (see MEMBER_STRIKE).
        push({ at: t, react: [{ slot: ev.slot, kind: 'lunge' }] });
        // Fallback (#106): a hero with no signature animation still gets the generic
        // lunge rather than crashing the animator. The coverage test makes the gap
        // loud; this makes it survivable.
        t = (MEMBER_STRIKE[ev.memberId] ?? MEMBER_STRIKE.ranger)(ev, push, t);
        break;
      }

      case 'heal': {
        // Gather a run of consecutive heals (Group Heal emits one per member) and
        // cascade them so they land together rather than dragging out one by one.
        const run: typeof ev[] = [ev];
        while (i + 1 < events.length && events[i + 1].kind === 'heal') run.push(events[++i] as typeof ev);
        // A big heal warms the whole board for a moment, not just the target.
        if (run.some((h) => h.amount >= 6)) {
          push({ at: t, fx: [{ type: 'vignette', color: C.warm, mode: 'tint', dur: 900 }] });
        }
        let maxOff = 0;
        run.forEach((h, k) => {
          const off = k * 110;
          maxOff = off;
          if (h.amount > 0) {
            // Warm and comforting: a golden bloom, motes drifting upward, and a
            // number that floats away slowly instead of snapping.
            push({ at: t + off, patch: { memberHp: { slot: h.slot, hp: h.hp } },
              react: [{ slot: h.slot, kind: 'heal' }], fx: [
              { type: 'glow', at: h.slot, color: C.warm, dur: 780 },
              { type: 'burst', at: h.slot, color: C.regen, count: 10, spread: 46, mode: 'rise', dur: 900 },
              { type: 'float', at: h.slot, text: `+${h.amount}`, color: C.hp, dur: 1050 },
            ] });
          } else {
            push({ at: t + off, fx: [{ type: 'burst', at: h.slot, color: C.hp, count: 5, spread: 30, mode: 'rise' }] });
          }
        });
        t += maxOff + 360;
        break;
      }

      case 'regenApplied': {
        push({ at: t, fx: [
          { type: 'glow', at: ev.slot, color: C.regen },
          { type: 'burst', at: ev.slot, color: C.regen, count: 10, spread: 46 },
          { type: 'float', at: ev.slot, text: `♻ ${ev.stack}`, color: C.regen },
        ] });
        t += 360;
        break;
      }

      case 'shieldApplied': {
        // Protective: the bubble forms and "locks in" with a settle on the card.
        push({ at: t, react: [{ slot: ev.slot, kind: 'block' }], fx: [
          { type: 'shield', at: ev.slot, color: C.shield },
          { type: 'ring', at: ev.slot, color: C.shield },
          { type: 'float', at: ev.slot, text: '🛡', color: C.shield, big: true },
        ] });
        t += 420;
        break;
      }

      case 'defenseApplied': {
        // Phalanx (#17): a standing damage reduction settles on the member.
        push({ at: t, react: [{ slot: ev.slot, kind: 'block' }], fx: [
          { type: 'glow', at: ev.slot, color: C.taunt },
          { type: 'ring', at: ev.slot, color: C.taunt },
          { type: 'float', at: ev.slot, text: `DEF ${ev.amount}`, color: C.taunt },
        ] });
        t += 400;
        break;
      }

      case 'resurrect': {
        push({ at: t, shake: 4, fx: [
          { type: 'pillar', at: ev.slot, color: C.taunt },
          { type: 'ring', at: ev.slot, color: C.taunt },
        ] });
        push({ at: t + 260, patch: { memberAlive: ev.slot, memberHp: { slot: ev.slot, hp: ev.hp } }, fx: [
          { type: 'burst', at: ev.slot, color: C.taunt, count: 20, spread: 80 },
          { type: 'float', at: ev.slot, text: 'REVIVE', color: C.taunt, big: true },
        ] });
        t += 720;
        break;
      }

      case 'refreshPrimed': {
        push({ at: t, fx: [
          { type: 'glow', at: 'mp', color: C.mp },
          { type: 'burst', at: 'mp', color: C.mp, count: 10, spread: 48 },
          { type: 'float', at: 'mp', text: `⟳ ${ev.stack}`, color: C.mp },
        ] });
        t += 380;
        break;
      }

      case 'martyrSave': {
        // Martyr's Icon (#22): a death refused — the biggest save in the game.
        push({ at: t, shake: 8, fx: [
          { type: 'pillar', at: ev.slot, color: C.white },
          { type: 'ring', at: ev.slot, color: C.taunt },
          { type: 'float', at: ev.slot, text: 'SPARED', color: C.taunt, big: true },
        ] });
        t += 700;
        break;
      }

      case 'lensArmed': {
        // Arcane Lens (#70): the next single-target heal will refract to a second ally.
        push({ at: t, fx: [
          { type: 'glow', at: 'mp', color: C.mp },
          { type: 'float', at: 'mp', text: 'HEAL REFRACTED', color: C.mp },
        ] });
        t += 380;
        break;
      }

      case 'hymn': {
        // Battle Hymn / Rally / Consecration / Blood Banner / Embolden / Sharpen (#16):
        // a `+N ATK` float fans over EVERY buffed member (ev.slots), not one banner.
        const fx: FxSpec[] = [];
        for (const s of ev.slots) {
          fx.push({ type: 'glow', at: s, color: C.taunt });
          fx.push({ type: 'float', at: s, text: `+${ev.bonus} ATK`, color: C.taunt, big: true });
        }
        push({ at: t, fx });
        t += 460;
        break;
      }

      case 'bloodPay': {
        // A Blood card's HP cost (#16): a self-inflicted, never-lethal hit.
        push({ at: t, shake: 4, patch: { memberHp: { slot: ev.slot, hp: ev.hp } },
          react: [{ slot: ev.slot, kind: 'hit' }], fx: [
          { type: 'burst', at: ev.slot, color: C.danger, count: 12, spread: 55 },
          { type: 'float', at: ev.slot, text: `-${ev.amount}`, color: C.danger },
        ] });
        t += 360;
        break;
      }

      case 'draw': {
        // Inspiration (#15): the cards appear in the hand instantly (it renders
        // live), so a light pulse near the hand acknowledges the play.
        push({ at: t, fx: [
          { type: 'glow', at: 'mp', color: C.white },
          { type: 'float', at: 'mp', text: `+${ev.count} card${ev.count === 1 ? '' : 's'}`, color: C.white },
        ] });
        t += 360;
        break;
      }

      case 'rest': {
        push({ at: t, patch: { mp: ev.mp }, fx: [
          { type: 'glow', at: 'mp', color: C.mp },
          { type: 'burst', at: 'mp', color: C.mp, count: 14, spread: 60 },
          { type: 'float', at: 'mp', text: `+${ev.amount} MP`, color: C.mp },
        ] });
        t += 460;
        break;
      }

      case 'poisonApplied': {
        // A lobbed venom glob; the splash oozes downward rather than exploding.
        push({ at: t, fx: [
          { type: 'projectile', from: ev.slot, to: 'enemy', color: C.poison, variant: 'arc', dur: 300 },
        ] });
        push({ at: t + 300, fx: [
          { type: 'burst', at: 'enemy', color: C.poison, count: 14, spread: 58, mode: 'fall', dur: 820 },
          { type: 'float', at: 'enemy', text: `☠ +${ev.amount}`, color: C.poison },
        ] });
        t += 300 + 360;
        break;
      }

      case 'taunt': {
        push({ at: t, fx: [
          { type: 'glow', at: ev.slot, color: C.taunt },
          { type: 'ring', at: ev.slot, color: C.taunt },
          { type: 'burst', at: ev.slot, color: C.taunt, count: 14, spread: 60 },
          { type: 'float', at: ev.slot, text: 'TAUNT!', color: C.taunt, big: true },
        ] });
        t += 460;
        break;
      }

      case 'enGarde': {
        // The Duelist sets a guard on the chosen member — a poised, blade-edge shimmer.
        const c = '#e06b8b';
        push({ at: t, fx: [
          { type: 'glow', at: ev.slot, color: c, dur: 320 },
          { type: 'ring', at: ev.slot, color: c },
          { type: 'burst', at: ev.slot, color: c, count: 10, spread: 50, mode: 'rise' },
          { type: 'float', at: ev.slot, text: 'EN GARDE', color: c },
        ] });
        t += 420;
        break;
      }

      case 'stun': {
        // Sentinel (#61) staggers the enemy — its standing telegraph is cancelled.
        // A shock float over the member who pulled it off.
        push({ at: t, fx: [
          { type: 'glow', at: ev.slot, color: C.taunt },
          { type: 'burst', at: ev.slot, color: C.taunt, count: 8, spread: 44, mode: 'rise' },
          { type: 'float', at: ev.slot, text: 'STUN', color: C.taunt },
        ] });
        t += 380;
        break;
      }

      case 'penance': {
        // The Strongman strains himself (#75): a self-sacrifice, then the whole party's
        // autos flare. The HP cost's own -N shake rides its bloodPay event; here we mark the
        // party-wide fury (his slot glows only if he survived the payment).
        const fx: FxSpec[] = [];
        for (const s of ev.slots) {
          fx.push({ type: 'glow', at: s, color: C.danger });
          fx.push({ type: 'float', at: s, text: `+${ev.bonus} ATK`, color: C.danger, big: true });
        }
        if (ev.died) fx.push({ type: 'float', at: ev.slot, text: 'GAVE IT ALL', color: C.danger });
        push({ at: t, fx });
        t += 460;
        break;
      }

      case 'bolt': {
        push({ at: t, fx: [{ type: 'beam', from: ev.slot, to: 'enemy', color: C.bolt }] });
        const impact = t + 200;
        push({ at: impact, shake: 12, patch: { enemyHp: ev.enemyHp }, fx: [
          { type: 'burst', at: 'enemy', color: C.bolt, count: 22, spread: 95 },
          { type: 'ring', at: 'enemy', color: C.bolt },
        ] });
        push({ at: impact + HITSTOP, fx: [
          { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: C.bolt, big: true },
        ] });
        t = impact + HITSTOP + 460;
        break;
      }

      case 'graveChill': {
        // The Grave Augur saps the standing telegraph — a chill float on the caster.
        push({ at: t, fx: [
          { type: 'float', at: ev.slot, text: `Chill −${ev.amount}`, color: C.shield },
        ] });
        t += 320;
        break;
      }

      case 'boarSummon': {
        push({ at: t, fx: [{ type: 'float', at: ev.slot, text: `🐗 Boar ${ev.hp}`, color: C.hp }] });
        t += 320;
        break;
      }
      case 'boarHit': {
        push({ at: t, shake: 8, fx: [
          { type: 'float', at: ev.slot, text: ev.killed ? 'Boar falls' : `Boar −${ev.amount}`, color: C.shield },
        ] });
        t += 340;
        break;
      }
      case 'boarExpire': {
        push({ at: t, fx: [{ type: 'float', at: ev.slot, text: 'Boar leaves', color: C.smoke }] });
        t += 260;
        break;
      }

      case 'wound': {
        // The Jinx settles over the party — destructive but not punchy: the curse creeps
        // in as a vignette and crumbles down over each living member, with a `Jinx`
        // label naming the healing-reduction debuff on each affected card.
        push({ at: t, shake: 3, fx: [
          { type: 'vignette', color: C.hex, mode: 'tint', dur: 950 },
          { type: 'float', at: 'enemy', text: 'JINX', color: C.hex, big: true },
          ...ev.slots.map((s): FxSpec => ({ type: 'glow', at: s, color: C.hex, dur: 800 })),
        ] });
        push({ at: t + 220, fx: [
          ...ev.slots.map((s): FxSpec => ({ type: 'burst', at: s, color: C.hex, count: 9, spread: 55, mode: 'fall', dur: 900 })),
          ...ev.slots.map((s): FxSpec => ({ type: 'float', at: s, text: 'Jinx', color: C.hex })),
        ] });
        t += 640;
        break;
      }

      case 'siphon': {
        push({ at: t, fx: [{ type: 'beam', from: 'mp', to: 'enemy', color: C.drain }] });
        const impact = t + 200;
        push({ at: impact, shake: 3, patch: { mp: ev.mp }, fx: [
          { type: 'burst', at: 'mp', color: C.drain, count: 14, spread: 55, mode: 'fall', dur: 850 },
          { type: 'float', at: 'mp', text: `-${ev.amount} MP`, color: C.drain },
        ] });
        t = impact + 420;
        break;
      }

      case 'consume': {
        // The Devourer feeds on its own poison, healing itself green.
        push({ at: t, patch: { enemyHp: ev.enemyHp }, shake: 6, fx: [
          { type: 'glow', at: 'enemy', color: C.hp },
          { type: 'burst', at: 'enemy', color: C.poison, count: 18, spread: 80 },
          { type: 'float', at: 'enemy', text: ev.heal > 0 ? `CONSUME +${ev.heal}` : 'CONSUME', color: C.hp, big: true },
        ] });
        t += 560;
        break;
      }

      case 'phaseChange': {
        push({ at: t, shake: 15, fx: [
          { type: 'ring', at: 'enemy', color: C.danger },
          { type: 'pillar', at: 'enemy', color: C.hex },
          { type: 'burst', at: 'enemy', color: C.white, count: 26, spread: 120 },
          { type: 'banner', text: ev.beat, color: C.danger },
          { type: 'vignette', color: C.hex, mode: 'tint', dur: 900 },
        ] });
        t += 820 + HITSTOP;
        break;
      }

      case 'cleanse': {
        push({ at: t, fx: [
          { type: 'ring', at: 1, color: C.hp },
          { type: 'burst', at: 1, color: C.hp, count: 14, spread: 70 },
          { type: 'float', at: 1, text: 'CLEANSED', color: C.hp },
        ] });
        t += 420;
        break;
      }

      case 'defeatEnemy': {
        // The kill lands, the world flashes and stops — then the banner calls it.
        push({ at: t, shake: 16, fx: [
          { type: 'vignette', color: C.white, mode: 'flash', dur: 340 },
          { type: 'burst', at: 'enemy', color: C.white, count: 30, spread: 130 },
          { type: 'ring', at: 'enemy', color: C.danger },
        ] });
        push({ at: t + HITSTOP + 140, fx: [
          { type: 'banner', text: 'ENEMY DEFEATED', color: C.taunt, dur: 1400 },
          { type: 'burst', at: 'enemy', color: C.taunt, count: 16, spread: 90, mode: 'rise', dur: 1100 },
        ] });
        t += 600 + HITSTOP + 500;
        break;
      }

      case 'wipe': {
        push({ at: t, shake: 14, fx: [
          { type: 'vignette', color: C.danger, mode: 'tint', dur: 1100 },
        ] });
        push({ at: t + 240, fx: [
          { type: 'banner', text: 'THE PARTY FALLS', color: C.danger, dur: 1400 },
        ] });
        t += 900;
        break;
      }
    }
  }

  // `paceEnd` is where the action has finished playing out (the cursor); input can
  // resume here. `total` waits for the last effect to also finish fading out — used
  // only to know when nothing is left on screen.
  const paceEnd = t;
  let maxEnd = t;
  for (const e of entries) {
    if (!e.fx) continue;
    for (const f of e.fx) maxEnd = Math.max(maxEnd, e.at + fxDuration(f));
  }
  return { entries, total: maxEnd, paceEnd };
}
