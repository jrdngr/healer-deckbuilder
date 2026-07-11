// Mechanic-coverage test. Run with: tsx test/coverage.test.ts
//
// The permanent guard for the sim playtest's finding 4: the fixed winrate
// policy is narrow (it plays ~6 of 23 cards and skips whole relic/card lines),
// so this asserts the exerciser harness (sim/exercise.ts) actually drives EVERY
// card, ability, relic, and curse through a live fight loop with no crashes. If
// someone adds content and forgets to wire it into a playable path, or a card /
// relic starts throwing under real play, this fails.

import { exerciseAll } from '../sim/exercise';
import { CARDS, RELIC_IDS, RELICS, isAbilityCard } from '../src/constants';
import type { CardId, AbilityId } from '../src/constants';

import { check, results } from './harness';

const cov = exerciseAll();

// No mechanic may crash under live play.
check('no crashes across the mechanic sweep', cov.crashes.length === 0,
  cov.crashes.map((c) => `${c.where}: ${c.error}`).join(' | '));

// Every core card is played through the engine at least once. Per-member ability
// cards (#44) are inserted per-fight and covered via their bound abilities below
// (the trio's Poison/Taunt/Bolt), so they are not required in the core-card sweep.
const allCards = (Object.keys(CARDS) as CardId[]).filter((c) => !isAbilityCard(c));
const missingCards = allCards.filter((c) => !cov.cardsPlayed.has(c));
check('every card is exercised in a live fight', missingCards.length === 0,
  `never played: ${missingCards.join(', ')}`);

// All three abilities fire (Poison / Taunt / Bolt via their bound ability cards).
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

// Injury avenues all drive end-to-end (record a scar / permanent death at the 4th,
// heal one free at a Field Hospital). The Infirmary and Mending Totem were retired
// with the 2026-07 injury rework — injuries are permanent.
const dr1 = ['recordInjuries', 'fieldHospital'];
const missingDr1 = dr1.filter((a) => !cov.dr1Fired.has(a));
check('every DR1 injury avenue is exercised', missingDr1.length === 0, `never fired: ${missingDr1.join(', ')}`);

// Determinism: the sweep is a pure function of the engine/run layer, so two
// runs agree exactly (a coverage regression can't hide behind flakiness).
const cov2 = exerciseAll();
check('the sweep is deterministic',
  cov2.cardsPlayed.size === cov.cardsPlayed.size
  && cov2.relicsFired.size === cov.relicsFired.size
  && cov2.crashes.length === cov.crashes.length);

if (results.failed > 0) { console.error(`\ncoverage.test: ${results.passed} passed, ${results.failed} failed`); process.exit(1); }
else console.log(`coverage.test: ${results.passed} passed (${cov.cardsPlayed.size} cards · ${cov.relicsFired.size} relics · ${cov.cursesFired.size} curses)`);
