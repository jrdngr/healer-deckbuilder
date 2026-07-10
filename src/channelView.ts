// Pure helpers for the channeling UI banner (#78). DOM-free so the effect-line
// derivation can be unit-tested against card defs directly. No new engine field:
// the banner's effect text is derived from the card's existing `desc`.

import { CARDS } from './constants';
import type { CardId } from './constants';

// A short per-tick effect line for a channeling card, derived from its `desc`.
// Channel-card descs read "Channel: <effect>. Playing any card ends it." (or
// "... Ends if they die or you play a card.") — strip the "Channel:" prefix and
// the trailing cancel/lifetime sentence so the banner shows just the effect (the
// banner states the cancel rule and turns-left on its own). Falls back to the raw
// desc if it doesn't match the expected channel-card shape.
export function channelEffectLine(id: CardId): string {
  const desc = CARDS[id].desc;
  const effect = desc
    .replace(/^Channel:\s*/i, '')
    .replace(/\.?\s*(Playing any card ends it|Ends if [^.]*)\.?\s*$/i, '')
    .trim();
  return effect.length > 0 ? effect : desc;
}
