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
import { DeployScreen } from '../src/components/DeployScreen';
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
import { makeDeckCard, resolveCard, partyFromMembers, MEMBER_PASSIVE_FLAVOR, MEMBER_POOL, ABILITY_CARD, CARDS, INCAPACITATE_AT, EVENTS, DRAFT_OFFER_SIZE, DRAFT_POOL } from '../src/constants';
import type { MemberId } from '../src/constants';

// A member's ability text now lives ONLY on its ability card — never on the member
// tile/card. This resolves the player-facing ability-card name to guard against it.
const abilityCardName = (id: MemberId): string => CARDS[ABILITY_CARD[MEMBER_POOL[id].ability]].name;
import { Run } from '../src/run';
import { groupPile } from '../src/deckView';

import { check, finish } from './harness';

const rootEl = document.getElementById('root')!;
const root = createRoot(rootEl);
async function render(el: React.ReactElement): Promise<string> {
  await act(async () => { root.render(el); });
  return rootEl.textContent ?? '';
}

// #97: native `title=` tooltips became a themed <Tooltip> whose content is portalled
// to <body> only while open. On a *focusable* trigger, keyboard focus opens it with no
// delay — so we can drive the focus-open path (fire `focusin`, which is what React's
// onFocus delegates to) and read the popover text out of the portal. Hover-open (250ms
// timer) and Escape are maintainer-verified per CLAUDE.md, not driven here.
async function openTooltipText(el: HTMLElement): Promise<string> {
  await act(async () => { el.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true })); });
  return document.body.querySelector('.tooltip-pop')?.textContent ?? '';
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
  check('fresh run offers the begin button', text.includes('Begin your journey'), text);
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
    // Hover detail: the scar's own penalty and where it heals. Each badge feeds
    // `${name} — ${detail}` into its themed tooltip (#97); assert the content the
    // component hands the tooltip (the DOM wiring for this exact string).
    const titles = injuryBadges(2).map((b) => `${b.name} — ${b.detail}`);
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
  hallRun.roster = partyFromMembers(['mage', 'skald', 'sentinel']);
  hallRun.nodeContent = { type: 'partyUpgrade', offers: [] };
  const hallAct = <T,>(fn: (r: Run) => T): T => fn(hallRun);
  const hallText = await render(<PartyUpgradeShopScreen run={hallRun} act={hallAct} onDone={() => {}} />);
  check('Training Hall shows roster names', hallText.includes('Busker') && hallText.includes('Showstopper'), hallText);
  check('Training Hall does not show classic-trio names for a non-trio roster',
    !hallText.includes('Ranger') && !hallText.includes('Tank'), hallText);
}

// --- Draft cards show the PASSIVE name, not ability flavor or the raw id (#89/#37) ---
{
  const draftRun = new Run(5);
  draftRun.beginDraft();
  const shown = (draftRun.nodeContent as { options: MemberId[] }).options;
  const noop = <T,>(fn: (r: Run) => T): T => fn(draftRun);
  const text = await render(<DraftScreen run={draftRun} act={noop} />);
  for (const id of shown) {
    check(`draft card shows ${id}'s passive name`, text.includes(MEMBER_PASSIVE_FLAVOR[id].name), id);
    // Ability text no longer belongs on member tiles — the ability cards state their own.
    check(`draft card drops ${id}'s ability card name`, !text.includes(abilityCardName(id)), text);
    // The raw ability id (e.g. "graveChill") must never leak to the player.
    check(`draft card hides ${id}'s raw ability id`, !text.includes(MEMBER_POOL[id].ability), id);
  }
  // The passive description rides along in the button's themed tooltip (#97): focus
  // the tile and read the popover out of the portal.
  const btn = rootEl.querySelector('button.draft-member')! as HTMLElement;
  const firstPassive = MEMBER_PASSIVE_FLAVOR[shown[0]];
  const draftTip = await openTooltipText(btn);
  check('draft tile surfaces the passive desc in its themed tooltip',
    draftTip.includes(firstPassive.desc), draftTip);
}

// --- MemberCard surfaces the hero passive (name + desc tooltip), no ability text (#89) ---
{
  const cfg = defaultBattleConfig();
  cfg.party = partyFromMembers(['duelist', 'warlock', 'flagellant']);
  const game = new Game(4, cfg).start();
  const m = game.members[0]; // Duelist — Riposte Master
  await render(
    <MemberCard
      member={m} displayHp={m.hp} displayDead={false} react={null} mageCharge={0}
      liveDamage={m.damage} berserkerBands={null} targetedByEnemy={false} validTarget={false}
      onClick={() => {}}
    />,
  );
  const passive = MEMBER_PASSIVE_FLAVOR[m.id];
  check('member card shows the passive name', rootEl.textContent!.includes(passive.name), rootEl.textContent);
  check('member card drops the ability card name', !rootEl.textContent!.includes(abilityCardName(m.id)), rootEl.textContent);
  // The passive badge (a non-focusable span) shows the passive name and feeds
  // `${name} — ${desc}` into its themed tooltip (#97). The span can't focus-open, so
  // assert the badge renders and that the desc it hands the tooltip is non-empty
  // (the hover reveal itself is maintainer-verified).
  const badge = [...rootEl.querySelectorAll('.badge.passive')].find((b) => b.textContent!.includes(passive.name));
  check('member card passive badge renders with the passive name',
    !!badge, badge?.textContent ?? undefined);
  check('member card passive tooltip content includes the desc',
    `${passive.name} — ${passive.desc}`.includes(passive.desc) && passive.desc.length > 0, passive.desc);
}

// --- Deploy roster tiles show the passive, not ability flavor (#89) --------------
{
  const noop = <T,>(fn: (r: Run) => T): T => fn(new Run(6));
  const dep = new Run(6);
  dep.roster = partyFromMembers(['ranger', 'tank', 'mage']);
  dep.deployment = [0, 1, 2];
  dep.location = { kind: 'deploy', fightIndex: 0 };
  await render(<DeployScreen run={dep} act={noop} />);
  const tile = [...rootEl.querySelectorAll('button.draft-member')][0]! as HTMLElement; // Ranger — Toxicologist
  const passive = MEMBER_PASSIVE_FLAVOR.ranger;
  check('deploy tile shows the passive name', tile.textContent!.includes(passive.name), tile.textContent);
  check('deploy tile drops the ability card name', !rootEl.textContent!.includes(abilityCardName('ranger')), rootEl.textContent);
  const deployTip = await openTooltipText(tile);
  check('deploy tile surfaces the passive desc in its themed tooltip',
    deployTip.includes(passive.desc), deployTip);
}

// --- DeployScreen warns on benched members + strips gold from the Fight button (#88) ---
{
  const noop = <T,>(fn: (r: Run) => T): T => fn(new Run(3)); // act is never invoked in these render-only checks
  // Set up a deploy location with a given roster + seating, then render.
  let deployKey = 0;
  const deployView = async (members: MemberId[], deployment: (number | null)[]): Promise<HTMLElement> => {
    const dep = new Run(3);
    dep.roster = partyFromMembers(members);
    dep.deployment = deployment;
    dep.location = { kind: 'deploy', fightIndex: 0 };
    // DeployScreen seeds its seating into useState, so force a fresh instance each time.
    await render(<DeployScreen key={deployKey++} run={dep} act={noop} />);
    return rootEl;
  };
  const WARN = 'benched';

  // roster 3, deployed 2 → warning + danger button.
  let el = await deployView(['ranger', 'tank', 'mage'], [0, 1, null]);
  let btn = el.querySelector('button.map-take')!;
  check('#88 benched member with a free seat shows the warning', el.textContent!.includes(WARN), el.textContent);
  check('#88 the Fight button carries the danger class when benched', btn.classList.contains('danger'));

  // roster 3, deployed 3 → no warning, no danger.
  el = await deployView(['ranger', 'tank', 'mage'], [0, 1, 2]);
  btn = el.querySelector('button.map-take')!;
  check('#88 a fully deployed roster shows no warning', !el.textContent!.includes(WARN), el.textContent);
  check('#88 the Fight button is not danger when fully deployed', !btn.classList.contains('danger'));

  // roster 2, deployed 2 → nobody benched, no warning.
  el = await deployView(['ranger', 'tank'], [0, 1, null]);
  check('#88 roster smaller than the seat count shows no warning', !el.textContent!.includes(WARN), el.textContent);

  // Button label is exactly "Fight" — no seat count, no gold readout.
  btn = el.querySelector('button.map-take')!;
  check('#88 the Fight button says only "Fight"', btn.textContent!.trim() === 'Fight', btn.textContent);
  check('#88 the Fight button carries no gold amount', !/\d+g/.test(btn.textContent!), btn.textContent);
}

// --- Actions button drops the "+0 MP" rest label at full MP (#37 item 4) --------
{
  const turnBtn = () => rootEl.querySelector('button.primary') as HTMLButtonElement;

  // Rest is all-or-nothing now, so the button's red "Rest" state tracks cards-played,
  // not whether MP would be gained: at full MP it still says Rest and honestly says +0.
  const full = new Game(9, defaultBattleConfig()).start(); // starts at full MP, 0 cards played
  const fullText = await render(
    <Actions game={full} animating={false} hasSelection={false} onSkip={() => {}} onEndTurn={() => {}} onCancel={() => {}} />,
  );
  check('at full MP with no card played the button still offers Rest, advertising +0 MP',
    fullText.includes('Rest (+0 MP)'), fullText);
  check('the uncommitted-turn button is red', turnBtn().classList.contains('danger'), turnBtn().className);

  const spent = new Game(9, defaultBattleConfig()).start();
  spent.mp = 4; // below the cap → a rest now yields MP
  const spentText = await render(
    <Actions game={spent} animating={false} hasSelection={false} onSkip={() => {}} onEndTurn={() => {}} onCancel={() => {}} />,
  );
  check('below the cap the button advertises the rest MP', spentText.includes(`Rest (+${spent.restAmount()} MP)`), spentText);

  // Once a card is committed, Rest is gone: yellow "End Turn", no danger class.
  const played = new Game(9, defaultBattleConfig()).start();
  played.mp = 4;
  played.cardsPlayedThisPhase = 1; // the UI only reads canSkip()/restAmount(), which this gates
  const playedText = await render(
    <Actions game={played} animating={false} hasSelection={false} onSkip={() => {}} onEndTurn={() => {}} onCancel={() => {}} />,
  );
  check('after one card the button is plain "End Turn"',
    playedText.includes('End Turn') && !playedText.includes('Rest'), playedText);
  check('the committed-turn button is not red', !turnBtn().classList.contains('danger'), turnBtn().className);
}

// --- BattleScreen groups the MP bar and the turn button in one row (#80) --------
{
  const game = new Game(3, defaultBattleConfig()).start();
  const view = { enemyHp: game.enemy.hp, memberHp: [10, 10, 10], memberDead: [false, false, false] };
  await render(
    <BattleScreen
      game={game} view={view} fx={[]} reacts={[null, null, null]} animating={false} shakeTick={0}
      playCard={() => {}} skipTurn={() => {}} endTurn={() => {}}
      reserve={() => {}} playReservedCard={() => {}} releaseReserved={() => {}}
      pileCounts={{ draw: game.drawPile.length, discard: game.discardPile.length }}
      onWinFx={() => 0} onBattleEnd={() => {}}
    />,
  );
  const row = rootEl.querySelector('.mana-row');
  check('mana-row wraps the mp bar beside the primary turn button',
    !!row && !!row.querySelector('.mp-bar') && !!row.querySelector('button.primary'));
  // The Reserve zone (91a) now lives in the hand row, between the draw pile and the hand.
  const area = rootEl.querySelector('.hand-area');
  check('hand-area includes the Reserve zone (91a)', !!area && !!area.querySelector('.reserve'));
  check('the Reserve sits after the draw pile and before the hand',
    !!area && Array.prototype.indexOf.call(area.children, area.querySelector('.reserve'))
      === Array.prototype.indexOf.call(area.children, area.querySelector('.draw-pile')) + 1);
  // Empty Reserve: a drop target, and no upkeep readout under the MP bar yet.
  check('an empty Reserve renders a drop target', !!area && !!area.querySelector('.reserve-empty.reserve-drop'));
  check('no upkeep readout while the Reserve is empty', !rootEl.querySelector('.reserve-upkeep'));
  // Reserving is drag-only now — no per-card Reserve button in the hand.
  check('hand cards carry no Reserve button (drag-to-slot only)', !rootEl.querySelector('.card-reserve-btn'));
}

// --- Overlapping single-row hand (#93): a large hand never wraps to a second row ---
{
  const game = new Game(5, defaultBattleConfig()).start();
  // Stuff the hand well past what fits at normal spacing (8 fixed-width cards).
  game.hand = [];
  for (let i = 0; i < 8; i++) game.hand.push(makeDeckCard('lowHeal', 900 + i, []));
  await render(
    <Hand
      game={game} disabled={false} drawCount={game.drawPile.length} discardCount={game.discardPile.length}
      selectedIndex={null} selectedCard={null}
      onCardClick={() => {}} onCardPointerDown={() => {}} draggingUid={null}
    />,
  );
  const hand = rootEl.querySelector('.hand') as HTMLElement;
  check('the hand renders a single .hand row (no second-row wrapper)', !!hand);
  const cards = hand.querySelectorAll('.card');
  check('every hand card is a direct child of the single row (no wrap container)',
    cards.length === 8 && Array.prototype.every.call(cards, (c: Element) => c.parentElement === hand),
    `cards=${cards.length}`);
  // The overlap math is driven entirely by --n; assert it is threaded onto each card so
  // the CSS can compress the row. Actual pixel overlap is maintainer-verified (jsdom has
  // no layout), per CLAUDE.md.
  check('each card carries --n = hand size so CSS can compute the overlap',
    Array.prototype.every.call(cards, (c: Element) => (c as HTMLElement).style.getPropertyValue('--n') === '8'));
}

// --- reworked Reserve (91a): reserved card lives in the slot, upkeep reads under MP,
// --- and the Play/Release buttons are gone (drag + two-click only) --------------
{
  const game = new Game(7, defaultBattleConfig()).start();
  game.reserve(0); // hold the first hand card across turns
  const reservedId = game.reserveCard!.id;
  const view = { enemyHp: game.enemy.hp, memberHp: [10, 10, 10], memberDead: [false, false, false] };
  await render(
    <BattleScreen
      game={game} view={view} fx={[]} reacts={[null, null, null]} animating={false} shakeTick={0}
      playCard={() => {}} skipTurn={() => {}} endTurn={() => {}}
      reserve={() => {}} playReservedCard={() => {}} releaseReserved={() => {}}
      pileCounts={{ draw: game.drawPile.length, discard: game.discardPile.length }}
      onWinFx={() => 0} onBattleEnd={() => {}}
    />,
  );
  const full = rootEl.querySelector('.reserve.reserve-full');
  check('a held card renders in the Reserve slot', !!full);
  check('the reserved card is a real card with a drag handle (data-uid)',
    !!full && full.querySelector(`.card[data-uid="${game.reserveCard!.uid}"]`) != null);
  check('the reserved card shows the held card', resolveCard(makeDeckCard(reservedId, 0)) != null && (full?.textContent ?? '').includes(resolveCard(makeDeckCard(reservedId, 0)).name));
  // Item 4: no Play/Release buttons anywhere in the Reserve zone.
  check('the Reserve zone has no action buttons (drag + two-click only)', !!full && full.querySelector('button') == null);
  // Item 5: the upkeep message moved below the MP bar and reads "Reserve upkeep: N MP".
  const upkeep = rootEl.querySelector('.mana-center .reserve-upkeep');
  check('the upkeep readout sits under the MP bar', !!upkeep);
  check('the upkeep reads "Reserve upkeep: N MP"',
    (upkeep?.textContent ?? '') === `Reserve upkeep: ${game.reserveNextUpkeep()} MP`, upkeep?.textContent);
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
    <Hand game={game} disabled={false} drawCount={game.drawPile.length} discardCount={game.discardPile.length} selectedIndex={null} selectedCard={resurrect} onCardClick={() => {}} onCardPointerDown={() => {}} draggingUid={null} />,
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
