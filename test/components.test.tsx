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
import { Card } from '../src/components/Card';
import { makeDeckCard, resolveCard } from '../src/constants';

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
    <StartScreen onBegin={noop} hasSave={true} savedFightIndex={4} onContinue={noop} />,
  );
  check('resume card shows the saved act', text.includes('Act 2 / 3'), text);
  check('resume card shows the saved fight', text.includes('Fight 5 / 9'), text);
  check('continue button present', text.includes('Continue your saved run'));

  text = await render(
    <StartScreen onBegin={noop} hasSave={false} savedFightIndex={null} onContinue={noop} />,
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

await act(async () => { root.unmount(); });
console.log(`\ncomponents: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
