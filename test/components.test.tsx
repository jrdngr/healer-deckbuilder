// Component regression tests (jsdom + real react-dom), sibling to useGame.test.tsx.
// Run with: tsx test/components.test.tsx
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { pretendToBeVisual: true });
(globalThis as { window?: unknown }).window = dom.window;
(globalThis as { document?: unknown }).document = dom.window.document;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../src/engine';
import { defaultBattleConfig } from '../src/constants';
import { ManaBar } from '../src/components/ManaBar';
import { StartScreen } from '../src/components/StartScreen';
import { DraftScreen } from '../src/components/DraftScreen';
import { PartyUpgradeShopScreen } from '../src/components/PartyUpgradeShopScreen';
import { Actions } from '../src/components/Actions';
import { BattleScreen } from '../src/components/BattleScreen';
import { Hand } from '../src/components/Hand';
import { Card } from '../src/components/Card';
import { MemberCard, injuryBadges } from '../src/components/MemberCard';
import { Topbar } from '../src/components/Topbar';
import { MapScreen } from '../src/components/MapScreen';
import { BranchScreen } from '../src/components/BranchScreen';
import { EventScreen } from '../src/components/EventScreen';
import { makeDeckCard, resolveCard, partyFromMembers, MEMBER_ABILITY_FLAVOR, MEMBER_POOL, INCAPACITATE_AT, EVENTS, DRAFT_OFFER_SIZE, DRAFT_POOL } from '../src/constants';
import type { MemberId } from '../src/constants';
import { Run } from '../src/run';
import { groupPile } from '../src/deckView';

import { check, finish } from './harness';

const rootEl = document.getElementById('root')!;
const root = createRoot(rootEl);
async function render(el: React.ReactElement): Promise<string> {
  await act(async () => { root.render(el); });
  return rootEl.textContent ?? '';
}

// --- ManaBar reflects the healer's upgraded mana cap, not the base constant ---
{
  const cfg = defaultBattleConfig();
  cfg.healer = { ...cfg.healer, maxMana: 12 }; // +2 Max Mana bought during the run
  const game = new Game(1, cfg).start();
  const text = await render(<ManaBar game={game} animating={false} />);
  check('ManaBar shows the upgraded cap', text.includes(`MP ${game.mp} / 12`), text);
  check('ManaBar never shows current above max', game.mp <= 12);
}

// --- StartScreen resume card shows the save's actual position -----------------
{
  const noop = () => {};
  let text = await render(
    <StartScreen onBegin={noop} hasSave={true} savedFightIndex={4} onContinue={noop} />,
  );
  check('resume card shows the saved act', text.includes('Act 2 / 3'), text);
  check('resume card shows the saved fight', text.includes('Fight 5 / 9'), text);
  check('continue button present', text.includes('Continue your saved run'));

  text = await render(
    <StartScreen onBegin={noop} hasSave={false} savedFightIndex={null} onContinue={noop} />,
  );
  check('fresh run invites the first-hero draft', text.includes('Draft your first hero'), text);
  check('no continue button without a save', !text.includes('Continue your saved run'));
}

// --- Card: button semantics + the ineligible state -----------------------------
{
  const resolved = resolveCard(makeDeckCard('highHeal', 1, []));
  let clicks = 0;
  await render(
    <Card card={resolved} affordable={true} ineligible={false} selected={false} onClick={() => { clicks++; }} />,
  );
  const el = rootEl.querySelector('.card') as HTMLElement;
  check('card exposes a button role', el.getAttribute('role') === 'button');
  check('enabled card is focusable', el.tabIndex === 0);
  el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  check('Enter activates an enabled card', clicks === 1, `clicks=${clicks}`);

  clicks = 0;
  await render(
    <Card card={resolved} affordable={true} ineligible={true} selected={false} onClick={() => { clicks++; }} />,
  );
  const inel = rootEl.querySelector('.card') as HTMLElement;
  check('ineligible card gets its own class (not unaffordable)',
    inel.className.includes('ineligible') && !inel.className.includes('unaffordable'));
  check('ineligible card reads disabled', inel.getAttribute('aria-disabled') === 'true');
  check('ineligible card leaves the tab order', inel.tabIndex === -1);
  inel.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  check('Enter does nothing on an ineligible card', clicks === 0, `clicks=${clicks}`);
}

// --- injuryBadges: one named descriptor per scar, with its own penalty (#49) ----
{
  check('no scars → no badges', injuryBadges(0).length === 0);
  const two = injuryBadges(2);
  check('two scars → two badges', two.length === 2, String(two.length));
  check('1st scar is Cracked (Max HP)', two[0].name === 'Cracked' && two[0].detail.includes('Max HP'), JSON.stringify(two[0]));
  check('2nd scar is Weakened (damage)', two[1].name === 'Weakened' && two[1].detail.includes('damage'), JSON.stringify(two[1]));
  const three = injuryBadges(3);
  check('3rd scar is Broken (ability)', three[2].name === 'Broken' && three[2].detail.includes('ability'), JSON.stringify(three[2]));
  check('every scar detail names the Infirmary', injuryBadges(4).every((b) => b.detail.includes('Infirmary')));
  check('4th scar is Shattered', injuryBadges(4)[3].name === 'Shattered', JSON.stringify(injuryBadges(4)[3]));
}

// --- MemberCard surfaces a member's scars (DR1) --------------------------------
{
  const cfg = defaultBattleConfig();
  cfg.party[0] = { ...cfg.party[0], injuries: 2 }; // ranger carries two scars
  const game = new Game(2, cfg).start();
  const injured = game.members[0];
  const text = await render(
    <MemberCard member={injured} displayHp={injured.hp} displayDead={false} react={null} mageCharge={0} liveDamage={injured.damage} berserkerBands={null}
      targetedByEnemy={false} validTarget={false} onClick={() => {}} />,
  );
  // #49: each scar is its own named badge (Cracked, Weakened, …), not a single count pill.
  check('MemberCard shows a badge per scar, named by tier', text.includes('Cracked') && text.includes('Weakened'), text);
  check('MemberCard no longer shows the old "Injured N" count pill', !text.includes('Injured'), text);
  {
    const injBadges = rootEl.querySelectorAll('.badge.injury');
    check('MemberCard renders one injury badge per scar', injBadges.length === 2, String(injBadges.length));
    // Hover detail: the scar's own penalty and where it heals.
    const titles = Array.from(injBadges).map((b) => b.getAttribute('title') ?? '');
    check('Cracked badge details its Max HP penalty', titles.some((t) => t.includes('Cracked') && t.includes('Max HP')), titles.join(' | '));
    check('Weakened badge details its damage penalty', titles.some((t) => t.includes('Weakened') && t.includes('damage')), titles.join(' | '));
    check('injury badge tooltip points at the Infirmary', titles.every((t) => t.includes('Infirmary')), titles.join(' | '));
  }

  const whole = game.members[1]; // tank, unscarred
  const wholeText = await render(
    <MemberCard member={whole} displayHp={whole.hp} displayDead={false} react={null} mageCharge={0} liveDamage={whole.damage} berserkerBands={null}
      targetedByEnemy={false} validTarget={false} onClick={() => {}} />,
  );
  check('an unscarred member shows no injury badge',
    !wholeText.includes('Cracked') && rootEl.querySelectorAll('.badge.injury').length === 0, wholeText);
}

// --- DraftScreen (pick-one) surfaces the offered heroes ------------------------
{
  const run = new Run(5);
  run.beginDraft();
  const noop = <T,>(fn: (r: Run) => T): T => fn(run);
  const text = await render(<DraftScreen run={run} act={noop} />);
  const options = (run.nodeContent as { options: MemberId[] }).options;
  check('the start draft offers the configured number of heroes', options.length === DRAFT_OFFER_SIZE, String(options.length));
  check('draft prompts to choose the starting hero', text.includes('Choose your starting hero'), text);
  // #81: the instructional header prose was stripped — only the heading remains.
  check('start draft drops the explanatory header prose', !text.includes('full roster'), text);
  for (const id of options) check(`draft shows ${id}'s name`, text.includes(MEMBER_POOL[id].name), id);
  // #43: the generator's damage rating must not leak to the player as a recommendation.
  check('offer button hides the DRAFT_RATING "rated N" string', !text.includes('rated '), text);
}

// --- Run-layer screens show ROSTER names, not the classic trio (#36) ------------
{
  // A roster where every member differs from the classic Ranger/Tank/Mage.
  const hallRun = new Run(7);
  hallRun.roster = partyFromMembers(['mage', 'skald', 'graveAugur']);
  hallRun.nodeContent = { type: 'partyUpgrade', offers: [] };
  const hallAct = <T,>(fn: (r: Run) => T): T => fn(hallRun);
  const hallText = await render(<PartyUpgradeShopScreen run={hallRun} act={hallAct} onDone={() => {}} />);
  check('Training Hall shows roster names', hallText.includes('Skald') && hallText.includes('Grave Augur'), hallText);
  check('Training Hall does not show classic-trio names for a non-trio roster',
    !hallText.includes('Ranger') && !hallText.includes('Tank'), hallText);
}

// --- Draft cards show ability FLAVOR, not the raw id (#37 item 1) ---------------
{
  const draftRun = new Run(5);
  draftRun.beginDraft();
  const shown = (draftRun.nodeContent as { options: MemberId[] }).options;
  const noop = <T,>(fn: (r: Run) => T): T => fn(draftRun);
  const text = await render(<DraftScreen run={draftRun} act={noop} />);
  for (const id of shown) {
    check(`draft card shows ${id}'s ability flavor`, text.includes(MEMBER_ABILITY_FLAVOR[id]), id);
    // The raw ability id (e.g. "graveChill") must never leak to the player.
    check(`draft card hides ${id}'s raw ability id`, !text.includes(MEMBER_POOL[id].ability), id);
  }
}

// --- Actions button drops the "+0 MP" rest label at full MP (#37 item 4) --------
{
  const full = new Game(9, defaultBattleConfig()).start(); // starts at full MP, 0 cards played
  const fullText = await render(
    <Actions game={full} animating={false} hasSelection={false} onSkip={() => {}} onEndTurn={() => {}} onCancel={() => {}} />,
  );
  check('at full MP the rest button is plain "End Turn"',
    fullText.includes('End Turn') && !fullText.includes('+0 MP') && !fullText.includes('Rest & End Turn'), fullText);

  const spent = new Game(9, defaultBattleConfig()).start();
  spent.mp = 4; // below the cap → a rest now yields MP
  const spentText = await render(
    <Actions game={spent} animating={false} hasSelection={false} onSkip={() => {}} onEndTurn={() => {}} onCancel={() => {}} />,
  );
  check('below the cap the button advertises the rest MP', spentText.includes(`Rest & End Turn (+${spent.restAmount()} MP)`), spentText);
}

// --- BattleScreen groups the MP bar and the turn button in one row (#80) --------
{
  const game = new Game(3, defaultBattleConfig()).start();
  const view = { enemyHp: game.enemy.hp, memberHp: [10, 10, 10], memberDead: [false, false, false] };
  await render(
    <BattleScreen
      game={game} view={view} fx={[]} reacts={[null, null, null]} animating={false} shakeTick={0}
      playCard={() => {}} skipTurn={() => {}} endTurn={() => {}} onWinFx={() => 0} onBattleEnd={() => {}}
    />,
  );
  const row = rootEl.querySelector('.mana-row');
  check('mana-row wraps the mp bar beside the primary turn button',
    !!row && !!row.querySelector('.mp-bar') && !!row.querySelector('button.primary'));
}

// --- Incapacitated member shows a distinct overlay, not plain DEAD (#33) --------
{
  const cfg = defaultBattleConfig();
  cfg.party[0] = { ...cfg.party[0], injuries: INCAPACITATE_AT, incapacitated: true };
  const game = new Game(11, cfg).start();
  const incap = game.members[0];
  check('an incapacitated member seats dead', !incap.alive && incap.incapacitated);
  const text = await render(
    <MemberCard member={incap} displayHp={0} displayDead={true} react={null} mageCharge={0} liveDamage={incap.damage} berserkerBands={null}
      targetedByEnemy={false} validTarget={false} onClick={() => {}} />,
  );
  check('incapacitated overlay names the state', text.includes('Incapacitated'), text);
  check('incapacitated overlay says how to restore', text.includes('heal a scar to restore'), text);
  const el = rootEl.querySelector('.member') as HTMLElement;
  check('member card carries the incapacitated class', el.className.includes('incapacitated'), el.className);

  // A plain mid-fight death (not incapacitated) keeps the ordinary DEAD overlay.
  const whole = game.members[1];
  await render(
    <MemberCard member={whole} displayHp={0} displayDead={true} react={null} mageCharge={0} liveDamage={whole.damage} berserkerBands={null}
      targetedByEnemy={false} validTarget={false} onClick={() => {}} />,
  );
  const deadEl = rootEl.querySelector('.member') as HTMLElement;
  check('an ordinary dead member is not marked incapacitated', !deadEl.className.includes('incapacitated'), deadEl.className);
}

// --- Hand surfaces the Resurrect-on-incapacitated refusal (#33) -----------------
{
  const cfg = defaultBattleConfig();
  cfg.party[0] = { ...cfg.party[0], injuries: INCAPACITATE_AT, incapacitated: true };
  const game = new Game(12, cfg).start(); // slot 0 seats dead+incapacitated, 1/2 alive
  const resurrect = resolveCard(makeDeckCard('resurrect', -1));
  const text = await render(
    <Hand game={game} disabled={false} selectedIndex={null} selectedCard={resurrect} onCardClick={() => {}} onCardPointerDown={() => {}} draggingUid={null} />,
  );
  check('Resurrect prompt explains the incapacitated cannot be reached', text.includes("can't reach the Incapacitated"), text);
  check('Resurrect prompt points at the Infirmary', text.includes('Infirmary'), text);
}


// --- MapScreen: choosing a path advances immediately (no travel animation) ------
{
  const mapRun = new Run(21);
  mapRun.location = { kind: 'forkChoice', forkIndex: 0 };
  // Pin the fork so the node count doesn't depend on the seed's roll (an
  // Infirmary node hides from an unscarred party — asserted separately below).
  mapRun.map[0].branches[0].nodes = [{ type: 'cardShop' }, { type: 'event' }];
  mapRun.map[0].branches[1].nodes = [{ type: 'partyUpgrade' }, { type: 'cardUpgrade' }];
  let chosen: number | null = null;
  await render(<MapScreen run={mapRun} onChoose={(b) => { chosen = b; }} />);
  check('map draws both trails', rootEl.querySelectorAll('.map-path').length === 2);
  check('map places both branches’ nodes', rootEl.querySelectorAll('.map-node').length >= 5,
    String(rootEl.querySelectorAll('.map-node').length)); // 2×2 branch nodes + next-fight
  check('map shows the party token', rootEl.querySelector('.map-token') !== null);
  const takes = rootEl.querySelectorAll('.map-take');
  check('two take-path buttons', takes.length === 2);
  await act(async () => {
    (takes[1] as HTMLElement).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  check('choose fires synchronously with the picked branch (no travel animation)',
    chosen === 1, String(chosen));
  check('no leaving state is applied to the canvas',
    rootEl.querySelector('.map-canvas')?.className.includes('leaving') === false);
  check('no travel state is applied to the token',
    rootEl.querySelector('.map-token')?.className.includes('travel') === false);
}

// --- MapScreen hides a Recruit node once the roster is full ---------------------
{
  const recMap = new Run(24);
  recMap.location = { kind: 'forkChoice', forkIndex: 0 };
  recMap.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  recMap.map[0].branches[1].nodes = [{ type: 'cardShop' }, { type: 'partyUpgrade' }];
  let text = await render(<MapScreen run={recMap} onChoose={() => {}} />);
  check('a roster with room sees the Recruiter on the map', text.includes('Recruiter'), text);
  recMap.roster = partyFromMembers(DRAFT_POOL);
  text = await render(<MapScreen run={recMap} onChoose={() => {}} />);
  check('a full roster sees no Recruiter on the map', !text.includes('Recruiter'), text);
}

// --- BranchScreen: the hub lists open stops and leads to the fight --------------
{
  // Reach a fork from a fresh run so a branch can be hand-set, then chosen.
  const toFork = (seed: number): Run => {
    const r = new Run(seed);
    r._enterDeploy(0); // default trio -> deploy step
    r.confirmDeployment(r.deployment); // pass the pre-fight deploy step
    r.winFight();
    r.skipCardReward(); // #57: clear the post-win card reward to reach the fork
    return r;
  };

  // A stop that isn't enterable right now (a Recruiter with a full roster) must be
  // SWAPPED for an available one on entry — never left as a blank/missing stop.
  const hubRun = toFork(22);
  hubRun.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  hubRun.roster = partyFromMembers(DRAFT_POOL); // full roster: the recruit stop can't open
  hubRun.chooseBranch(0);
  let entered: number | null = null;
  let fought = false;
  let text = await render(
    <BranchScreen run={hubRun} onEnter={(i) => { entered = i; }} onFight={() => { fought = true; }} />,
  );
  check('the un-openable recruit stop is swapped away', !text.includes('Recruiter'), text);
  check('the branch shows a full complement of stops (no blank)', rootEl.querySelectorAll('.branch-stop').length === 2, text);
  check('the event stop survives the swap', text.includes('Event'), text);
  check('hub offers the way to the fight', text.includes('Onward to the fight'), text);

  const eventStop = rootEl.querySelectorAll('.branch-stop')[1] as HTMLElement;
  await act(async () => { eventStop.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('clicking the event stop enters node 1', entered === 1, String(entered));

  // A roster with room keeps the recruit stop as-is (it's enterable, so no swap).
  const roomRun = toFork(22);
  roomRun.map[0].branches[0].nodes = [{ type: 'recruit' }, { type: 'event' }];
  roomRun.roster = partyFromMembers(['ranger', 'tank']); // room: the recruit stop stays
  roomRun.chooseBranch(0);
  text = await render(
    <BranchScreen run={roomRun} onEnter={() => {}} onFight={() => { fought = true; }} />,
  );
  check('a roster with room keeps the recruit stop', text.includes('Recruiter'), text);

  const go = rootEl.querySelector('.branch-fight') as HTMLElement;
  await act(async () => { go.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('the fight button fires onFight', fought);
}

// --- EventScreen: a spent event offers only the way out --------------------------
{
  const evRun = new Run(23);
  evRun.nodeContent = { type: 'event', event: EVENTS[0], done: true };
  const evAct = <T,>(fn: (r: Run) => T): T => fn(evRun);
  const text = await render(<EventScreen run={evRun} act={evAct} onDone={() => {}} />);
  check('a spent event says the moment has passed', text.includes('The moment has passed'), text);
  check('a spent event hides its choices', !text.includes(EVENTS[0].choices[0].label), text);
  check('a spent event still offers the way out', text.includes('Leave'), text);
}

// --- Topbar: the View Deck button opens a read-only grouped deck view (#48) -----
{
  const deckRun = new Run(48); // fresh run: the default starter deck
  const noop = () => {};
  const text = await render(
    <Topbar seedField="48" onSeedChange={noop} onNewRun={noop} gold={deckRun.gold}
      progress="Test" relics={deckRun.relics} deck={deckRun.deck} />,
  );
  check('topbar shows a View Deck control with the deck size', text.includes(`View Deck (${deckRun.deck.length})`), text);
  check('the deck view is closed until clicked', rootEl.querySelector('.deck-view') === null);

  const btn = rootEl.querySelector('.view-deck') as HTMLElement;
  await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  const view = rootEl.querySelector('.deck-view');
  check('clicking View Deck opens the read-only deck dialog', view !== null);
  check('the deck view carries the dialog role', view?.getAttribute('role') === 'dialog');
  // Every card, grouped by name with counts — matches groupPile over the same deck.
  const groups = groupPile(deckRun.deck);
  const viewText = view?.textContent ?? '';
  for (const g of groups) check(`deck view lists ${g.label} ×${g.count}`, viewText.includes(`${g.count}× ${g.label}`), viewText);
  // Purely informational: no pickable Cards leak into the view.
  check('the deck view renders no interactive cards (read-only)', view?.querySelector('.card') === null);

  // Click-away on the overlay backdrop dismisses it.
  const overlay = rootEl.querySelector('.overlay') as HTMLElement;
  await act(async () => { overlay.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
  check('clicking the backdrop closes the deck view', rootEl.querySelector('.deck-view') === null);
}

await act(async () => { root.unmount(); });
finish('components');
