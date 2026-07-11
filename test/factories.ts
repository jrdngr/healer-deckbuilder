// Shared test factories/helpers for the engine suites. Extracted from
// engine.test.ts so any split-out suite can build the same games and hands.
import { Game } from '../src/engine';
import {
  SLOT, makeDeckCard, defaultBattleConfig, partyFromMembers,
  GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF,
} from '../src/constants';
import type { CardId, ModifierId, MemberId, EnemyDef } from '../src/constants';

// Find a hand index for a card id by stuffing the hand. Cards in the hand are
// DeckCard instances; give each a unique negative uid so it can't collide with the
// run deck's positional uids.
let testUid = -1;
export function giveCard(game: Game, cardId: CardId, upgrades: ModifierId[] = []): number {
  game.hand.push(makeDeckCard(cardId, testUid--, upgrades));
  return game.hand.length - 1;
}
// #44: the bound ability card for a default-trio slot (LEFT poison / CENTER taunt /
// RIGHT bolt). Ability cards self-resolve on their member, so play them with no
// target: g.playCard(giveAbility(g, slot)).
const SLOT_ABILITY_CARD: Record<number, CardId> = {
  [SLOT.LEFT]: 'imbuePoison', [SLOT.CENTER]: 'bolster', [SLOT.RIGHT]: 'unleash',
};
export function giveAbility(game: Game, slot: number): number {
  return giveCard(game, SLOT_ABILITY_CARD[slot]);
}

// One boss-fight builder. The per-boss factories below are thin wrappers that pin
// the def (and, for the Sentinel, a swapped-in party + a started game).
export function bossGame(
  seed: number,
  def: EnemyDef,
  { maxHP = 9999, enrageTurn = 99, party, start = false }:
    { maxHP?: number; enrageTurn?: number; party?: MemberId[]; start?: boolean } = {},
): Game {
  const cfg = defaultBattleConfig();
  if (party) cfg.party = partyFromMembers(party);
  cfg.enemy = { maxHP, boss: true, attackBonus: 0, def, enrageTurn };
  const g = new Game(seed, cfg);
  return start ? g.start() : g;
}

export const gatewardenGame = (seed: number, enrageTurn = 99): Game =>
  bossGame(seed, GATEWARDEN_DEF, { enrageTurn });
export const hexweaverGame = (seed: number, enrageTurn = 99): Game =>
  bossGame(seed, HEXWEAVER_DEF, { enrageTurn });
export const devourerGame = (seed: number, maxHP = 200, enrageTurn = 99): Game =>
  bossGame(seed, DEVOURER_DEF, { maxHP, enrageTurn });
export const sentinelBossGame = (seed: number, def: EnemyDef = GATEWARDEN_DEF): Game =>
  bossGame(seed, def, { party: ['sentinel', 'tank', 'mage'], start: true });
