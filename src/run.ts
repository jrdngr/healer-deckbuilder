// The run / campaign layer: a pure, DOM-free model of a whole run — gold, the
// persistent deck, party & healer progression, the branching map, and node
// progression. It produces a BattleConfig for each fight (see engine.ts) and
// holds all the shop/event resolution logic so it can be unit-tested directly.
//
// Like the engine, every random choice goes through a seeded Rng so a run is
// reproducible from its seed.

import {
  ENEMY_HP_BY_FIGHT, ENEMY_ATTACK_BONUS, ENEMY_ENRAGE_TURN_BY_FIGHT, isActBoss, actOfFight,
  ENEMY_MAX_HP, ENRAGE_TURN, defaultDeck, defaultParty, DEFAULT_HEALER, makeDeckCard,
  canApplyModifier, MODIFIERS, MODIFIER_IDS, RARITY_PRICE, RARITY_WEIGHT,
  CARD_RARITY, CARD_POOL, PARTY_UPGRADES, HEALER_UPGRADES, EVENTS,
  NODE_TYPE_WEIGHTS, FIGHT_COUNT, FORK_COUNT, BRANCHES_PER_FORK, NODES_PER_BRANCH,
  GOLD_PER_FIGHT, SHOP_SIZE, EVENT_CARD_OFFER_SIZE, MAX_UPGRADE_SLOTS,
  PASSIVE_MP_CAP, CARD_REMOVAL_PRICE, CASINO_SAFE_GOLD,
  CURSED_CHEST_GOLD, MERCENARY_PRICE, MERCENARY_DAMAGE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, BLOOD_ALTAR_MIN_HP,
  DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, ACT_BOSS_DEFS, ENCOUNTER_TABLE, ENEMY_DEF_BY_ID,
  RELICS, RELIC_IDS, RELIC_PRICE, ACT3_COUNTER_RELICS, DIFFICULTIES,
  SPOILS_OFFER_SIZE, RELIQUARY_STOCK, RELIQUARY_REMOVALS_MAX,
  HAGGLER_DISCOUNT, HAGGLER_FLOOR, CURSE_PRICE, CURSE_SHRINE_GOLD, RUSTY_CROWN_GOLD,
  MAX_INJURIES, injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty, INFIRMARY_PRICE,
  injuryRecordCap, injuryIncapacitates,
  partyFromMembers, PARTY_SIZE, DRAFT_POOL, rollDraft,
} from './constants';
import type {
  Slot, CardId, ModifierId, DeckCard, PartyMemberConfig, HealerConfig, BattleConfig, MemberId,
  NodeType, PartyUpgradeDef, HealerUpgradeDef, EventDef, EnemyDef, RelicId, Difficulty,
  CardOffer, ModifierOffer, PartyUpgradeOffer, HealerUpgradeOffer, RelicOffer,
} from './constants';
import { makeRng, weightedPick, shuffle } from './rng';
import type { Rng } from './rng';

export interface MapNode { type: NodeType; }
export interface Branch { nodes: MapNode[]; } // length NODES_PER_BRANCH
export interface Fork { branches: Branch[]; }  // length BRANCHES_PER_FORK

export type RunStatus = 'playing' | 'won' | 'lost';

// Where the player currently is in the run. The run opens on 'start' (the map),
// from which the player manually enters the first fight.
export type RunLocation =
  | { kind: 'start' }
  | { kind: 'draft' } // party draft before the first fight (#27 skeleton, #30 full)
  | { kind: 'fight'; fightIndex: number }
  | { kind: 'spoils'; fightIndex: number } // relic pick after an act-1/2 boss (#21)
  | { kind: 'forkChoice'; forkIndex: number }
  | { kind: 'node'; forkIndex: number; branch: number; index: number; nodeType: NodeType };

// The rolled content of the current non-fight node (stable for the visit).
export type NodeContent =
  | { type: 'cardShop'; offers: CardOffer[] }
  | { type: 'cardUpgrade'; offers: ModifierOffer[] }
  | { type: 'partyUpgrade'; offers: PartyUpgradeOffer[] }
  | { type: 'healerUpgrade'; offers: HealerUpgradeOffer[] }
  | { type: 'event'; event: EventDef }
  | { type: 'spoils'; offers: RelicOffer[] }                          // free pick of 1 (#21)
  | { type: 'reliquary'; offers: RelicOffer[]; removalsLeft: number } // relic shop (#21)
  | { type: 'infirmary'; price: number }                              // clear scars for gold (DR1)
  | { type: 'draft'; pairs: MemberId[][] };                           // three 1-of-2 draft picks (#27/#30)

// Boundary-only save format. Bumped if the shape changes so stale saves are
// discarded rather than misread. (v2: relics + spoils/reliquary content, #21;
// v3: difficulty, #23; v4: fightsWon, #24; v5: per-member injuries + infirmary
// node content, DR1; v6: drafted member identity + draft location/content, #27.)
export const RUN_SAVE_VERSION = 6;

export interface RunSnapshot {
  version: number;
  seed: number;
  difficulty: Difficulty;
  rngState: number;
  nextUid: number;
  gold: number;
  deck: DeckCard[];
  party: PartyMemberConfig[];
  healer: HealerConfig;
  relics: RelicId[];
  spentRelics: RelicId[];
  fightsWon: number;
  map: Fork[];
  status: RunStatus;
  location: RunLocation;
  nodeContent: NodeContent | null;
  currentEnemyDef: EnemyDef | null;
}

export class Run {
  seed: number;
  difficulty: Difficulty;
  rng: Rng;
  gold: number;
  deck: DeckCard[];
  party: PartyMemberConfig[];
  healer: HealerConfig;
  relics: RelicId[];      // run-long passives (#21), in acquisition order
  spentRelics: RelicId[]; // once-per-RUN relics already consumed (#22)
  fightsWon: number;      // fights won this run (drives the end-of-run score, #24)
  map: Fork[];
  status: RunStatus;
  location: RunLocation;
  nodeContent: NodeContent | null;
  currentEnemyDef: EnemyDef | null; // enemy rolled for the current fight (stable for the visit)
  private nextUid: number;

  constructor(seed: number = Date.now(), difficulty: Difficulty = 'standard') {
    this.seed = seed >>> 0;
    this.difficulty = difficulty;
    this.rng = makeRng(this.seed);
    this.gold = 0;
    this.deck = defaultDeck();
    this.party = defaultParty();
    this.healer = { ...DEFAULT_HEALER };
    this.relics = [];
    this.spentRelics = [];
    this.fightsWon = 0;
    this.nextUid = this.deck.length; // new cards continue the uid sequence
    this.map = this._generateMap();
    this.status = 'playing';
    this.location = { kind: 'start' };
    this.nodeContent = null;
    this.currentEnemyDef = null;
  }

  // ---- save / resume (boundary-only, issue 11) -----------------------------
  // The run layer is pure and seed-deterministic, so a snapshot is just its
  // fields plus the RNG position. Serialize only between fights/nodes (never
  // mid-fight — that is a standing cut). All fields are plain data (EnemyDef,
  // offers, map) so the snapshot round-trips through JSON.

  toJSON(): RunSnapshot {
    return {
      version: RUN_SAVE_VERSION,
      seed: this.seed,
      difficulty: this.difficulty,
      rngState: this.rng.getState(),
      nextUid: this.nextUid,
      gold: this.gold,
      deck: this.deck,
      party: this.party,
      healer: this.healer,
      relics: this.relics,
      spentRelics: this.spentRelics,
      fightsWon: this.fightsWon,
      map: this.map,
      status: this.status,
      location: this.location,
      nodeContent: this.nodeContent,
      currentEnemyDef: this.currentEnemyDef,
    };
  }

  // Rebuild a Run from a snapshot, restoring the exact RNG position so the resumed
  // run continues the identical deterministic stream.
  static fromJSON(snap: RunSnapshot): Run {
    const run = new Run(snap.seed, snap.difficulty ?? 'standard');
    run.rng.setState(snap.rngState); // continue the saved stream, not a fresh one
    run.nextUid = snap.nextUid;
    run.gold = snap.gold;
    run.deck = snap.deck.map((c) => ({ ...c, upgrades: [...c.upgrades] }));
    run.party = snap.party.map((p) => ({ ...p, injuries: p.injuries ?? 0 }));
    run.healer = { ...snap.healer };
    run.relics = [...snap.relics];
    run.spentRelics = [...(snap.spentRelics ?? [])];
    run.fightsWon = snap.fightsWon ?? 0;
    run.map = snap.map;
    run.status = snap.status;
    run.location = snap.location;
    run.nodeContent = snap.nodeContent;
    run.currentEnemyDef = snap.currentEnemyDef;
    return run;
  }

  // Leave the opening map and enter the first fight.
  beginRun(): void {
    if (this.location.kind !== 'start') return;
    this._enterFight(0);
  }

  // Full draft (#30): roll three 1-of-2 picks from the pool of 8 (generator
  // guarantees a viable party is achievable), then the player picks one per pair
  // and assigns L/C/R. Enter it from the start screen.
  beginDraft(): void {
    if (this.location.kind !== 'start') return;
    this.location = { kind: 'draft' };
    // shuffle mutates in place — copy the shared DRAFT_POOL so it is never corrupted.
    this.nodeContent = { type: 'draft', pairs: rollDraft(shuffle([...DRAFT_POOL], this.rng)) };
  }

  // Seat a drafted party (one member id per slot) and open the first fight. Ignores
  // malformed picks (wrong size / unknown id) so a crude UI can't wedge the run.
  chooseDraft(ids: MemberId[]): void {
    if (this.location.kind !== 'draft') return;
    if (ids.length !== PARTY_SIZE || !ids.every((id) => DRAFT_POOL.includes(id))) return;
    this.party = partyFromMembers(ids);
    this.nodeContent = null;
    this._enterFight(0);
  }

  // Enter a fight: set the location and the enemy that occupies it.
  _enterFight(fightIndex: number): void {
    this.location = { kind: 'fight', fightIndex };
    this.nodeContent = null;
    this.currentEnemyDef = this.peekEncounter(fightIndex);
  }

  // The enemy occupying a fight slot. Derived from a per-fight SUB-seed rather
  // than the run's rng stream (#24), so the map fork can preview the next
  // fight's foe (flaw #15) without consuming — or depending on — stream position.
  // Still fully deterministic in the run seed.
  peekEncounter(fightIndex: number): EnemyDef {
    if (isActBoss(fightIndex)) return ACT_BOSS_DEFS[actOfFight(fightIndex)] ?? BOSS_ENEMY_DEF;
    const row = ENCOUNTER_TABLE[fightIndex];
    if (!row || row.length === 0) return DEFAULT_ENEMY_DEF;
    const sub = makeRng((this.seed ^ Math.imul(fightIndex + 1, 0x9e3779b9)) >>> 0);
    const id = weightedPick(row, sub);
    return ENEMY_DEF_BY_ID[id] ?? DEFAULT_ENEMY_DEF;
  }

  // ---- map generation ------------------------------------------------------

  _generateMap(): Fork[] {
    const forks: Fork[] = [];
    for (let f = 0; f < FORK_COUNT; f++) forks.push(this._rollFork());
    // Reliquary (#21): exactly twice per run — replace one rolled node in a
    // mid-act fork of act 2 and of act 3. It is never part of NODE_TYPE_WEIGHTS,
    // so these two injections are the only way it appears.
    for (const forkChoices of [[3, 4], [6, 7]]) {
      const fork = forks[forkChoices[Math.floor(this.rng() * forkChoices.length)]];
      const branch = fork.branches[Math.floor(this.rng() * fork.branches.length)];
      const idx = Math.floor(this.rng() * branch.nodes.length);
      branch.nodes[idx] = { type: 'reliquary' };
    }
    return forks;
  }

  // A fork's branches. Every node across the whole fork is rolled to be a
  // distinct type, so the player never sees a duplicate among the choices.
  _rollFork(): Fork {
    const types = this._pickDistinct(
      NODE_TYPE_WEIGHTS.map(([t, w]): [NodeType, number] => [t, w]),
      BRANCHES_PER_FORK * NODES_PER_BRANCH,
    );
    const branches: Branch[] = [];
    for (let b = 0; b < BRANCHES_PER_FORK; b++) {
      const nodes = types
        .slice(b * NODES_PER_BRANCH, (b + 1) * NODES_PER_BRANCH)
        .map((type): MapNode => ({ type }));
      branches.push({ nodes });
    }
    return { branches };
  }

  // ---- progression ---------------------------------------------------------

  // The current fight's index (0 when not at a fight).
  get fightIndex(): number {
    return this.location.kind === 'fight' ? this.location.fightIndex : 0;
  }

  // The fight a location is at or headed toward — forks and nodes sit between
  // fight N (just won) and fight N+1. Lets the start screen describe a save
  // ("Act 2 · Fight 5 / 9") without rehydrating the whole Run.
  static upcomingFightIndex(location: RunLocation): number {
    switch (location.kind) {
      case 'fight': return location.fightIndex;
      case 'spoils': return Math.min(location.fightIndex + 1, FIGHT_COUNT - 1);
      case 'forkChoice': return Math.min(location.forkIndex + 1, FIGHT_COUNT - 1);
      case 'node': return Math.min(location.forkIndex + 1, FIGHT_COUNT - 1);
      default: return 0;
    }
  }

  // The act (0-based) the current fight belongs to.
  get act(): number { return actOfFight(this.fightIndex); }

  // A fight is a boss fight when it is the last fight of its act (fights 2, 5, 8).
  get isBossFight(): boolean {
    return this.location.kind === 'fight' && isActBoss(this.location.fightIndex);
  }

  // Enemy HP follows the per-act curve (ENEMY_HP_BY_FIGHT).
  enemyMaxHP(): number {
    return ENEMY_HP_BY_FIGHT[this.fightIndex] ?? ENEMY_MAX_HP;
  }

  // Build the config for the fight at the current location. The difficulty
  // preset (#23) applies as modifiers over the tuned per-act curve.
  toBattleConfig(): BattleConfig {
    const d = DIFFICULTIES[this.difficulty];
    return {
      deck: this.deck.map((c) => ({ ...c, upgrades: [...c.upgrades] })),
      // Injuries (DR1) bite here: the fight gets a member with reduced base
      // stats, so every downstream engine site (HP construction, healing clamp,
      // Vanguard full-HP check, ability strength) sees the scarred numbers with
      // no further plumbing. maxHP floored at 1 and damage at 0; abilityPower may
      // go negative (a Broken member), floored where each ability resolves.
      party: this.party.map((p) => ({
        maxHP: Math.max(1, p.maxHP - injuryMaxHPPenalty(p.injuries)),
        damage: Math.max(0, p.damage - injuryDamagePenalty(p.injuries)),
        abilityPower: p.abilityPower - injuryAbilityPenalty(p.injuries),
        injuries: p.injuries,
        member: p.member, // drafted identity (#27) — dropping this reverts the fight to trio abilities
        // 'incapacitate' injury mode: the member enters the fight dead and cannot
        // be Resurrected (healing the scar at an Infirmary restores them).
        incapacitated: injuryIncapacitates(p.injuries),
      })),
      healer: { ...this.healer },
      relics: [...this.relics],
      spentRelics: [...this.spentRelics],
      enemy: {
        maxHP: Math.round(this.enemyMaxHP() * d.hpMult),
        boss: this.isBossFight,
        attackBonus: Math.max(0, (ENEMY_ATTACK_BONUS[this.fightIndex] ?? 0) + d.attackDelta),
        def: this.currentEnemyDef ?? (this.isBossFight ? BOSS_ENEMY_DEF : DEFAULT_ENEMY_DEF),
        enrageTurn: (ENEMY_ENRAGE_TURN_BY_FIGHT[this.fightIndex] ?? ENRAGE_TURN) + d.enrageDelta,
      },
    };
  }

  // Resolve the current fight as a win: award gold and advance to the fork (or
  // win the run if that was the boss).
  winFight(): void {
    if (this.location.kind !== 'fight') return;
    const fi = this.location.fightIndex;
    this.fightsWon += 1;
    // Mending Totem (DR1) mends after the victory — including any scar this fight
    // just recorded (the driver records injuries before winFight), so it can undo
    // a fresh wound as well as an old one.
    this._mendMostInjured();
    if (fi >= FIGHT_COUNT - 1) { this.status = 'won'; return; }
    // The Rusty Crown (#22) pays its bonus on every win it made harder; Story
    // (#23) pads the purse so newer players can actually buy their way forward.
    this.gold += GOLD_PER_FIGHT
      + (this.hasRelic('rustyCrown') ? RUSTY_CROWN_GOLD : 0)
      + DIFFICULTIES[this.difficulty].goldBonus;
    // Spoils (#21, Q9): the act-1 and act-2 bosses drop a free relic pick.
    // (The final boss ends the run above, so this is exactly fights 3 and 6.)
    if (isActBoss(fi)) {
      this.location = { kind: 'spoils', fightIndex: fi };
      this.nodeContent = { type: 'spoils', offers: this.rollSpoils(fi) };
      return;
    }
    this.location = { kind: 'forkChoice', forkIndex: fi };
    this.nodeContent = null;
  }

  // Leave the spoils screen (with or without a pick) for the next fork.
  _leaveSpoils(): void {
    if (this.location.kind !== 'spoils') return;
    this.location = { kind: 'forkChoice', forkIndex: this.location.fightIndex };
    this.nodeContent = null;
  }

  // Take the spoils offer at `index` (free), then move on.
  pickSpoil(index: number): RelicId | null {
    if (this.location.kind !== 'spoils' || this.nodeContent?.type !== 'spoils') return null;
    const offer = this.nodeContent.offers[index];
    if (!offer) return null;
    this.addRelic(offer.relicId);
    this._leaveSpoils();
    return offer.relicId;
  }

  skipSpoils(): void { this._leaveSpoils(); }

  loseFight(): void {
    this.status = 'lost';
  }

  // Record the scars a won fight left (DR1). The driver passes the slots of
  // members that DIED during the fight (Game.diedThisFightSlots) — a member who
  // died and was later Resurrected still counts (death always scars), while a
  // Martyr's Icon save vetoes the death itself, so its slot never appears here.
  // Only wins reach this (a loss ends the run). The per-member cap depends on the
  // active injury mode (injuryRecordCap): MAX_INJURIES under 'cap', one past it
  // under 'incapacitate', uncapped under 'escalate'.
  recordInjuries(slots: Slot[]): void {
    for (const s of slots) {
      const p = this.party[s];
      if (p) p.injuries = Math.min(injuryRecordCap(), p.injuries + 1);
    }
  }

  // Mending Totem (DR1): the most-injured member sheds one scar (ties break to the
  // lowest slot). Inert without the relic, so the whole injury system stays a no-op
  // for runs that don't own it.
  _mendMostInjured(): void {
    if (!this.hasRelic('mendingTotem')) return;
    let best = -1;
    let most = 0;
    for (let s = 0; s < this.party.length; s++) {
      if (this.party[s].injuries > most) { most = this.party[s].injuries; best = s; }
    }
    if (best >= 0) this.party[best].injuries -= 1;
  }

  // Infirmary (DR1): pay the node's flat price to clear one scar off a member,
  // top of the ladder first (decrementing the count sheds the most-recent tier's
  // penalty). Fails without charging if the node isn't an Infirmary, the member
  // is unscarred, or the gold is short.
  clearInjuryForGold(slot: Slot): boolean {
    if (this.nodeContent?.type !== 'infirmary') return false;
    const p = this.party[slot];
    if (!p || p.injuries <= 0) return false;
    if (this.gold < this.nodeContent.price) return false;
    this.gold -= this.nodeContent.price;
    p.injuries -= 1;
    return true;
  }

  // End-of-run score (#24, flaw #21): progress is worth the most, relics a
  // little — and HOARDED gold is penalized, so spending it is always right.
  runScore(): { fights: number; relics: number; victory: number; goldPenalty: number; total: number } {
    const fights = this.fightsWon * 100;
    const relics = this.relics.length * 40;
    const victory = this.status === 'won' ? 500 : 0;
    const goldPenalty = -Math.floor(this.gold / 2);
    return { fights, relics, victory, goldPenalty, total: Math.max(0, fights + relics + victory + goldPenalty) };
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
    else this._enterFight(forkIndex + 1);
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
      case 'reliquary':
        this.nodeContent = { type: 'reliquary', offers: this.rollReliquary(), removalsLeft: RELIQUARY_REMOVALS_MAX };
        break;
      case 'infirmary':
        this.nodeContent = { type: 'infirmary', price: this.discountedPrice(INFIRMARY_PRICE) };
        break;
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
      cardId, rarity: CARD_RARITY[cardId], price: this.discountedPrice(RARITY_PRICE[CARD_RARITY[cardId]]),
    }));
  }

  rollCardUpgradeShop(): ModifierOffer[] {
    const mods = this._pickDistinct(
      MODIFIER_IDS.map((id): [ModifierId, number] => [id, RARITY_WEIGHT[MODIFIERS[id].rarity]]),
      SHOP_SIZE.cardUpgrade,
    );
    return mods.map((modifier): ModifierOffer => ({
      modifier, rarity: MODIFIERS[modifier].rarity, price: this.discountedPrice(RARITY_PRICE[MODIFIERS[modifier].rarity]),
    }));
  }

  rollPartyShop(): PartyUpgradeOffer[] {
    const defs = this._pickDistinct(
      PARTY_UPGRADES.map((d): [PartyUpgradeDef, number] => [d, RARITY_WEIGHT[d.rarity]]),
      SHOP_SIZE.partyUpgrade,
    );
    return defs.map((def): PartyUpgradeOffer => ({ def, price: this.discountedPrice(def.price ?? RARITY_PRICE[def.rarity]) }));
  }

  rollHealerShop(): HealerUpgradeOffer[] {
    const defs = this._pickDistinct(
      HEALER_UPGRADES.map((d): [HealerUpgradeDef, number] => [d, RARITY_WEIGHT[d.rarity]]),
      SHOP_SIZE.healerUpgrade,
    );
    return defs.map((def): HealerUpgradeOffer => ({ def, price: this.discountedPrice(def.price ?? RARITY_PRICE[def.rarity]) }));
  }

  rollEvent(): EventDef {
    return EVENTS[Math.floor(this.rng() * EVENTS.length)];
  }

  // ---- relics (#21) ----------------------------------------------------------

  hasRelic(id: RelicId): boolean { return this.relics.includes(id); }

  addRelic(id: RelicId): void {
    if (!this.hasRelic(id)) this.relics.push(id);
  }

  // Record once-per-RUN relic uses a fight reports (#22). Drivers call this
  // with Game.spentRelicIds() before resolving the fight's outcome.
  markRelicsSpent(ids: RelicId[]): void {
    for (const id of ids) if (!this.spentRelics.includes(id)) this.spentRelics.push(id);
  }

  // Haggler's Charm: every storefront price drops, floored. Applied at roll
  // time, so offers already on the table keep the price they were rolled at.
  discountedPrice(base: number): number {
    return this.hasRelic('hagglersCharm') ? Math.max(HAGGLER_FLOOR, base - HAGGLER_DISCOUNT) : base;
  }

  // Relics dead for the REMAINDER of the run, recomputed at each spoils roll
  // (Q9). Data-driven: the Lantern is dead once no remaining encounter can roll
  // a hidden attack (rotation enemies never do; weighted ones need the weight).
  relicExclusions(fightIndex: number): Set<RelicId> {
    const out = new Set<RelicId>();
    let hiddenPossible = false;
    for (let fi = fightIndex + 1; fi < FIGHT_COUNT; fi++) {
      for (const [id] of ENCOUNTER_TABLE[fi] ?? []) {
        const def = ENEMY_DEF_BY_ID[id];
        if (def && !def.rotation && (def.baseWeights.hidden > 0 || def.enragedWeights.hidden > 0)) {
          hiddenPossible = true;
        }
      }
    }
    if (!hiddenPossible) out.add('lantern');
    return out;
  }

  // Spoils roll (#21, Q9): distinct unowned relics, rarity-weighted. The
  // fight-3 roll guarantees at least one rare offer; the fight-6 roll weights
  // the act-3-boss counters x2 and recomputes the exclusion list.
  rollSpoils(fightIndex: number): RelicOffer[] {
    const excluded = this.relicExclusions(fightIndex);
    // Curses are NEVER in spoils (#22) — they are bought, eyes open.
    const pool = RELIC_IDS.filter((id) => !this.hasRelic(id) && !excluded.has(id) && !RELICS[id].curse);
    const boost = fightIndex >= 5 ? new Set(ACT3_COUNTER_RELICS) : null;
    const ids = this._pickDistinct(
      pool.map((id): [RelicId, number] => [id, RARITY_WEIGHT[RELICS[id].rarity] * (boost?.has(id) ? 2 : 1)]),
      SPOILS_OFFER_SIZE,
    );
    if (fightIndex === 2 && !ids.some((id) => RELICS[id].rarity === 'rare')) {
      const rares = pool.filter((id) => RELICS[id].rarity === 'rare' && !ids.includes(id));
      if (rares.length > 0) ids[ids.length - 1] = rares[Math.floor(this.rng() * rares.length)];
    }
    // Spoils are free — the boss already charged for them.
    return ids.map((relicId): RelicOffer => ({ relicId, rarity: RELICS[relicId].rarity, price: 0 }));
  }

  // Reliquary stock: distinct unowned relics at their rarity price (60/30/10),
  // plus one cursed offer at a flat bargain price (#22) — clearly marked, never
  // forced, and never rolled into the regular slots.
  rollReliquary(): RelicOffer[] {
    const pool = RELIC_IDS.filter((id) => !this.hasRelic(id) && !RELICS[id].curse);
    const ids = this._pickDistinct(
      pool.map((id): [RelicId, number] => [id, RARITY_WEIGHT[RELICS[id].rarity]]),
      RELIQUARY_STOCK,
    );
    const offers = ids.map((relicId): RelicOffer => ({
      relicId, rarity: RELICS[relicId].rarity,
      price: this.discountedPrice(RELIC_PRICE[RELICS[relicId].rarity]),
    }));
    const curses = RELIC_IDS.filter((id) => RELICS[id].curse && !this.hasRelic(id));
    if (curses.length > 0) {
      const cursed = curses[Math.floor(this.rng() * curses.length)];
      offers.push({ relicId: cursed, rarity: RELICS[cursed].rarity, price: this.discountedPrice(CURSE_PRICE) });
    }
    return offers;
  }

  // Forgotten Shrine (#22): accept a random unowned curse for gold. Null when
  // every curse is already borne.
  shrineAcceptCurse(): RelicId | null {
    const curses = RELIC_IDS.filter((id) => RELICS[id].curse && !this.hasRelic(id));
    if (curses.length === 0) return null;
    const curse = curses[Math.floor(this.rng() * curses.length)];
    this.addRelic(curse);
    this.gold += CURSE_SHRINE_GOLD;
    return curse;
  }

  // Buy the Reliquary relic offer at `index`.
  buyRelicOffer(index: number): boolean {
    if (this.nodeContent?.type !== 'reliquary') return false;
    const offer = this.nodeContent.offers[index];
    if (!offer || this.gold < offer.price) return false;
    this.gold -= offer.price;
    this.addRelic(offer.relicId);
    this.nodeContent.offers.splice(index, 1);
    return true;
  }

  // Reliquary card removal: the standard CARD_REMOVAL_PRICE (kept flat — the
  // removal economy stays unified per flaw #17), capped per visit.
  reliquaryRemoveCard(uid: number): boolean {
    if (this.nodeContent?.type !== 'reliquary' || this.nodeContent.removalsLeft <= 0) return false;
    if (!this.removeCardForGold(uid)) return false;
    this.nodeContent.removalsLeft -= 1;
    return true;
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

  // Paid card removal (Apothecary and anywhere else it's offered): unified at
  // CARD_REMOVAL_PRICE gold (flaw #17). Fails without charging if unaffordable.
  removeCardForGold(uid: number): boolean {
    if (this.gold < CARD_REMOVAL_PRICE) return false;
    if (!this.removeCard(uid)) return false;
    this.gold -= CARD_REMOVAL_PRICE;
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
    else h.passiveMp = Math.min(PASSIVE_MP_CAP, h.passiveMp + def.amount); // capped per run (flaw #10)
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
    // passiveMp is capped per run; a maxed-out offer is unbuyable (no wasted gold).
    if (offer.def.stat === 'passiveMp' && this.healer.passiveMp >= PASSIVE_MP_CAP) return false;
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

  // Casino Cart: decline the flip for a guaranteed payout (flaw #18).
  safeGold(): { delta: number; gold: number } {
    this.gold += CASINO_SAFE_GOLD;
    return { delta: CASINO_SAFE_GOLD, gold: this.gold };
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

  // Field Hospital (DR1): clear one death-scar (top of the ladder) off a chosen
  // member for free — a soft, random anti-spiral valve to complement the paid
  // Infirmary. Returns false (nothing tended) if the member is unharmed.
  healInjury(slot: Slot): boolean {
    const p = this.party[slot];
    if (!p || p.injuries <= 0) return false;
    p.injuries -= 1;
    return true;
  }

  // ---- events expansion (#19) -----------------------------------------------

  // Cursed Chest: the gold is guaranteed; the price is a card of the CHEST's
  // choosing (seeded-uniform over the deck). Returns what was taken.
  cursedChest(): { gold: number; removed: DeckCard | null } {
    this.gold += CURSED_CHEST_GOLD;
    let removed: DeckCard | null = null;
    if (this.deck.length > 0) {
      removed = this.deck[Math.floor(this.rng() * this.deck.length)];
      this.removeCard(removed.uid);
    }
    return { gold: CURSED_CHEST_GOLD, removed };
  }

  // Wandering Mercenary: pay the fee; a seeded-random member gets +1 damage.
  // Null (nothing charged) when unaffordable.
  hireMercenary(): { slot: Slot; amount: number } | null {
    if (this.gold < MERCENARY_PRICE) return null;
    this.gold -= MERCENARY_PRICE;
    const slot = Math.floor(this.rng() * this.party.length) as Slot;
    this.party[slot].damage += MERCENARY_DAMAGE;
    return { slot, amount: MERCENARY_DAMAGE };
  }

  // The Duplicator: add an UNUPGRADED copy of the chosen card (the letters, not
  // the gilding — full-upgrade copies would trivialize the modifier economy).
  duplicateCard(uid: number): DeckCard | null {
    if (this.gold < DUPLICATE_PRICE) return null;
    const card = this.deck.find((c) => c.uid === uid);
    if (!card) return null;
    this.gold -= DUPLICATE_PRICE;
    return this.addCard(card.id);
  }

  // Purge Well: free removal, but the WELL chooses (seeded-uniform). The 20g
  // chosen-removal economy (flaw #17) is undercut only by giving up the choice.
  purgeRandomCard(): DeckCard | null {
    if (this.deck.length === 0) return null;
    const card = this.deck[Math.floor(this.rng() * this.deck.length)];
    this.removeCard(card.uid);
    return card;
  }

  // Blood Altar: a permanent max-HP-for-damage trade on a chosen member. A
  // member at/below the floor may not sacrifice (the altar takes, never kills).
  canSacrifice(slot: Slot): boolean {
    return this.party[slot].maxHP > BLOOD_ALTAR_MIN_HP;
  }

  bloodAltarSacrifice(slot: Slot): { hpLoss: number; damageGain: number } | null {
    if (!this.canSacrifice(slot)) return null;
    this.party[slot].maxHP -= BLOOD_ALTAR_HP;
    this.party[slot].damage += BLOOD_ALTAR_DAMAGE;
    return { hpLoss: BLOOD_ALTAR_HP, damageGain: BLOOD_ALTAR_DAMAGE };
  }
}
