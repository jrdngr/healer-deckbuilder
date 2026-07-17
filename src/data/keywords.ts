// Effect-keyword registry + a pure, DOM-free tokenizer (#98).
//
// Every status effect the player sees in text (Taunt, Vulnerable, Poison, …) has
// exactly one canonical one-line gloss here, mirroring the MODIFIERS shape
// ({ id, name, desc }) so the definition lives in one place and is unit-testable.
// The React render helper (src/components/KeywordText.tsx) highlights each keyword
// occurrence in a string and attaches its gloss via the #97 themed Tooltip.
//
// Naming decisions (locked, intake 2026-07-17):
//   - the aim-redirect effect is canonically **Taunt** ("Provoke" display text rewords
//     to it; the card named Provoke and the engine's `taunt` field are untouched).
//   - the enemy-takes-more-damage effect is canonically **Vulnerable** (Evil Eye's
//     display text rewords to it; the card keeps its name).
//   - party-side **Hex** (halves party healing) is a SEPARATE keyword/mechanic.
//
// Glosses are verified against the engine, not paraphrased from one card.

export type KeywordId =
  | 'taunt' | 'riposte' | 'defense' | 'guard' | 'shield' | 'regen'
  | 'poison' | 'vulnerable' | 'hex' | 'charge' | 'grudge' | 'stun'
  | 'doom' | 'enraged' | 'siphon';

export interface KeywordDef {
  id: KeywordId;
  name: string;
  desc: string;
}

export const KEYWORDS: Record<KeywordId, KeywordDef> = {
  taunt: {
    id: 'taunt', name: 'Taunt',
    desc: 'The enemy aims its next attack at this member.',
  },
  riposte: {
    id: 'riposte', name: 'Riposte',
    desc: 'The next hit that strikes them is answered with a counterattack.',
  },
  defense: {
    id: 'defense', name: 'Defense',
    desc: 'Reduces the damage taken from each incoming hit while it holds.',
  },
  guard: {
    id: 'guard', name: 'Guard',
    desc: 'Flat damage reduction on each hit. Stacks with Defense, not with itself.',
  },
  shield: {
    id: 'shield', name: 'Shield',
    desc: 'Fully blocks the next attack instance, then is spent.',
  },
  regen: {
    id: 'regen', name: 'Regen',
    desc: 'Heals a decaying amount at the start of each of your turns.',
  },
  poison: {
    id: 'poison', name: 'Poison',
    desc: 'The enemy takes damage at the start of each of its turns.',
  },
  vulnerable: {
    id: 'vulnerable', name: 'Vulnerable',
    desc: 'The enemy takes increased damage from all sources until it fades.',
  },
  hex: {
    id: 'hex', name: 'Hex',
    desc: 'Halves all party healing until it fades. Cleanse removes it.',
  },
  charge: {
    id: 'charge', name: 'Charge',
    desc: 'The Mage banks Charge each turn; Lightning Bolt spends it for bonus damage.',
  },
  grudge: {
    id: 'grudge', name: 'Grudge',
    desc: 'The Tank banks the damage he soaks; his next auto adds a share of it.',
  },
  stun: {
    id: 'stun', name: 'Stun',
    desc: "Cancels the enemy's telegraphed action for the turn.",
  },
  doom: {
    id: 'doom', name: 'Doom',
    desc: 'A delayed curse that detonates for damage after several enemy turns.',
  },
  enraged: {
    id: 'enraged', name: 'Enraged',
    desc: "The enemy's attacks hit harder for the rest of the fight.",
  },
  siphon: {
    id: 'siphon', name: 'Siphon',
    desc: 'The enemy drains your MP at the start of its turn.',
  },
};

export const KEYWORD_IDS = Object.keys(KEYWORDS) as KeywordId[];

// Display terms matched in text, mapped to their keyword id. The canonical name is
// always a term; a few inflections / legacy spellings (e.g. "Provokes" → Taunt,
// "Vulnerability" → Vulnerable) are included so surviving/derived text still
// highlights. Card *names* are never tokenized, so aliasing "Provoke" to Taunt
// cannot mis-tag the card named Provoke.
const KEYWORD_TERMS: Array<[string, KeywordId]> = [
  ['Taunt', 'taunt'], ['Taunts', 'taunt'], ['Provoke', 'taunt'], ['Provokes', 'taunt'],
  ['Riposte', 'riposte'], ['Ripostes', 'riposte'],
  ['Defense', 'defense'],
  ['Guard', 'guard'],
  ['Shield', 'shield'], ['Shields', 'shield'],
  ['Regen', 'regen'],
  ['Poison', 'poison'], ['Poisons', 'poison'],
  ['Vulnerable', 'vulnerable'], ['Vulnerability', 'vulnerable'],
  ['Hex', 'hex'], ['Hexed', 'hex'],
  ['Charge', 'charge'],
  ['Grudge', 'grudge'],
  ['Stun', 'stun'], ['Stuns', 'stun'], ['Stunned', 'stun'],
  ['Doom', 'doom'],
  ['Enraged', 'enraged'], ['Enrage', 'enraged'], ['Enrages', 'enraged'],
  ['Siphon', 'siphon'], ['Siphons', 'siphon'],
];

const TERM_LOOKUP = new Map<string, KeywordId>(
  KEYWORD_TERMS.map(([term, id]) => [term.toLowerCase(), id]),
);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word, case-insensitive alternation. Longest terms first so a longer term
// (e.g. "Vulnerability") is preferred at a shared start; the \b anchors already stop
// a shorter term from matching inside a longer word ("Charge" never inside "Charged").
const TERM_RE = new RegExp(
  '\\b(' + KEYWORD_TERMS
    .map(([term]) => term)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|') + ')\\b',
  'gi',
);

export type KeywordToken =
  | { text: string }
  | { keyword: KeywordId; text: string };

// Split a string into plain-text and keyword segments. Whole-word and case-aware:
// the matched slice's original casing is preserved (rendered verbatim), while the
// keyword id is resolved case-insensitively. Matches never overlap or double-tag —
// the scan partitions the string left-to-right.
export function tokenizeKeywords(input: string): KeywordToken[] {
  const tokens: KeywordToken[] = [];
  let last = 0;
  TERM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_RE.exec(input)) !== null) {
    if (m.index > last) tokens.push({ text: input.slice(last, m.index) });
    const id = TERM_LOOKUP.get(m[0].toLowerCase());
    // id is always defined (every alternative came from TERM_LOOKUP's keys), but
    // fall back to plain text rather than throw if a future edit desyncs them.
    if (id) tokens.push({ keyword: id, text: m[0] });
    else tokens.push({ text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < input.length) tokens.push({ text: input.slice(last) });
  return tokens;
}

// Distinct keyword ids referenced by a string (for exhaustiveness tests).
export function keywordsIn(input: string): KeywordId[] {
  const seen = new Set<KeywordId>();
  for (const t of tokenizeKeywords(input)) {
    if ('keyword' in t) seen.add(t.keyword);
  }
  return [...seen];
}
