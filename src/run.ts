// The run / campaign layer: a pure, DOM-free model of a whole run — gold, the
// persistent deck, party & healer progression, the branching map, and node
// progression. It produces a BattleConfig for each fight (see engine.ts) and
// holds all the shop/event resolution logic so it can be unit-tested directly.
//
// Like the engine, every random choice goes through a seeded Rng so a run is
// reproducible from its seed.

import {
  ENEMY_HP_BY_FIGHT, ENEMY_ATTACK_BONUS, ENEMY_ENRAGE_TURN_BY_FIGHT, isActBoss, actOfFight,
  ENEMY_MAX_HP, ENRAGE_TURN, defaultDeck, defaultParty, DEFAULT_HEALER, makeDeckCard, abilityCardsForParty,
  canApplyModifier, MODIFIERS, MODIFIER_IDS, RARITY_PRICE, RARITY_WEIGHT,
  CARD_RARITY, CARD_POOL, PARTY_UPGRADES, HEALER_UPGRADES, EVENTS,
  NODE_TYPE_WEIGHTS, FIGHT_COUNT, FORK_COUNT, BRANCHES_PER_FORK, NODES_PER_BRANCH,
  GOLD_PER_FIGHT, EMPTY_SEAT_GOLD_BONUS, SHOP_SIZE, EVENT_CARD_OFFER_SIZE, MAX_UPGRADE_SLOTS,
  PASSIVE_MP_CAP, CARD_REMOVAL_PRICE, CASINO_SAFE_GOLD,
  CURSED_CHEST_GOLD, MERCENARY_PRICE, MERCENARY_DAMAGE, DUPLICATE_PRICE,
  BLOOD_ALTAR_HP, BLOOD_ALTAR_DAMAGE, BLOOD_ALTAR_MIN_HP,
  DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF, ACT_BOSS_DEFS, ENCOUNTER_TABLE, ENEMY_DEF_BY_ID,
  RELICS, RELIC_IDS, RELIC_PRICE, ACT3_COUNTER_RELICS,
  SPOILS_OFFER_SIZE, RELIQUARY_STOCK, RELIQUARY_REMOVALS_MAX,
  HAGGLER_DISCOUNT, HAGGLER_FLOOR, CURSE_PRICE, CURSE_SHRINE_GOLD, RUSTY_CROWN_GOLD,
  MAX_INJURIES, injuryMaxHPPenalty, injuryDamagePenalty, injuryAbilityPenalty,
  injuryRecordCap, injuryIncapacitates, injuryKills,
  partyFromMembers, DRAFT_POOL, CLASSIC_TRIO,
  DRAFT_OFFER_SIZE, RECRUIT_OFFER_SIZE, memberSalary,
} from './constants';
import type {
  Slot, CardId, ModifierId, DeckCard, PartyMemberConfig, HealerConfig, BattleConfig, MemberId,
  NodeType, PartyUpgradeDef, HealerUpgradeDef, EventDef, EnemyDef, RelicId,
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
  // Pick-one member draft (2026-07): at run start ('start') and after each boss
  // ('boss'). fightIndex is the fight the draft leads back toward (0 for start; the
  // boss fight for a post-boss draft, whose fork is fightIndex).
  | { kind: 'draft'; post: 'start' | 'boss'; fightIndex: number }
  | { kind: 'deploy'; fightIndex: number } // pre-fight: choose & seat members (C4)
  | { kind: 'fight'; fightIndex: number }
  | { kind: 'spoils'; fightIndex: number } // relic pick after an act-1/2 boss (#21)
  | { kind: 'forkChoice'; forkIndex: number }
  | { kind: 'branch'; forkIndex: number; branch: number } // the hub on a chosen branch: pick a stop, or move on
  | { kind: 'node'; forkIndex: number; branch: number; index: number; nodeType: NodeType };

// The rolled content of the current non-fight node. Rolled once on FIRST entry
// and cached for the whole branch stay (branchContent), so leaving and coming
// back never rerolls a storefront or restocks what was bought.
export type NodeContent =
  | { type: 'cardShop'; offers: CardOffer[] }
  | { type: 'cardUpgrade'; offers: ModifierOffer[] }
  | { type: 'partyUpgrade'; offers: PartyUpgradeOffer[] }
  | { type: 'healerUpgrade'; offers: HealerUpgradeOffer[] }
  | { type: 'event'; event: EventDef; done: boolean } // done: resolved once — revisits find it spent
  | { type: 'spoils'; offers: RelicOffer[] }                          // free pick of 1 (#21)
  | { type: 'reliquary'; offers: RelicOffer[]; removalsLeft: number } // relic shop (#21)
  | { type: 'draft'; options: MemberId[] }                            // pick-one member draft (2026-07)
  | { type: 'recruit'; options: MemberId[]; done: boolean };          // Recruit node: add one member, once

// Boundary-only save format. Bumped if the shape changes so stale saves are
// discarded rather than misread. (v2: relics + spoils/reliquary content, #21;
// v3: difficulty, #23; v4: fightsWon, #24; v5: per-member injuries + infirmary
// node content, DR1; v6: drafted member identity + draft location/content, #27;
// v7: branch hub location + per-branch cached node content;
// v8: collectible roster + per-fight deployment, replacing the fixed 3-member party;
// v9: single mode — difficulty removed (the roster campaign is the only way to play);
// v10: graveyard of permanently-dead members (#40), excluded from future offers.)
export const RUN_SAVE_VERSION = 10;

export interface RunSnapshot {
  version: number;
  seed: number;
  rngState: number;
  nextUid: number;
  gold: number;
  deck: DeckCard[];
  roster: PartyMemberConfig[];
  deployment: (number | null)[];
  graveyard: MemberId[];
  healer: HealerConfig;
  relics: RelicId[];
  spentRelics: RelicId[];
  fightsWon: number;
  map: Fork[];
  status: RunStatus;
  location: RunLocation;
  nodeContent: NodeContent | null;
  branchContent: (NodeContent | null)[];
  currentEnemyDef: EnemyDef | null;
}

export class Run {
  seed: number;
  rng: Rng;
  gold: number;
  deck: DeckCard[];
  // The collected members (the roster). Unique by `member` id; grows as the player
  // drafts/recruits, shrinks on permanent death. The BATTLE party the engine fights
  // with is a separate length-3 view built from `deployment` in toBattleConfig.
  roster: PartyMemberConfig[];
  // Which roster member is seated in each battle slot for the upcoming fight (index
  // into `roster`, or null for an empty slot). Chosen on the deploy screen; defaults
  // to the first three roster members until a deploy step sets it.
  deployment: (number | null)[]; // length 3
  // Permanently-dead member ids (4th-death removal, #40). Excluded from every
  // draft/recruit offer so a killed hero never returns as a fresh scar-free copy.
  graveyard: MemberId[];
  healer: HealerConfig;
  relics: RelicId[];      // run-long passives (#21), in acquisition order
  spentRelics: RelicId[]; // once-per-RUN relics already consumed (#22)
  fightsWon: number;      // fights won this run (drives the end-of-run score, #24)
  map: Fork[];
  status: RunStatus;
  location: RunLocation;
  nodeContent: NodeContent | null;
  // Per-node content of the current branch stay, by node index. null = not yet
  // visited; filled (and thereafter shared with nodeContent) on first entry, so
  // revisits see the same stock/state instead of a fresh roll.
  branchContent: (NodeContent | null)[];
  currentEnemyDef: EnemyDef | null; // enemy rolled for the current fight (stable for the visit)
  private nextUid: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed >>> 0;
    this.rng = makeRng(this.seed);
    this.gold = 0;
    this.deck = defaultDeck();
    // Default roster: the classic trio (with member identities), so quick-play and
    // the sim have a party without drafting. The pick-one draft (beginDraft) clears
    // this and rebuilds the roster one member at a time.
    this.roster = partyFromMembers(CLASSIC_TRIO);
    this.deployment = [0, 1, 2];
    this.graveyard = [];
    this.healer = { ...DEFAULT_HEALER };
    this.relics = [];
    this.spentRelics = [];
    this.fightsWon = 0;
    this.nextUid = this.deck.length; // new cards continue the uid sequence
    this.map = this._generateMap();
    this.status = 'playing';
    this.location = { kind: 'start' };
    this.nodeContent = null;
    this.branchContent = [];
    this.currentEnemyDef = null;
  }

  // `party` is a read/write alias for the roster — the run-layer screens that show
  // or target "the party" (Training Hall, events, the map's injured list) operate on
  // the whole roster, so this keeps their call sites legible. The BATTLE party (the
  // length-3 view the engine fights) is a separate thing, built from `deployment` in
  // toBattleConfig — never confuse `run.party` (roster) with `BattleConfig.party`.
  get party(): PartyMemberConfig[] { return this.roster; }
  set party(v: PartyMemberConfig[]) { this.roster = v; }

  // ---- save / resume (boundary-only, issue 11) -----------------------------
  // The run layer is pure and seed-deterministic, so a snapshot is just its
  // fields plus the RNG position. Serialize only between fights/nodes (never
  // mid-fight — that is a standing cut). All fields are plain data (EnemyDef,
  // offers, map) so the snapshot round-trips through JSON.

  toJSON(): RunSnapshot {
    return {
      version: RUN_SAVE_VERSION,
      seed: this.seed,
      rngState: this.rng.getState(),
      nextUid: this.nextUid,
      gold: this.gold,
      deck: this.deck,
      roster: this.roster,
      deployment: this.deployment,
      graveyard: this.graveyard,
      healer: this.healer,
      relics: this.relics,
      spentRelics: this.spentRelics,
      fightsWon: this.fightsWon,
      map: this.map,
      status: this.status,
      location: this.location,
      nodeContent: this.nodeContent,
      branchContent: this.branchContent,
      currentEnemyDef: this.currentEnemyDef,
    };
  }

  // Rebuild a Run from a snapshot, restoring the exact RNG position so the resumed
  // run continues the identical deterministic stream.
  static fromJSON(snap: RunSnapshot): Run {
    const run = new Run(snap.seed);
    run.rng.setState(snap.rngState); // continue the saved stream, not a fresh one
    run.nextUid = snap.nextUid;
    run.gold = snap.gold;
    run.deck = snap.deck.map((c) => ({ ...c, upgrades: [...c.upgrades] }));
    run.roster = snap.roster.map((p) => ({ ...p, injuries: p.injuries ?? 0, upgrades: p.upgrades ?? 0 }));
    run.deployment = [...(snap.deployment ?? [0, 1, 2])];
    run.graveyard = [...(snap.graveyard ?? [])];
    run.healer = { ...snap.healer };
    run.relics = [...snap.relics];
    run.spentRelics = [...(snap.spentRelics ?? [])];
    run.fightsWon = snap.fightsWon ?? 0;
    run.map = snap.map;
    run.status = snap.status;
    run.location = snap.location;
    run.branchContent = snap.branchContent ?? [];
    // Inside a node, nodeContent must be the SAME object as its branchContent
    // slot (JSON split them), so mutations (buying an offer) stay visible on
    // revisit after a resume.
    run.nodeContent = snap.location.kind === 'node'
      ? run.branchContent[snap.location.index] ?? snap.nodeContent
      : snap.nodeContent;
    run.currentEnemyDef = snap.currentEnemyDef;
    return run;
  }

  // Safe rehydrate for the persistence boundary (#46). A stored snapshot can be
  // from an older RUN_SAVE_VERSION, or truncated/corrupt (a partial write, or a
  // shape change made without bumping the version). fromJSON throws on those, so
  // resume paths must never call it unguarded. This returns null instead of
  // throwing for anything that is not a resumable current-version snapshot, so a
  // caller can hide the Continue button / drop the dead save rather than crash.
  static tryFromJSON(snap: unknown): Run | null {
    try {
      const s = snap as RunSnapshot | null;
      if (!s || s.version !== RUN_SAVE_VERSION) return null;
      return Run.fromJSON(s);
    } catch {
      return null;
    }
  }

  // Member ids not yet in the roster (the pool a draft/recruit can still offer).
  availableMembers(): MemberId[] {
    const have = new Set(this.roster.map((p) => p.member));
    const buried = new Set(this.graveyard);
    return DRAFT_POOL.filter((id) => !have.has(id) && !buried.has(id));
  }

  // Roll a pick-one offer of up to `size` distinct members from `pool` (already the
  // available/eligible set). Uses the run's seeded rng; copies before the in-place
  // shuffle so the shared pool arrays are never corrupted.
  _rollMemberOffer(pool: MemberId[], size: number): MemberId[] {
    return shuffle([...pool], this.rng).slice(0, size);
  }

  // Pick-one draft at run start (2026-07; #55): clear the default roster and offer
  // three heroes sampled from the FULL member pool (any hero can start — no longer a
  // fixed striker trio). The player picks one, then deploys into the solo fight 0.
  beginDraft(): void {
    if (this.location.kind !== 'start') return;
    this.roster = [];
    this.deployment = [null, null, null];
    this.location = { kind: 'draft', post: 'start', fightIndex: 0 };
    this.nodeContent = { type: 'draft', options: this._rollMemberOffer(DRAFT_POOL, DRAFT_OFFER_SIZE) };
  }

  // Take the drafted member into the roster and move on: the start draft leads into
  // deploying fight 0; a post-boss draft returns to the boss's fork. Ignores an
  // unknown / already-owned id so a crude UI can't wedge the run.
  chooseDraftMember(id: MemberId): void {
    if (this.location.kind !== 'draft' || this.nodeContent?.type !== 'draft') return;
    if (!this.nodeContent.options.includes(id) || this.roster.some((p) => p.member === id)) return;
    const { post, fightIndex } = this.location;
    this.roster.push(partyFromMembers([id])[0]);
    this.nodeContent = null;
    if (post === 'start') this._enterDeploy(0);
    else { this.location = { kind: 'forkChoice', forkIndex: fightIndex }; }
  }

  // Full member roster (unique by id). Members carry per-instance stats, injuries,
  // and (later) a salary; the battle party is a deploy-time view of it.
  rosterMemberIds(): MemberId[] { return this.roster.map((p) => p.member!).filter(Boolean); }

  // Default seating: the first three roster members into slots L/C/R, the rest of the
  // (short) roster leaving empty slots. Used until the deploy screen (C4) sets it.
  _defaultDeployment(): (number | null)[] {
    return [0, 1, 2].map((i) => (i < this.roster.length ? i : null));
  }

  // A deployment is fieldable for the current roster: length 3, at least one member
  // seated, every seated index in range, and no member seated twice. Shared by
  // confirmDeployment (reject malformed input) and _enterDeploy (decide whether the
  // remembered seating still holds after a roster change).
  _deploymentIsValid(deployment: (number | null)[]): boolean {
    if (deployment.length !== 3) return false;
    const seated = deployment.filter((ri): ri is number => ri != null);
    if (seated.length === 0) return false;
    if (seated.some((ri) => ri < 0 || ri >= this.roster.length)) return false;
    return new Set(seated).size === seated.length;
  }

  // Open the pre-fight deploy step: the player chooses which roster members fight
  // and where. Remembers the player's last seating (#50) so positioning persists
  // between fights; only falls back to the default (first three roster members)
  // when there is no valid prior seating (first fight, or a splice invalidated it).
  _enterDeploy(fightIndex: number): void {
    // Permanent death can empty the roster between boss drafts — with no one left to
    // field, the run is lost.
    if (this.roster.length === 0) { this.status = 'lost'; return; }
    if (!this._deploymentIsValid(this.deployment)) this.deployment = this._defaultDeployment();
    this.location = { kind: 'deploy', fightIndex };
    this.nodeContent = null;
  }

  // Confirm the chosen deployment (which roster member sits in each battle slot) and
  // start the fight. A malformed deployment is ignored so the screen can't wedge the run.
  confirmDeployment(deployment: (number | null)[]): void {
    if (this.location.kind !== 'deploy') return;
    if (!this._deploymentIsValid(deployment)) return;
    this.deployment = [...deployment];
    this._enterFight(this.location.fightIndex);
  }

  // Enter a fight: set the location and the enemy that occupies it.
  _enterFight(fightIndex: number): void {
    this.location = { kind: 'fight', fightIndex };
    this.nodeContent = null;
    this.branchContent = []; // the previous branch's storefronts are behind us
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
    // Guaranteed act-1 Recruit (#41): forks 0/1 are the two forks before the
    // Gatewarden (F2). Whether a Recruit appeared there was structural RNG that
    // swung the boss ~25pp (solo 72% -> duo 97%); guarantee one so the "whether"
    // coin flip is gone and only the "which fork" choice remains (the fork
    // preview lets the player route to it). Skip if a natural roll already placed
    // one in forks 0/1, so we never duplicate a node type within a fork.
    const act1HasRecruit = [0, 1].some((fi) =>
      forks[fi].branches.some((br) => br.nodes.some((n) => n.type === 'recruit')));
    if (!act1HasRecruit) {
      const fork = forks[Math.floor(this.rng() * 2)]; // fork 0 or 1
      const branch = fork.branches[Math.floor(this.rng() * fork.branches.length)];
      const idx = Math.floor(this.rng() * branch.nodes.length);
      branch.nodes[idx] = { type: 'recruit' };
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
      case 'deploy': return location.fightIndex;
      case 'fight': return location.fightIndex;
      // A start draft leads into fight 0; a post-boss draft (like spoils) into the next fight.
      case 'draft': return location.post === 'start' ? 0 : Math.min(location.fightIndex + 1, FIGHT_COUNT - 1);
      case 'spoils': return Math.min(location.fightIndex + 1, FIGHT_COUNT - 1);
      case 'forkChoice': return Math.min(location.forkIndex + 1, FIGHT_COUNT - 1);
      case 'branch': return Math.min(location.forkIndex + 1, FIGHT_COUNT - 1);
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

  // Build the config for the fight at the current location, straight from the tuned
  // per-act curve (there is a single mode — no difficulty modifiers).
  toBattleConfig(): BattleConfig {
    // The engine fights with a length-3 party, one entry per battle slot. Each
    // slot maps through `deployment` to a roster member; an unseated slot (null)
    // becomes an empty slot the engine builds as absent (dead/untargetable).
    // Injuries (DR1) bite here for seated members: the fight gets reduced base
    // stats, so every downstream engine site (HP construction, healing clamp,
    // Vanguard full-HP check, ability strength) sees the scarred numbers with
    // no further plumbing. maxHP floored at 1 and damage at 0; abilityPower may
    // go negative (a Broken member), floored where each ability resolves.
    // NOTE: any new PartyMemberConfig field must be threaded here explicitly —
    // this literal silently drops fields otherwise (the drafted-identity bug).
    const party = this.deployment.map((ri): PartyMemberConfig => {
      const p = ri == null ? undefined : this.roster[ri];
      if (!p) return { maxHP: 0, damage: 0, abilityPower: 0, injuries: 0, empty: true };
      return {
        maxHP: Math.max(1, p.maxHP - injuryMaxHPPenalty(p.injuries)),
        damage: Math.max(0, p.damage - injuryDamagePenalty(p.injuries)),
        abilityPower: p.abilityPower - injuryAbilityPenalty(p.injuries),
        injuries: p.injuries,
        member: p.member, // drafted identity (#27) — dropping this reverts to trio abilities
        // 'incapacitate' injury mode: enters the fight dead and unresurrectable.
        incapacitated: injuryIncapacitates(p.injuries),
      };
    });
    return {
      // #44: each deployed member inserts their bound ability card into the battle
      // deck for this fight only. abilityCardsForParty gives them negative uids and
      // never touches the persistent run deck, so they vanish when the fight ends —
      // and a smaller deployment fields fewer ability cards (a real small-party cost).
      deck: [...this.deck.map((c) => ({ ...c, upgrades: [...c.upgrades] })), ...abilityCardsForParty(party)],
      party,
      healer: { ...this.healer },
      relics: [...this.relics],
      spentRelics: [...this.spentRelics],
      enemy: {
        maxHP: this.enemyMaxHP(),
        boss: this.isBossFight,
        attackBonus: ENEMY_ATTACK_BONUS[this.fightIndex] ?? 0,
        def: this.currentEnemyDef ?? (this.isBossFight ? BOSS_ENEMY_DEF : DEFAULT_ENEMY_DEF),
        enrageTurn: ENEMY_ENRAGE_TURN_BY_FIGHT[this.fightIndex] ?? ENRAGE_TURN,
      },
    };
  }

  // Resolve the current fight as a win: award gold and advance to the fork (or
  // win the run if that was the boss).
  // Total salary owed for the members deployed in the current fight (2026-07): the
  // sum of memberSalary over every seated deployment slot. Empty slots cost nothing.
  deployedSalary(): number {
    let total = 0;
    for (const ri of this.deployment) {
      if (ri == null) continue;
      const p = this.roster[ri];
      if (p) total += memberSalary(p);
    }
    return total;
  }

  // Unfilled deploy slots for the upcoming/current fight (#42): fielding fewer than
  // three leaves empty seats, which scale the win bounty up.
  emptySeats(): number {
    return this.deployment.filter((ri) => ri == null).length;
  }

  winFight(): void {
    if (this.location.kind !== 'fight') return;
    const fi = this.location.fightIndex;
    this.fightsWon += 1;
    if (fi >= FIGHT_COUNT - 1) { this.status = 'won'; return; }
    // "Field fewer, keep more" (#42): the base bounty scales UP with empty deploy
    // seats, so an undermanned win pays a premium. The Rusty Crown (#22) bonus is
    // added after (a flat reward for a harder fight, not scaled by seats).
    const bounty = Math.round(GOLD_PER_FIGHT * (1 + EMPTY_SEAT_GOLD_BONUS * this.emptySeats()));
    const reward = bounty + (this.hasRelic('rustyCrown') ? RUSTY_CROWN_GOLD : 0);
    // Pay each DEPLOYED member their salary out of the winnings (2026-07); benched
    // members are free, so fielding fewer keeps more gold. Gold never goes negative.
    this.gold = Math.max(0, this.gold + reward - this.deployedSalary());
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

  // Leave the spoils screen (with or without a pick). Every act boss that drops
  // spoils (F2, F5) is followed by a pick-one member draft (2026-07) before the
  // next fork — unless the roster already holds everyone, in which case skip it.
  _leaveSpoils(): void {
    if (this.location.kind !== 'spoils') return;
    const fi = this.location.fightIndex;
    const pool = this.availableMembers();
    if (pool.length > 0) {
      this.location = { kind: 'draft', post: 'boss', fightIndex: fi };
      this.nodeContent = { type: 'draft', options: this._rollMemberOffer(pool, DRAFT_OFFER_SIZE) };
      return;
    }
    this.location = { kind: 'forkChoice', forkIndex: fi };
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
  // `slots` are BATTLE slots (0/1/2); map each through the deployment to the roster
  // member that fought there, and scar it. An empty slot (no member deployed) has no
  // roster index and is skipped.
  recordInjuries(slots: Slot[]): void {
    const killed = new Set<number>();
    for (const s of slots) {
      const ri = this.deployment[s];
      if (ri == null) continue;
      const p = this.roster[ri];
      if (!p) continue;
      p.injuries = Math.min(injuryRecordCap(), p.injuries + 1);
      if (injuryKills(p.injuries)) killed.add(ri);
    }
    // Permanent death (2026-07 'death' mode): remove killed members from the roster,
    // highest index first so a splice never shifts one still to remove.
    if (killed.size > 0) {
      for (const ri of [...killed].sort((a, b) => b - a)) {
        const [removed] = this.roster.splice(ri, 1);
        // Bury the member so availableMembers() never re-offers them (#40): the
        // 4th death is permanent, not a reset to a fresh copy.
        if (removed?.member) this.graveyard.push(removed.member);
      }
      // Reconcile the remembered seating (#50) so survivors keep their relative
      // positions: a killed member's slot empties, and every surviving index shifts
      // down by the count of removed indices below it (the roster splice above).
      const removedAsc = [...killed].sort((a, b) => a - b);
      this.deployment = this.deployment.map((ri) => {
        if (ri == null || killed.has(ri)) return null;
        return ri - removedAsc.filter((k) => k < ri).length;
      });
    }
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

  // Commit to a branch at the current fork and land on its hub, from which the
  // player visits the branch's stops in any order, as often as they like, before
  // heading to the next fight (startNextFight).
  chooseBranch(branch: number): void {
    if (this.location.kind !== 'forkChoice') return;
    const forkIndex = this.location.forkIndex;
    this.location = { kind: 'branch', forkIndex, branch };
    this.nodeContent = null;
    this.branchContent = this.map[forkIndex].branches[branch].nodes.map(() => null);
  }

  // Whether a node of this type can be visited right now. The Recruit node is hidden
  // once the roster holds everyone (nothing left to offer); all others are always open.
  nodeAvailable(type: NodeType): boolean {
    if (type === 'recruit') return this.availableMembers().length > 0;
    return true;
  }

  // Recruit node (2026-07): add the chosen member to the roster, once. Ignores an
  // unknown / already-owned id or a spent node so a crude UI can't double-recruit.
  recruitMember(id: MemberId): void {
    if (this.location.kind !== 'node' || this.nodeContent?.type !== 'recruit') return;
    if (this.nodeContent.done) return;
    if (!this.nodeContent.options.includes(id) || this.roster.some((p) => p.member === id)) return;
    this.roster.push(partyFromMembers([id])[0]);
    this.nodeContent.done = true;
  }

  // Enter one of the current branch's stops from the hub. First entry rolls the
  // node's content; revisits reuse the cached content (same stock, same state).
  enterNode(index: number): void {
    if (this.location.kind !== 'branch') return;
    const { forkIndex, branch } = this.location;
    const node = this.map[forkIndex].branches[branch].nodes[index];
    if (!node || !this.nodeAvailable(node.type)) return;
    this.location = { kind: 'node', forkIndex, branch, index, nodeType: node.type };
    this.branchContent[index] ??= this._rollNodeContent(node.type);
    this.nodeContent = this.branchContent[index];
  }

  // Leave the current node, back to the branch hub (the content stays cached
  // there, so coming back finds the node as it was left).
  completeNode(): void {
    if (this.location.kind !== 'node') return;
    const { forkIndex, branch } = this.location;
    this.location = { kind: 'branch', forkIndex, branch };
    this.nodeContent = null;
  }

  // Done with the branch: head to the deploy step for the fight the fork walks toward.
  startNextFight(): void {
    if (this.location.kind !== 'branch') return;
    this._enterDeploy(this.location.forkIndex + 1);
  }

  // Roll the storefront / event for a node's first visit.
  _rollNodeContent(nodeType: NodeType): NodeContent | null {
    switch (nodeType) {
      case 'cardShop': return { type: 'cardShop', offers: this.rollCardShop() };
      case 'cardUpgrade': return { type: 'cardUpgrade', offers: this.rollCardUpgradeShop() };
      case 'partyUpgrade': return { type: 'partyUpgrade', offers: this.rollPartyShop() };
      case 'healerUpgrade': return { type: 'healerUpgrade', offers: this.rollHealerShop() };
      case 'event': return { type: 'event', event: this.rollEvent(), done: false };
      case 'recruit': return { type: 'recruit', options: this._rollMemberOffer(this.availableMembers(), RECRUIT_OFFER_SIZE), done: false };
      case 'reliquary': return { type: 'reliquary', offers: this.rollReliquary(), removalsLeft: RELIQUARY_REMOVALS_MAX };
      default: return null;
    }
  }

  // An event resolves once: mark it spent so revisits (now that nodes can be
  // re-entered freely) can't farm its choices.
  markEventDone(): void {
    if (this.nodeContent?.type === 'event') this.nodeContent.done = true;
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
    if (!p) return; // out-of-range roster index (a small roster can't be upgraded there)
    if (def.stat === 'maxHP') p.maxHP += def.amount;
    else if (def.stat === 'damage') p.damage += def.amount;
    else p.abilityPower += def.amount;
    p.upgrades = (p.upgrades ?? 0) + 1; // a stat upgrade raises this member's salary
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
    this.party[slot].upgrades = (this.party[slot].upgrades ?? 0) + 1; // raises salary
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
    const p = this.party[slot];
    return !!p && p.maxHP > BLOOD_ALTAR_MIN_HP;
  }

  bloodAltarSacrifice(slot: Slot): { hpLoss: number; damageGain: number } | null {
    if (!this.canSacrifice(slot)) return null;
    this.party[slot].maxHP -= BLOOD_ALTAR_HP;
    this.party[slot].damage += BLOOD_ALTAR_DAMAGE;
    this.party[slot].upgrades = (this.party[slot].upgrades ?? 0) + 1; // the damage gain raises salary
    return { hpLoss: BLOOD_ALTAR_HP, damageGain: BLOOD_ALTAR_DAMAGE };
  }
}
