// Effect-keyword registry + tokenizer tests (#98). Run with: tsx test/keywords.test.ts
// (part of npm test). The highlight COLOR and the exact gloss wording are maintainer-
// verified visually per CLAUDE.md; here we assert the extractable pure pieces: every
// keyword has a gloss, every keyword a card desc references resolves in the registry,
// the tokenizer matches whole words only (never substrings, never double-tags), and no
// reworded card desc still carries a parenthetical effect gloss.
import { KEYWORDS, KEYWORD_IDS, tokenizeKeywords, keywordsIn } from '../src/data/keywords';
import type { KeywordId } from '../src/data/keywords';
import { CARDS } from '../src/constants';
import type { CardId } from '../src/constants';
import { check, eq, finish } from './harness';

// --- registry: every keyword has a non-empty name + gloss ---
for (const id of KEYWORD_IDS) {
  const def = KEYWORDS[id];
  eq(`${id}: id matches its key`, def.id, id);
  check(`${id}: has a non-empty name`, def.name.trim().length > 0);
  check(`${id}: has a non-empty gloss`, def.desc.trim().length > 0);
}

// --- exhaustiveness: every keyword a card desc references exists in the registry ---
// (tokenizeKeywords only emits ids drawn from the registry-backed term map, so this
// also proves no highlighted keyword is glossless.)
{
  const referenced = new Set<KeywordId>();
  for (const id of Object.keys(CARDS) as CardId[]) {
    for (const kw of keywordsIn(CARDS[id].desc)) referenced.add(kw);
  }
  let allResolve = true;
  for (const kw of referenced) if (!(kw in KEYWORDS)) allResolve = false;
  check('every keyword referenced by a card desc resolves in the registry', allResolve);
  // Sanity: the card pool actually exercises the treatment (not a vacuous pass).
  check('card descs reference at least a handful of distinct keywords', referenced.size >= 6);
}

// --- tokenizer: whole-word matching, casing preserved, no substring mis-highlights ---
{
  const toks = tokenizeKeywords('Applies Taunt to the target.');
  const kw = toks.filter((t) => 'keyword' in t) as Array<{ keyword: KeywordId; text: string }>;
  eq('one keyword found in a simple Taunt line', kw.length, 1);
  eq('it is the taunt keyword', kw[0].keyword, 'taunt');
  eq('the matched text preserves its casing', kw[0].text, 'Taunt');
  eq('round-trips back to the original string',
    toks.map((t) => t.text).join(''), 'Applies Taunt to the target.');
}

// substrings must NOT match: "Charge" inside "Charged", "Defense" inside "defended".
{
  eq('does not highlight "Charge" inside "Charged"',
    keywordsIn('The mage is Charged up.').length, 0);
  eq('does not highlight "Defense" inside "defended"',
    keywordsIn('Cannot target a defended member.').length, 0);
  // ...but the whole word still matches (word boundary at a hyphen too).
  eq('matches "Poison" before a hyphen', keywordsIn("the enemy's Poison-per-turn").join(','), 'poison');
}

// case-insensitive find, id resolved regardless of case; e.g. the all-caps ENRAGED chip.
{
  const kws = keywordsIn('The boss is ENRAGED now.');
  eq('all-caps ENRAGED resolves to the enraged keyword', kws.join(','), 'enraged');
}

// legacy/inflected display forms still resolve to their canonical keyword.
{
  eq('"Provokes" resolves to taunt', keywordsIn('She Provokes the enemy.').join(','), 'taunt');
  eq('"Vulnerability" resolves to vulnerable', keywordsIn('its Vulnerability scales it').join(','), 'vulnerable');
}

// no double-tagging: a keyword appearing twice yields exactly two segments, in order.
{
  const kws = keywordsIn('Taunt now and Taunt again, plus Riposte.');
  eq('distinct keywords across the line', kws.sort().join(','), 'riposte,taunt');
  const count = tokenizeKeywords('Taunt and Taunt')
    .filter((t) => 'keyword' in t).length;
  eq('each occurrence is tokenized once', count, 2);
}

// plain text with no keyword returns a single text token, untouched.
{
  const toks = tokenizeKeywords('Heal a member for 2.');
  eq('plain line is one text token', toks.length, 1);
  check('the text token is unchanged', !('keyword' in toks[0]) && toks[0].text === 'Heal a member for 2.');
}

// --- reword: no card desc still carries a parenthetical effect gloss (#98) ---
{
  const GLOSS_RE = /\((enemy aims|aims at|the enemy aims)/i;
  let clean = true;
  let offender = '';
  for (const id of Object.keys(CARDS) as CardId[]) {
    if (GLOSS_RE.test(CARDS[id].desc)) { clean = false; offender = id; }
  }
  check('no card desc still contains an "(… aims at …)" effect gloss', clean, offender);
  // the specific reworded descs read in effect-noun form now.
  eq('provoke reworded to effect-noun form', CARDS.provoke.desc, 'Applies Taunt to the target for 2 enemy turns.');
  check('en garde no longer says "Provokes"', !/Provoke/i.test(CARDS.enGarde.desc));
  check('lunge no longer says "Provokes"', !/Provoke/i.test(CARDS.lunge.desc));
  check('evil eye reworded to Vulnerable keyword', /Vulnerable/.test(CARDS.hex.desc) && !/takes more damage/i.test(CARDS.hex.desc));
}

finish('keywords');
