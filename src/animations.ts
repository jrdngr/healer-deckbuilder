// Pure mapping from the engine's GameEvent feed to an animation timeline.
//
// No DOM, no timers, no React — just data. Given the ordered events from a single
// action, buildTimeline() returns a list of time-stamped entries: visual effects
// to spawn, display patches (staged HP / MP / death so bars and numbers move in
// step with the effects), and screen shakes. The view layer (useGame + FxLayer)
// walks the timeline with real timers and resolves the logical anchors below into
// on-screen coordinates. Keeping this pure means the whole feel can be unit-tested.

import type { GameEvent } from './engine';
import type { Slot } from './constants';

// Where an effect is pinned. Slot indices point at party member cards; 'enemy'
// is the enemy panel, 'mp' the mana bar. The overlay measures these from the DOM.
export type Anchor = 'enemy' | 'mp' | 0 | 1 | 2;

export type FxSpec =
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
  | { type: 'vignette'; color: string; mode: 'tint' | 'flash' };

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
};

// Per-member tint for the party auto-attack strikes (ranger / tank / mage).
const SLOT_COLOR: Record<Slot, string> = { 0: '#a8e85d', 1: '#cdd6e6', 2: '#b388ff' };

const TRAVEL = 240; // projectile flight time before impact lands

export function buildTimeline(events: GameEvent[]): Timeline {
  const entries: TimelineEntry[] = [];
  let t = 0;
  const push = (e: TimelineEntry): void => { entries.push(e); };

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    switch (ev.kind) {
      case 'enrage': {
        push({ at: t, shake: 11, fx: [
          { type: 'float', at: 'enemy', text: 'ENRAGED!', color: C.danger, big: true },
          { type: 'ring', at: 'enemy', color: C.danger },
          { type: 'burst', at: 'enemy', color: C.danger, count: 20, spread: 95 },
        ] });
        t += 680;
        break;
      }

      case 'poisonTick': {
        push({ at: t, patch: { enemyHp: ev.enemyHp }, fx: [
          { type: 'burst', at: 'enemy', color: C.poison, count: 11, spread: 55 },
          { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: C.poison },
        ] });
        t += 360;
        break;
      }

      case 'regenTick': {
        if (ev.amount > 0) {
          push({ at: t, patch: { memberHp: { slot: ev.slot, hp: ev.hp } },
            react: [{ slot: ev.slot, kind: 'heal' }], fx: [
            { type: 'burst', at: ev.slot, color: C.regen, count: 8, spread: 42 },
            { type: 'float', at: ev.slot, text: `+${ev.amount}`, color: C.regen },
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
        const color = ev.hidden ? C.unknown : C.enemy;
        push({ at: t, fx: [{ type: 'projectile', from: 'enemy', to: ev.slot, color }] });
        const impact = t + TRAVEL;
        if (ev.result === 'whiff') {
          push({ at: impact, fx: [{ type: 'burst', at: ev.slot, color: C.smoke, count: 6, spread: 32 }] });
          t = impact + 160;
        } else if (ev.result === 'shield') {
          push({ at: impact, shake: 4, react: [{ slot: ev.slot, kind: 'block' }], fx: [
            { type: 'shield', at: ev.slot, color: C.shield },
            { type: 'ring', at: ev.slot, color: C.shield },
            { type: 'burst', at: ev.slot, color: C.shield, count: 12, spread: 58 },
            { type: 'float', at: ev.slot, text: 'BLOCK', color: C.shield },
          ] });
          t = impact + 360;
        } else if (ev.killed) {
          // A kill stops the world for a beat: the blow, flash and collapse land
          // at impact; the damage number and the rest of the timeline wait out
          // the hitstop.
          push({
            at: impact, shake: 13, react: [{ slot: ev.slot, kind: 'death' }],
            fx: [
              { type: 'burst', at: ev.slot, color, count: 14, spread: 62 },
              { type: 'burst', at: ev.slot, color: C.white, count: 22, spread: 90 },
            ],
            patch: { memberHp: { slot: ev.slot, hp: ev.hp }, memberDead: ev.slot },
          });
          push({ at: impact + HITSTOP, fx: [
            { type: 'float', at: ev.slot, text: `-${ev.amount}`, color: C.danger, big: true },
          ] });
          t = impact + HITSTOP + 520;
        } else {
          push({
            at: impact, shake: 7, react: [{ slot: ev.slot, kind: 'hit' }],
            fx: [
              { type: 'burst', at: ev.slot, color, count: 14, spread: 62 },
              { type: 'float', at: ev.slot, text: `-${ev.amount}`, color: C.danger },
            ],
            patch: { memberHp: { slot: ev.slot, hp: ev.hp } },
          });
          t = impact + 360;
        }
        break;
      }

      case 'partyAttack': {
        const color = SLOT_COLOR[ev.slot];
        push({ at: t, react: [{ slot: ev.slot, kind: 'lunge' }],
          fx: [{ type: 'projectile', from: ev.slot, to: 'enemy', color }] });
        const impact = t + TRAVEL;
        push({ at: impact, shake: 5, patch: { enemyHp: ev.enemyHp }, fx: [
          { type: 'burst', at: 'enemy', color, count: 12, spread: 58 },
          { type: 'float', at: 'enemy', text: `-${ev.amount}`, color: C.damageText },
        ] });
        t = impact + 200; // tight cadence so the three strikes read as a combo
        break;
      }

      case 'heal': {
        // Gather a run of consecutive heals (Group Heal emits one per member) and
        // cascade them so they land together rather than dragging out one by one.
        const run: typeof ev[] = [ev];
        while (i + 1 < events.length && events[i + 1].kind === 'heal') run.push(events[++i] as typeof ev);
        let maxOff = 0;
        run.forEach((h, k) => {
          const off = k * 110;
          maxOff = off;
          if (h.amount > 0) {
            push({ at: t + off, patch: { memberHp: { slot: h.slot, hp: h.hp } },
              react: [{ slot: h.slot, kind: 'heal' }], fx: [
              { type: 'glow', at: h.slot, color: C.hp },
              { type: 'burst', at: h.slot, color: C.hp, count: 12, spread: 52 },
              { type: 'float', at: h.slot, text: `+${h.amount}`, color: C.hp },
            ] });
          } else {
            push({ at: t + off, fx: [{ type: 'burst', at: h.slot, color: C.hp, count: 5, spread: 30 }] });
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
        push({ at: t, fx: [
          { type: 'shield', at: ev.slot, color: C.shield },
          { type: 'ring', at: ev.slot, color: C.shield },
          { type: 'float', at: ev.slot, text: '🛡', color: C.shield, big: true },
        ] });
        t += 420;
        break;
      }

      case 'defenseApplied': {
        // Phalanx (#17): a standing damage reduction settles on the member.
        push({ at: t, fx: [
          { type: 'glow', at: ev.slot, color: C.taunt },
          { type: 'ring', at: ev.slot, color: C.taunt },
          { type: 'float', at: ev.slot, text: `DEF ${ev.amount}`, color: C.taunt },
        ] });
        t += 400;
        break;
      }

      case 'braceApplied': {
        // Brace (#17): a one-shot blunting ward, visually a lighter Shield.
        push({ at: t, fx: [
          { type: 'shield', at: ev.slot, color: C.smoke },
          { type: 'float', at: ev.slot, text: 'BRACE', color: C.white },
        ] });
        t += 380;
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

      case 'wardApplied': {
        // Aegis Font (#22): overheal crystallizes into a Ward buffer.
        push({ at: t, fx: [
          { type: 'shield', at: ev.slot, color: C.hp },
          { type: 'float', at: ev.slot, text: `WARD ${ev.amount}`, color: C.hp },
        ] });
        t += 380;
        break;
      }

      case 'chime': {
        // Dusk Chime (#22): the incoming blow hangs in the air a turn longer.
        push({ at: t, shake: 3, fx: [
          { type: 'ring', at: 'enemy', color: C.mp },
          { type: 'float', at: 'enemy', text: 'DELAYED', color: C.mp, big: true },
        ] });
        t += 520;
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

      case 'surge': {
        // Surge (#16): the next card is free — flare the mana bar.
        push({ at: t, fx: [
          { type: 'glow', at: 'mp', color: C.mp },
          { type: 'ring', at: 'mp', color: C.mp },
          { type: 'float', at: 'mp', text: 'NEXT CARD FREE', color: C.mp },
        ] });
        t += 380;
        break;
      }

      case 'hymn': {
        // Battle Hymn (#16): the whole party rallies for this phase's autos.
        push({ at: t, fx: [
          { type: 'glow', at: 0, color: C.taunt },
          { type: 'glow', at: 1, color: C.taunt },
          { type: 'glow', at: 2, color: C.taunt },
          { type: 'float', at: 1, text: `+${ev.bonus} ATK`, color: C.taunt, big: true },
        ] });
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
        push({ at: t, fx: [{ type: 'projectile', from: ev.slot, to: 'enemy', color: C.poison }] });
        push({ at: t + TRAVEL, fx: [
          { type: 'burst', at: 'enemy', color: C.poison, count: 16, spread: 70 },
          { type: 'float', at: 'enemy', text: `☠ +${ev.amount}`, color: C.poison },
        ] });
        t += TRAVEL + 360;
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
        // Hex settles over the whole party — a curse pulse on each member.
        push({ at: t, shake: 5, fx: [
          { type: 'float', at: 'enemy', text: 'HEX', color: C.hex, big: true },
          { type: 'glow', at: 0, color: C.hex },
          { type: 'glow', at: 1, color: C.hex },
          { type: 'glow', at: 2, color: C.hex },
          { type: 'burst', at: 1, color: C.hex, count: 16, spread: 90 },
        ] });
        t += 560;
        break;
      }

      case 'siphon': {
        push({ at: t, fx: [{ type: 'beam', from: 'mp', to: 'enemy', color: C.drain }] });
        const impact = t + 200;
        push({ at: impact, shake: 5, patch: { mp: ev.mp }, fx: [
          { type: 'burst', at: 'mp', color: C.drain, count: 14, spread: 60 },
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
          { type: 'float', at: 'enemy', text: ev.beat, color: C.danger, big: true },
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
        push({ at: t, shake: 16, fx: [
          { type: 'burst', at: 'enemy', color: C.white, count: 30, spread: 130 },
          { type: 'ring', at: 'enemy', color: C.danger },
          { type: 'float', at: 'enemy', text: 'DEFEATED', color: C.danger, big: true },
        ] });
        t += 600 + HITSTOP;
        break;
      }

      case 'wipe': {
        push({ at: t, shake: 14, fx: [
          { type: 'float', at: 'enemy', text: 'DEFEAT', color: C.danger, big: true },
        ] });
        t += 500;
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
    for (const f of e.fx) maxEnd = Math.max(maxEnd, e.at + FX_DURATION[f.type]);
  }
  return { entries, total: maxEnd, paceEnd };
}
