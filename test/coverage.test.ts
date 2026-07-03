// Mechanic-coverage test. Run with: tsx test/coverage.test.ts
//
// The permanent guard for the sim playtest's finding 4: the fixed winrate
// policy is narrow (it plays ~6 of 23 cards and skips whole relic/card lines),
// so this asserts the exerciser harness (sim/exercise.ts) actually drives EVERY
// card, ability, relic, and curse through a live fight loop with no crashes. If
// someone adds content and forgets to wire it into a playable path, or a card /
// relic starts throwing under real play, this fails.

import { exerciseAll } from '../sim/exercise';
import { CARDS, RELIC_IDS, RELICS } from '../src/constants';
import type { CardId, AbilityId } from '../src/constants';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra: string = ''): void {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}${extra ? ' — ' + extra : ''}`); }
}

const cov = exerciseAll();

// No mechanic may crash under live play.
check('no crashes across the mechanic sweep', cov.crashes.length === 0,
  cov.crashes.map((c) => `${c.where}: ${c.error}`).join(' | '));

// Every card is played through the engine at least once.
const allCards = Object.keys(CARDS) as CardId[];
const missingCards = allCards.filter((c) => !cov.cardsPlayed.has(c));
check('every card is exercised in a live fight', missingCards.length === 0,
  `never played: ${missingCards.join(', ')}`);

// All three abilities fire (Poison / Taunt / Bolt behind the Ability card).
const abilities: AbilityId[] = ['poison', 'taunt', 'bolt'];
const missingAbil = abilities.filter((a) => !cov.abilitiesFired.has(a));
check('every ability is fired', missingAbil.length === 0, `never fired: ${missingAbil.join(', ')}`);

// Every relic's effect fires in a live fight (or its run-level scenario).
const missingRelics = RELIC_IDS.filter((r) => !cov.relicsFired.has(r));
check('every relic effect fires', missingRelics.length === 0, `never fired: ${missingRelics.join(', ')}`);

// Every curse is exercised.
const curses = RELIC_IDS.filter((r) => RELICS[r].curse);
const missingCurses = curses.filter((r) => !cov.cursesFired.has(r));
check('every curse is exercised', missingCurses.length === 0, `never fired: ${missingCurses.join(', ')}`);

// Determinism: the sweep is a pure function of the engine/run layer, so two
// runs agree exactly (a coverage regression can't hide behind flakiness).
const cov2 = exerciseAll();
check('the sweep is deterministic',
  cov2.cardsPlayed.size === cov.cardsPlayed.size
  && cov2.relicsFired.size === cov.relicsFired.size
  && cov2.crashes.length === cov.crashes.length);

if (failed > 0) { console.error(`\ncoverage.test: ${passed} passed, ${failed} failed`); process.exit(1); }
else console.log(`coverage.test: ${passed} passed (${cov.cardsPlayed.size} cards · ${cov.relicsFired.size} relics · ${cov.cursesFired.size} curses)`);
