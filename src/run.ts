// The run / campaign layer: a pure, DOM-free model of a whole run — gold, the
// persistent deck, party & healer progression, the branching map, and node
// progression. It produces a BattleConfig for each fight (see engine.ts) and
// holds all the shop/event resolution logic so it can be unit-tested directly.
//
// Like the engine, every random choice goes through a seeded Rng so a run is
// reproducible from its seed.

import {
  ENEMY_BASE_HP, ENEMY_HP_PER_FIGHT, defaultDeck, defaultParty, DEFAULT_HEALER, makeDeckCard,
  canApplyModifier, MODIFIERS, MODIFIER_IDS, RARITY_PRICE, RARITY_WEIGHT,
  CARD_RARITY, CARD_POOL, PARTY_UPGRADES, HEALER_UPGRADES, EVENTS,
  NODE_TYPE_WEIGHTS, FIGHT_COUNT, FORK_COUNT, BRANCHES_PER_FORK, NODES_PER_BRANCH,
  GOLD_PER_FIGHT, SHOP_SIZE, EVENT_CARD_OFFER_SIZE, MAX_UPGRADE_SLOTS,
} from './constants';
import type {
  Slot, CardId, ModifierId, DeckCard, PartyMemberConfig, HealerConfig, BattleConfig,
  NodeType, PartyUpgradeDef, HealerUpgradeDef, EventDef,
  CardOffer, ModifierOffer, PartyUpgradeOffer, HealerUpgradeOffer,
} from './constants';
import { makeRng, weightedPick } from './rng';
import type { Rng } from './rng';

export interface MapNode { type: NodeType; }
export interface Branch { nodes: MapNode[]; } // length NODES_PER_BRANCH
export interface Fork { branches: Branch[]; }  // length BRANCHES_PER_FORK

export type RunStatus = 'playing' | 'won' | 'lost';

// Where the player currently is in the run. The run opens on 'start' (the map),
// from which the player manually enters the first fight.
export type RunLocation =
  | { kind: 'start' }
  | { kind: 'fight'; fightIndex: number }
  | { kind: 'forkChoice'; forkIndex: number }
  | { kind: 'node'; forkIndex: number; branch: number; index: number; nodeType: NodeType };

// The rolled content of the current non-fight node (stable for the visit).
export type NodeContent =
  | { type: 'cardShop'; offers: CardOffer[] }
  | { type: 'cardUpgrade'; offers: ModifierOffer[] }
  | { type: 'partyUpgrade'; offers: PartyUpgradeOffer[] }
  | { type: 'healerUpgrade'; offers: HealerUpgradeOffer[] }
  | { type: 'event'; event: EventDef };

export class Run {
  seed: number;
  rng: Rng;
  gold: number;
  deck: DeckCard[];
  party: PartyMemberConfig[];
  healer: HealerConfig;
  map: Fork[];
  status: RunStatus;
  location: RunLocation;
  nodeContent: NodeContent | null;
  private nextUid: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.gold = 0;
    this.deck = defaultDeck();
    this.party = defaultParty();
    this.healer = { ...DEFAULT_HEALER };
    this.nextUid = this.deck.length; // new cards continue the uid sequence
    this.map = this._generateMap();
    this.status = 'playing';
    this.location = { kind: 'start' };
    this.nodeContent = null;
  }

  // Leave the opening map and enter the first fight.
  beginRun(): void {
    if (this.location.kind !== 'start') return;
    this.location = { kind: 'fight', fightIndex: 0 };
    this.nodeContent = null;
  }

  // ---- map generation ------------------------------------------------------

  _generateMap(): Fork[] {
    const forks: Fork[] = [];
    for (let f = 0; f < FORK_COUNT; f++) {
      const branches: Branch[] = [];
      for (let b = 0; b < BRANCHES_PER_FORK; b++) branches.push({ nodes: this._rollBranch() });
      forks.push({ branches });
    }
    return forks;
  }

  // A branch's two nodes; the second is rolled to differ from the first.
  _rollBranch(): MapNode[] {
    const first = weightedPick(NODE_TYPE_WEIGHTS, this.rng);
    let second = weightedPick(NODE_TYPE_WEIGHTS, this.rng);
    let guard = 0;
    while (second === first && guard++ < 20) second = weightedPick(NODE_TYPE_WEIGHTS, this.rng);
    return [{ type: first }, { type: second }];
  }

  // ---- progression ---------------------------------------------------------

  // The current fight's index (0 when not at a fight).
  get fightIndex(): number {
    return this.location.kind === 'fight' ? this.location.fightIndex : 0;
  }

  get isBossFight(): boolean {
    return this.location.kind === 'fight' && this.location.fightIndex === FIGHT_COUNT - 1;
  }

  // Enemy HP escalates each fight: ENEMY_BASE_HP on the first, +ENEMY_HP_PER_FIGHT thereafter.
  enemyMaxHP(): number {
    return ENEMY_BASE_HP + ENEMY_HP_PER_FIGHT * this.fightIndex;
  }

  // Build the config for the fight at the current location.
  toBattleConfig(): BattleConfig {
    return {
      deck: this.deck.map((c) => ({ ...c, upgrades: [...c.upgrades] })),
      party: this.party.map((p) => ({ ...p })),
      healer: { ...this.healer },
      enemy: { maxHP: this.enemyMaxHP(), actionsPerTurn: this.isBossFight ? 2 : 1 },
    };
  }

  // Resolve the current fight as a win: award gold and advance to the fork (or
  // win the run if that was the boss).
  winFight(): void {
    if (this.location.kind !== 'fight') return;
    const fi = this.location.fightIndex;
    if (fi >= FIGHT_COUNT - 1) { this.status = 'won'; return; }
    this.gold += GOLD_PER_FIGHT;
    this.location = { kind: 'forkChoice', forkIndex: fi };
    this.nodeContent = null;
  }

  loseFight(): void {
    this.status = 'lost';
  }

  // Commit to a branch at the current fork and enter its first node.
  chooseBranch(branch: number): void {
    if (this.location.kind !== 'forkChoice') return;
    const forkIndex = this.location.forkIndex;
    this._gotoNode(forkIndex, branch, 0);
  }

  // Finish the current node, moving to the branch's next node or the next fight.
  completeNode(): void {
    if (this.location.kind !== 'node') return;
    const { forkIndex, branch, index } = this.location;
    if (index < NODES_PER_BRANCH - 1) this._gotoNode(forkIndex, branch, index + 1);
    else {
      this.location = { kind: 'fight', fightIndex: forkIndex + 1 };
      this.nodeContent = null;
    }
  }

  _gotoNode(forkIndex: number, branch: number, index: number): void {
    const nodeType = this.map[forkIndex].branches[branch].nodes[index].type;
    this.location = { kind: 'node', forkIndex, branch, index, nodeType };
    this._enterNode(nodeType);
  }

  // Roll (once) the storefront / event for the node just entered.
  _enterNode(nodeType: NodeType): void {
    switch (nodeType) {
      case 'cardShop': this.nodeContent = { type: 'cardShop', offers: this.rollCardShop() }; break;
      case 'cardUpgrade': this.nodeContent = { type: 'cardUpgrade', offers: this.rollCardUpgradeShop() }; break;
      case 'partyUpgrade': this.nodeContent = { type: 'partyUpgrade', offers: this.rollPartyShop() }; break;
      case 'healerUpgrade': this.nodeContent = { type: 'healerUpgrade', offers: this.rollHealerShop() }; break;
      case 'event': this.nodeContent = { type: 'event', event: this.rollEvent() }; break;
      default: this.nodeContent = null; break;
    }
  }

  // ---- storefront rolls ----------------------------------------------------

  // Weighted pick without replacement.
  private _pickDistinct<K>(entries: Array<[K, number]>, n: number): K[] {
    const pool = entries.slice();
    const out: K[] = [];
    while (out.length < n && pool.length > 0) {
      const k = weightedPick(pool, this.rng);
      out.push(k);
      pool.splice(pool.findIndex(([key]) => key === k), 1);
    }
    return out;
  }

  rollCardShop(): CardOffer[] {
    const ids = this._pickDistinct(
      CARD_POOL.map((id): [CardId, number] => [id, RARITY_WEIGHT[CARD_RARITY[id]]]),
      SHOP_SIZE.cardShop,
    );
    return ids.map((cardId): CardOffer => ({
      cardId, rarity: CARD_RARITY[cardId], price: RARITY_PRICE[CARD_RARITY[cardId]],
    }));
  }

  rollCardUpgradeShop(): ModifierOffer[] {
    const mods = this._pickDistinct(
      MODIFIER_IDS.map((id): [ModifierId, number] => [id, RARITY_WEIGHT[MODIFIERS[id].rarity]]),
      SHOP_SIZE.cardUpgrade,
    );
    return mods.map((modifier): ModifierOffer => ({
      modifier, rarity: MODIFIERS[modifier].rarity, price: RARITY_PRICE[MODIFIERS[modifier].rarity],
    }));
  }

  rollPartyShop(): PartyUpgradeOffer[] {
    const defs = this._pickDistinct(
      PARTY_UPGRADES.map((d): [PartyUpgradeDef, number] => [d, RARITY_WEIGHT[d.rarity]]),
      SHOP_SIZE.partyUpgrade,
    );
    return defs.map((def): PartyUpgradeOffer => ({ def, price: RARITY_PRICE[def.rarity] }));
  }

  rollHealerShop(): HealerUpgradeOffer[] {
    const defs = this._pickDistinct(
      HEALER_UPGRADES.map((d): [HealerUpgradeDef, number] => [d, RARITY_WEIGHT[d.rarity]]),
      SHOP_SIZE.healerUpgrade,
    );
    return defs.map((def): HealerUpgradeOffer => ({ def, price: RARITY_PRICE[def.rarity] }));
  }

  rollEvent(): EventDef {
    return EVENTS[Math.floor(this.rng() * EVENTS.length)];
  }

  // ---- deck / progression mutators -----------------------------------------

  addCard(cardId: CardId, upgrades: ModifierId[] = []): DeckCard {
    const card = makeDeckCard(cardId, this.nextUid++, upgrades);
    this.deck.push(card);
    return card;
  }

  removeCard(uid: number): boolean {
    const i = this.deck.findIndex((c) => c.uid === uid);
    if (i < 0) return false;
    this.deck.splice(i, 1);
    return true;
  }

  applyModifier(uid: number, mod: ModifierId): boolean {
    const card = this.deck.find((c) => c.uid === uid);
    if (!card || !canApplyModifier(card, mod)) return false;
    card.upgrades.push(mod);
    return true;
  }

  applyPartyUpgrade(slot: Slot, def: PartyUpgradeDef): void {
    const p = this.party[slot];
    if (def.stat === 'maxHP') p.maxHP += def.amount;
    else if (def.stat === 'damage') p.damage += def.amount;
    else p.abilityPower += def.amount;
  }

  applyHealerUpgrade(def: HealerUpgradeDef): void {
    const h = this.healer;
    if (def.stat === 'maxMana') h.maxMana += def.amount;
    else if (def.stat === 'handSize') h.handSize += def.amount;
    else if (def.stat === 'restRegen') h.restRegen += def.amount;
    else h.passiveMp += def.amount;
  }

  // ---- shop purchases (operate on the current node's storefront) ------------

  // Buy the card-shop offer at `index`, adding it to the deck and removing the
  // offer. Returns false if unaffordable / out of range.
  buyCardOffer(index: number): boolean {
    if (this.nodeContent?.type !== 'cardShop') return false;
    const offer = this.nodeContent.offers[index];
    if (!offer || this.gold < offer.price) return false;
    this.gold -= offer.price;
    this.addCard(offer.cardId);
    this.nodeContent.offers.splice(index, 1);
    return true;
  }

  // Buy the modifier offer at `index` and apply it to the deck card `targetUid`.
  // Both the gold and the slot/eligibility must be valid.
  buyModifierOffer(index: number, targetUid: number): boolean {
    if (this.nodeContent?.type !== 'cardUpgrade') return false;
    const offer = this.nodeContent.offers[index];
    if (!offer || this.gold < offer.price) return false;
    const card = this.deck.find((c) => c.uid === targetUid);
    if (!card || !canApplyModifier(card, offer.modifier)) return false;
    this.gold -= offer.price;
    card.upgrades.push(offer.modifier);
    this.nodeContent.offers.splice(index, 1);
    return true;
  }

  // Buy the party-upgrade offer at `index`, applying it to member `slot`.
  buyPartyOffer(index: number, slot: Slot): boolean {
    if (this.nodeContent?.type !== 'partyUpgrade') return false;
    const offer = this.nodeContent.offers[index];
    if (!offer || this.gold < offer.price) return false;
    this.gold -= offer.price;
    this.applyPartyUpgrade(slot, offer.def);
    this.nodeContent.offers.splice(index, 1);
    return true;
  }

  // Buy the healer-upgrade offer at `index`.
  buyHealerOffer(index: number): boolean {
    if (this.nodeContent?.type !== 'healerUpgrade') return false;
    const offer = this.nodeContent.offers[index];
    if (!offer || this.gold < offer.price) return false;
    this.gold -= offer.price;
    this.applyHealerUpgrade(offer.def);
    this.nodeContent.offers.splice(index, 1);
    return true;
  }

  // ---- event resolution ----------------------------------------------------

  // A few distinct random cards for the "add a card" event choice.
  eventCardOffer(n: number = EVENT_CARD_OFFER_SIZE): CardId[] {
    return this._pickDistinct(
      CARD_POOL.map((id): [CardId, number] => [id, RARITY_WEIGHT[CARD_RARITY[id]]]),
      n,
    );
  }

  // Casino Cart: free flip — 50% +75g, 25% +25g, 25% −25g (gold floored at 0).
  gambleGold(): { delta: number; gold: number } {
    const roll = weightedPick(
      [['big', 50], ['small', 25], ['lose', 25]] as Array<['big' | 'small' | 'lose', number]>,
      this.rng,
    );
    const delta = roll === 'big' ? 75 : roll === 'small' ? 25 : -25;
    this.gold = Math.max(0, this.gold + delta);
    return { delta, gold: this.gold };
  }

  // Forgotten Shrine — deck cards that can still take some upgrade.
  shrineEligibleCards(): DeckCard[] {
    return this.deck.filter(
      (c) => c.upgrades.length < MAX_UPGRADE_SLOTS && MODIFIER_IDS.some((m) => canApplyModifier(c, m)),
    );
  }

  eligibleModifiersFor(card: DeckCard): ModifierId[] {
    return MODIFIER_IDS.filter((m) => canApplyModifier(card, m));
  }

  // Apply a random eligible modifier to the chosen card; returns what landed.
  shrineBlessCard(uid: number): ModifierId | null {
    const card = this.deck.find((c) => c.uid === uid);
    if (!card) return null;
    const mods = this.eligibleModifiersFor(card);
    if (mods.length === 0) return null;
    const mod = mods[Math.floor(this.rng() * mods.length)];
    card.upgrades.push(mod);
    return mod;
  }

  // Apply a random party stat boost to the chosen member; returns what landed.
  shrineBlessMember(slot: Slot): PartyUpgradeDef {
    const def = PARTY_UPGRADES[Math.floor(this.rng() * PARTY_UPGRADES.length)];
    this.applyPartyUpgrade(slot, def);
    return def;
  }
}
