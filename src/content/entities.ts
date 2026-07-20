// relics.json / members.json loaders and their validation checks (#103/#106).
//
// These files are pure METADATA — name, rarity, icon, stats, desc. Relic BEHAVIOUR is
// still engine code (the `hasRelic` sites #103 will move onto a hook bus), and hero
// passives likewise. The split is deliberate for now and the validator enforces the
// half that exists: every declared id resolves, every desc placeholder resolves.
import relicJson from './relics.json';
import memberJson from './members.json';
import { registerCheck } from './validate/driver';
import { renderTemplate } from './interpreter/template';
import { CONTENT_TUNING } from './tuning';

export interface RelicJson {
  id: string; name: string; rarity: string; icon: string; curse?: boolean; desc: string;
}
export interface MemberJson {
  id: string; name: string; slot: number; maxHP: number; damage: number; ability: string;
  passiveFlavor?: { name: string; desc: string };
}

export const RELIC_JSON = Object.freeze(relicJson as unknown as Record<string, RelicJson>);
export const MEMBER_JSON = Object.freeze(memberJson as unknown as Record<string, MemberJson>);

export const RELIC_JSON_IDS: readonly string[] = Object.freeze(Object.keys(RELIC_JSON).sort());
export const MEMBER_JSON_IDS: readonly string[] = Object.freeze(Object.keys(MEMBER_JSON).sort());

const RARITIES = ['common', 'uncommon', 'rare'];

registerCheck({
  name: 'relics.json',
  run(_b, errs) {
    for (const [id, r] of Object.entries(RELIC_JSON)) {
      if (r.id !== id) {
        errs.add({ category: 'ref', file: 'relics.json', path: id,
          message: `key ${JSON.stringify(id)} does not match its id field ${JSON.stringify(r.id)}` });
      }
      if (!RARITIES.includes(r.rarity)) {
        errs.unknown('ref', 'relics.json', `${id}.rarity`, 'rarity', r.rarity, RARITIES);
      }
      if (!r.icon || !r.name) {
        errs.add({ category: 'ref', file: 'relics.json', path: id, message: 'name and icon are required' });
      }
      for (const e of renderTemplate(r.desc, { fields: r as unknown as Record<string, unknown>, tuning: CONTENT_TUNING }).errors) {
        errs.add({ category: 'template', file: 'relics.json', path: `${id}.desc`, message: e });
      }
    }
  },
});

registerCheck({
  name: 'members.json',
  run(_b, errs) {
    for (const [id, m] of Object.entries(MEMBER_JSON)) {
      if (m.id !== id) {
        errs.add({ category: 'ref', file: 'members.json', path: id,
          message: `key ${JSON.stringify(id)} does not match its id field ${JSON.stringify(m.id)}` });
      }
      if (!(m.maxHP > 0)) {
        errs.add({ category: 'ref', file: 'members.json', path: `${id}.maxHP`, message: 'maxHP must be positive' });
      }
      if (typeof m.damage !== 'number' || m.damage < 0) {
        errs.add({ category: 'ref', file: 'members.json', path: `${id}.damage`, message: 'damage must be a non-negative number' });
      }
      // A hero whose signature ability has no action list would silently do nothing.
      if (!m.ability) {
        errs.add({ category: 'ref', file: 'members.json', path: `${id}.ability`, message: 'ability is required' });
      }
    }
  },
});
