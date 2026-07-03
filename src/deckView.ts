// Pure helpers for the in-fight deck viewer (#24, flaw #16). DOM-free so the
// counts/grouping can be unit-tested against engine state directly.

import { CARDS, resolveCard } from './constants';
import type { DeckCard } from './constants';

export interface PileGroup {
  label: string; // display name, with upgrade names folded in
  count: number;
}

// Group a pile for display, SORTED BY NAME — never by pile order, so the
// viewer can show the draw pile's contents without leaking its order.
export function groupPile(cards: DeckCard[]): PileGroup[] {
  const counts = new Map<string, number>();
  for (const dc of cards) {
    const r = resolveCard(dc);
    const label = dc.upgrades.length > 0
      ? `${CARDS[dc.id].name} (${r.upgrades.map((u) => u[0].toUpperCase() + u.slice(1)).join(', ')})`
      : CARDS[dc.id].name;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]): PileGroup => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
