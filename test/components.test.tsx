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
import { InfirmaryScreen } from '../src/components/InfirmaryScreen';
import { Actions } from '../src/components/Actions';
import { Hand } from '../src/components/Hand';
import { Card } from '../src/components/Card';
import { MemberCard } from '../src/components/MemberCard';
import { MapScreen } from '../src/components/MapScreen';
import { makeDeckCard, resolveCard, partyFromMembers, MEMBER_ABILITY_FLAVOR, MEMBER_POOL, INCAPACITATE_AT } from '../src/constants';
import type { MemberId } from '../src/constants';
import { Run } from '../src/run';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}

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
    <StartScreen onBegin={noop} onDraft={noop} hasSave={true} savedFightIndex={4} onContinue={noop} difficulty="standard" onDifficulty={noop} />,
  );
  check('resume card shows the saved act', text.includes('Act 2 / 3'), text);
  check('resume card shows the saved fight', text.includes('Fight 5 / 9'), text);
  check('continue button present', text.includes('Continue your saved run'));

  text = await render(
    <StartScreen onBegin={noop} onDraft={noop} hasSave={false} savedFightIndex={null} onContinue={noop} difficulty="standard" onDifficulty={noop} />,
  );
  check('fresh run still describes the first fight', text.includes('Fight 1 / 9'), text);
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
  check('MemberCard shows the injury badge with the scar count', text.includes('Injured 2'), text);

  const whole = game.members[1]; // tank, unscarred
  const wholeText = await render(
    <MemberCard member={whole} displayHp={whole.hp} displayDead={false} react={null} mageCharge={0} liveDamage={whole.damage} berserkerBands={null}
      targetedByEnemy={false} validTarget={false} onClick={() => {}} />,
  );
  check('an unscarred member shows no injury badge', !wholeText.includes('Injured'), wholeText);
}

// --- DraftScreen surfaces the placement weights and the classic-trio path (#30) -
{
  const run = new Run(5);
  run.beginDraft();
  const noop = <T,>(fn: (r: Run) => T): T => fn(run);
  const text = await render(<DraftScreen run={run} act={noop} />);
  check('draft surfaces the open-attack slot weights', text.includes('25%') && text.includes('50%'), text);
  check('draft surfaces the veiled-attack slot weights', text.includes('40%') && text.includes('20%'), text);
  check('draft offers the classic-trio shortcut', text.includes('Accept the classic trio'), text);
  check('draft prompts for one pick per pair', text.includes('Pick 1'), text);
}

// --- Run-layer screens show DRAFTED names, not the classic trio (#36) ----------
{
  // A drafted party where every slot differs from the classic Ranger/Tank/Mage.
  const drafted = partyFromMembers(['mage', 'skald', 'graveAugur']);

  const hallRun = new Run(7);
  hallRun.party = drafted;
  hallRun.nodeContent = { type: 'partyUpgrade', offers: [] };
  const hallAct = <T,>(fn: (r: Run) => T): T => fn(hallRun);
  const hallText = await render(<PartyUpgradeShopScreen run={hallRun} act={hallAct} onDone={() => {}} />);
  check('Training Hall shows drafted names', hallText.includes('Skald') && hallText.includes('Grave Augur'), hallText);
  check('Training Hall does not show classic-trio names for a drafted party',
    !hallText.includes('Ranger') && !hallText.includes('Tank'), hallText);

  const infRun = new Run(8);
  infRun.party = partyFromMembers(['mage', 'skald', 'graveAugur']);
  infRun.party[1] = { ...infRun.party[1], injuries: 1 }; // scar the Skald
  infRun.nodeContent = { type: 'infirmary', price: 10 };
  const infAct = <T,>(fn: (r: Run) => T): T => fn(infRun);
  const infText = await render(<InfirmaryScreen run={infRun} act={infAct} onDone={() => {}} />);
  check('Infirmary shows drafted names', infText.includes('Skald') && infText.includes('Grave Augur'), infText);
  check('Infirmary does not mislabel the drafted party as the classic trio',
    !infText.includes('Ranger') && !infText.includes('Tank'), infText);
}

// --- Draft cards show ability FLAVOR, not the raw id (#37 item 1) ---------------
{
  const draftRun = new Run(5);
  draftRun.beginDraft();
  const shown = (draftRun.nodeContent as { pairs: MemberId[][] }).pairs.flat();
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
    <Hand game={game} disabled={false} selectedIndex={null} selectedCard={resurrect} onCardClick={() => {}} />,
  );
  check('Resurrect prompt explains the incapacitated cannot be reached', text.includes("can't reach the Incapacitated"), text);
  check('Resurrect prompt points at the Infirmary', text.includes('Infirmary'), text);
}

// --- Infirmary explains that healing restores an incapacitated member (#33) ------
{
  const infRun = new Run(13);
  infRun.party[0] = { ...infRun.party[0], injuries: INCAPACITATE_AT };
  infRun.nodeContent = { type: 'infirmary', price: 10 };
  const infAct = <T,>(fn: (r: Run) => T): T => fn(infRun);
  const text = await render(<InfirmaryScreen run={infRun} act={infAct} onDone={() => {}} />);
  check('Infirmary flags the incapacitated member', text.includes('☠ Incapacitated'), text);
  check('Infirmary says healing restores them', text.includes('restores them to the field'), text);
}

// --- MapScreen: choosing a path is gated behind the leaving transition ----------
{
  const mapRun = new Run(21);
  mapRun.location = { kind: 'forkChoice', forkIndex: 0 };
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
  check('choose does NOT fire synchronously (token travels first)', chosen === null);
  check('the canvas enters the leaving state',
    rootEl.querySelector('.map-canvas')?.className.includes('chosen-1') === true);
  check('further clicks are ignored while leaving',
    (takes[0] as HTMLButtonElement).disabled && (takes[1] as HTMLButtonElement).disabled);
  await new Promise((r) => setTimeout(r, 900));
  await act(async () => {});
  check('choose fires after the travel delay with the picked branch', chosen === 1, String(chosen));
}

await act(async () => { root.unmount(); });
console.log(`\ncomponents: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
