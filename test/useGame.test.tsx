// React-binding test harness. Run with: tsx test/useGame.test.tsx
//
// Regression guard for the "Maximum update depth exceeded" crash: FightScreen
// publishes the fight controller up to App via an effect keyed on the controller
// object. useGame must therefore return a *referentially stable* controller, or
// every render produces a fresh object, the effect re-fires, App re-renders, and
// the cycle loops until React throws. We mount the real useGame in that exact
// publish pattern and assert it both stays stable and settles without looping.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { pretendToBeVisual: true });
(globalThis as { window?: unknown }).window = dom.window;
(globalThis as { document?: unknown }).document = dom.window.document;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React, { useEffect, useState } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame, type GameController } from '../src/useGame';
import { defaultBattleConfig } from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}

// Capture "Maximum update depth exceeded" — React reports it through console.error
// rather than throwing synchronously, so spy on it for the duration of the test.
let maxDepthError = false;
const origError = console.error;
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('Maximum update depth')) { maxDepthError = true; return; }
  // The opening-attack animation fires setState from timers after the act() block;
  // those "not wrapped in act" warnings are expected here and just add noise.
  if (msg.includes('not wrapped in act')) return;
  origError(...args);
};

// Mirror App <-> FightScreen: a child runs useGame and publishes its controller up
// to a parent state setter through an effect keyed on the controller (the wiring
// that crashed). The parent storing the controller forces it to re-render, which is
// what turned an unstable controller into an unbounded loop.
const seen: GameController[] = [];

function Fight({ onController }: { onController: (c: GameController) => void }) {
  const ctrl = useGame(123, defaultBattleConfig());
  seen.push(ctrl);
  useEffect(() => {
    onController(ctrl);
  }, [ctrl, onController]);
  return React.createElement('div', null, 'fight');
}

function App() {
  const [, setCtrl] = useState<GameController | null>(null);
  return React.createElement(Fight, { onController: setCtrl });
}

const root = createRoot(document.getElementById('root')!);
await act(async () => { root.render(React.createElement(App)); });
// Let the opening-attack timers and any pending effect passes flush.
await new Promise((r) => setTimeout(r, 250));
await act(async () => {});

check('mounting the publish pattern does not exceed the update depth', !maxDepthError);
check('useGame rendered at least twice (parent re-rendered)', seen.length >= 2,
  `rendered ${seen.length} time(s)`);
check('controller reference is stable across renders',
  seen.every((c) => c === seen[0]));

// --- the played card's ghost: spawned with an origin, gone after its life ----
{
  const ctrl = seen[seen.length - 1];
  // Wait out the opening staged sequence so playCard isn't dropped by the
  // animating guard.
  for (let i = 0; i < 40 && ctrl.animating; i++) {
    await new Promise((r) => setTimeout(r, 100));
    await act(async () => {});
  }
  // Find an affordable card the engine will accept on a member target (or a
  // no-target play); the ghost should ride any successful play.
  const g = ctrl.game;
  let played = false;
  for (let idx = 0; idx < g.hand.length && !played; idx++) {
    for (const target of [0, 1, 2, null] as const) {
      if (g.canPlay(idx, target) === null) {
        await act(async () => {
          ctrl.playCard(idx, target, { x: 10, y: 20, w: 132, h: 150 });
        });
        played = true;
        break;
      }
    }
  }
  check('a playable card was found for the ghost test', played);
  const ghosts = ctrl.fx.filter((f) => f.spec.type === 'cardGhost');
  check('playing with an origin spawns a card ghost', ghosts.length === 1,
    `got ${ghosts.length}`);
  if (ghosts.length === 1 && ghosts[0].spec.type === 'cardGhost') {
    check('the ghost launches from the measured origin', ghosts[0].spec.from.x === 10);
  }
  // After its lifetime the ghost is cleaned up.
  await new Promise((r) => setTimeout(r, 600));
  await act(async () => {});
  check('the ghost is removed after its lifetime',
    ctrl.fx.every((f) => f.spec.type !== 'cardGhost'));
}

await act(async () => { root.unmount(); });
console.error = origError;

console.log(`\nuseGame: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
