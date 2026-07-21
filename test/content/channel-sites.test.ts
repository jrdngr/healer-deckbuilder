// The channel-with-no-arm trap — the same shape as hook-sites.test.ts, one feature over.
//
// `Game._tickChannel` switches on the card id and its `default` arm does nothing. So a
// card in cards.json with a `channel` block but no arm is not an inert card: it STARTS a
// channel, occupies the single channel slot, ticks down, and emits its channelPulse
// events, all while having no effect. From the outside it looks like a working card that
// happens to be weak — which is the worst way for content to be broken.
//
// CHANNEL_TICK_CARDS declares which cards have an arm, and the cards.json check enforces
// it against the JSON in both directions. What that check CANNOT see is whether the
// declaration still matches the actual switch: if someone deletes a `case` and leaves the
// name in the list, content validation stays green and the card silently does nothing
// again. So the switch itself is read here, from the source text.
//
// Scanning the source rather than trusting the constant is the same call hook-sites makes
// and for the same reason — a hand-written list is exactly the thing that drifts.
import { readFileSync } from 'node:fs';
import { CHANNEL_TICK_CARDS } from '../../src/content/natives';
import { eq, finish } from '../harness';

const SOURCE = 'src/engine/core.ts';
const source = readFileSync(SOURCE, 'utf8');

// Slice out the body of _tickChannel: from its declaration to the start of the next
// method at the same indent. Narrowing to the method matters — `case 'sap'` appears in
// other switches too, and matching those would make this test pass for the wrong reason.
// Anchored at the method DEFINITION (line start, class-body indent) — a bare
// indexOf('_tickChannel(') finds an earlier `this._tickChannel(...)` call site instead
// and slices an empty body, which would make both directions below pass vacuously.
const start = source.search(/^ {2}_tickChannel\(/m);
const body = start === -1 ? '' : source.slice(start, source.indexOf('\n  }', start));

const cased = [...body.matchAll(/case '([a-zA-Z]+)':/g)].map((m) => m[1]).sort();
const declared = [...CHANNEL_TICK_CARDS].sort();

{
  eq('_tickChannel was found in the engine source', start !== -1, true);
  // Direction 1: every declared card really has an arm.
  eq('every CHANNEL_TICK_CARDS entry has a _tickChannel arm',
    declared.filter((id) => !cased.includes(id)).join(','), '');
  // Direction 2: every arm is declared. An arm for a card nobody lists is dead code
  // that reads as live support.
  eq('every _tickChannel arm is declared in CHANNEL_TICK_CARDS',
    cased.filter((id) => !declared.includes(id)).join(','), '');
}

finish('content/channel-sites');
