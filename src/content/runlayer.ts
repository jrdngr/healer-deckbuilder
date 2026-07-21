// events.json / upgrades.json / modifiers.json loaders and checks (#105).
//
// The run layer's DATA moves here. Event OUTCOMES are still `Run` methods dispatched
// on `choice.kind` — the odds and magnitudes in gambleGold and friends stay engine-side
// for now, exactly as relic behaviour does. What this file adds is that every event
// choice names a kind the run layer actually implements, which was previously only true
// by inspection.
import eventsJson from './events.json';
import upgradesJson from './upgrades.json';
import modifiersJson from './modifiers.json';
import { registerCheck } from './validate/driver';
import { CARD_KNOWN_FIELDS } from './card-fields';
import { suggest } from './validate/report';

export interface EventChoiceJson { label: string; kind: string; detail?: string }
export interface EventJson { id: string; title: string; text: string; choices: EventChoiceJson[] }
export interface UpgradeJson { id: string; stat: string; amount: number; rarity: string; name: string; desc: string; price?: number }

/** A modifier's eligibility, as DATA rather than a closure. */
export type EligibleRule =
  | { anyFieldPresent: string[] }
  | { fieldAbsent: string }
  | { fieldAbove: { field: string; than: number } }
  | { allOf: EligibleRule[] };

export interface ModifierJson { id: string; name: string; rarity: string; desc: string; eligible: EligibleRule }

export const EVENTS_JSON = Object.freeze(eventsJson as unknown as EventJson[]);
export const UPGRADES_JSON = Object.freeze(upgradesJson as unknown as { party: UpgradeJson[]; healer: UpgradeJson[] });
export const MODIFIERS_JSON = Object.freeze(modifiersJson as unknown as Record<string, ModifierJson>);

/** Evaluate a data eligibility rule against a card definition. */
export function evalEligible(rule: EligibleRule, card: Record<string, unknown>): boolean {
  if ('anyFieldPresent' in rule) return rule.anyFieldPresent.some((f) => card[f] != null);
  if ('fieldAbsent' in rule) return card[rule.fieldAbsent] == null || card[rule.fieldAbsent] === false;
  if ('fieldAbove' in rule) {
    const v = card[rule.fieldAbove.field];
    return typeof v === 'number' && v > rule.fieldAbove.than;
  }
  if ('allOf' in rule) return rule.allOf.every((r) => evalEligible(r, card));
  return false;
}

/** Choice kinds the run layer implements. A choice naming anything else is a dead button. */
export const IMPLEMENTED_CHOICE_KINDS = [
  'addCardOffer', 'removeCard', 'gambleGold', 'shrineCard', 'shrineParty', 'cursedChest',
  'mercenary', 'duplicateCard', 'bloodAltar', 'shrineCurse', 'healInjury', 'leave',
] as const;

const PARTY_STATS = ['maxHP', 'damage', 'ability'];
const HEALER_STATS = ['maxMana', 'handSize', 'restRegen', 'passiveMp'];

registerCheck({
  name: 'events.json',
  run(_b, errs) {
    const seen = new Set<string>();
    for (const e of EVENTS_JSON) {
      if (seen.has(e.id)) {
        errs.add({ category: 'ref', file: 'events.json', path: e.id, message: 'duplicate event id' });
      }
      seen.add(e.id);
      if (!e.title || !e.text) {
        errs.add({ category: 'ref', file: 'events.json', path: e.id, message: 'title and text are required' });
      }
      // An event with no way out can trap the run.
      if (!e.choices.some((c) => c.kind === 'leave')) {
        errs.add({ category: 'ref', file: 'events.json', path: e.id,
          message: "every event needs a 'leave' choice, or the run cannot decline it" });
      }
      e.choices.forEach((c, i) => {
        if (!(IMPLEMENTED_CHOICE_KINDS as readonly string[]).includes(c.kind)) {
          errs.unknown('ref', 'events.json', `${e.id}.choices[${i}].kind`,
            'choice kind', c.kind, IMPLEMENTED_CHOICE_KINDS);
        }
        if (!c.label) {
          errs.add({ category: 'ref', file: 'events.json', path: `${e.id}.choices[${i}]`, message: 'label is required' });
        }
      });
    }
  },
});

registerCheck({
  name: 'upgrades.json',
  run(_b, errs) {
    for (const [group, list, stats] of [
      ['party', UPGRADES_JSON.party, PARTY_STATS],
      ['healer', UPGRADES_JSON.healer, HEALER_STATS],
    ] as const) {
      const seen = new Set<string>();
      list.forEach((u, i) => {
        if (seen.has(u.id)) {
          errs.add({ category: 'ref', file: 'upgrades.json', path: `${group}[${i}]`, message: `duplicate id ${JSON.stringify(u.id)}` });
        }
        seen.add(u.id);
        if (!stats.includes(u.stat)) {
          errs.unknown('ref', 'upgrades.json', `${group}[${i}].stat`, 'stat', u.stat, stats);
        }
        if (!(u.amount > 0)) {
          errs.add({ category: 'ref', file: 'upgrades.json', path: `${group}[${i}].amount`, message: 'amount must be positive' });
        }
      });
    }
  },
});

registerCheck({
  name: 'modifiers.json',
  run(_b, errs) {
    for (const [id, m] of Object.entries(MODIFIERS_JSON)) {
      if (m.id !== id) {
        errs.add({ category: 'ref', file: 'modifiers.json', path: id,
          message: `key ${JSON.stringify(id)} does not match its id field ${JSON.stringify(m.id)}` });
      }
      if (!m.eligible) {
        errs.add({ category: 'ref', file: 'modifiers.json', path: `${id}.eligible`, message: 'eligibility rule is required' });
      } else {
        validateEligible(m.eligible, `${id}.eligible`, errs);
      }
    }
  },
});

/**
 * Eligibility rules are checked in shape AND in the card fields they name, because
 * evalEligible fails quiet in both directions:
 *
 *   - its final arm is a bare `return false`, so a rule whose shape it does not
 *     recognise makes the modifier eligible for NOTHING — it simply stops appearing in
 *     shops, with no error and nothing in the log to explain it;
 *   - a rule naming a field that does not exist reads `undefined`, which is a perfectly
 *     good answer to `anyFieldPresent` (no) or `fieldAbsent` (yes). So `"fieldAbsent":
 *     "noPotnet"` does not fail — it silently answers yes for every card in the game.
 *
 * Both produce a modifier that looks configured and behaves wrongly, which is why the
 * field names are pinned to the card field set rather than merely spell-checked.
 */
function validateEligible(
  rule: EligibleRule, path: string,
  errs: Parameters<NonNullable<Parameters<typeof registerCheck>[0]['run']>>[1],
): void {
  const field = (f: string, at: string) => {
    if (!CARD_KNOWN_FIELDS.includes(f)) {
      errs.add({ category: 'ref', file: 'modifiers.json', path: at,
        message: `rule names ${JSON.stringify(f)}, which is not a card field — it would read undefined for every card`,
        hint: suggest(f, CARD_KNOWN_FIELDS) });
    }
  };
  if ('anyFieldPresent' in rule) {
    rule.anyFieldPresent.forEach((f, i) => field(f, `${path}.anyFieldPresent[${i}]`));
  } else if ('fieldAbsent' in rule) {
    field(rule.fieldAbsent, `${path}.fieldAbsent`);
  } else if ('fieldAbove' in rule) {
    field(rule.fieldAbove.field, `${path}.fieldAbove.field`);
  } else if ('allOf' in rule) {
    rule.allOf.forEach((r, i) => validateEligible(r, `${path}.allOf[${i}]`, errs));
  } else {
    errs.add({ category: 'ref', file: 'modifiers.json', path,
      message: `unrecognised eligibility rule — evalEligible would answer false for every card, so the modifier would never be offered. Expected one of: anyFieldPresent, fieldAbsent, fieldAbove, allOf.` });
  }
}
