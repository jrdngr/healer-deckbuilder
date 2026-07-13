// Character-art coverage. Run with: tsx test/characterArt.test.ts
// resolveArt() must return non-empty art for EVERY roster id (all 14 heroes +
// all 15 enemy defs, incl. spammer=Brute and the plain enemy/boss fallbacks), so
// a future roster addition that lacks art trips this test.
import { resolveArt, HERO_ART_IDS, ENEMY_ART_IDS } from '../src/characterArt';
import {
  MEMBER_POOL,
  NORMAL_ENEMY_DEFS, DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF,
  GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF,
} from '../src/constants';

import { check, finish } from './harness';

const memberIds = Object.keys(MEMBER_POOL);
const enemyDefs = [
  ...NORMAL_ENEMY_DEFS, DEFAULT_ENEMY_DEF, BOSS_ENEMY_DEF,
  GATEWARDEN_DEF, HEXWEAVER_DEF, DEVOURER_DEF,
];

// Every layer list always carries at least the ground shadow + body (2 base layers).
const MIN_LAYERS = 3;

// --- Heroes: every member id resolves to hero art -----------------------------
for (const id of memberIds) {
  const art = resolveArt(id, false);
  check(`hero '${id}' resolves to non-empty art`, art.layers.length >= MIN_LAYERS, String(art.layers.length));
  check(`hero '${id}' is marked isEnemy:false`, art.isEnemy === false);
  // Hero body uses the softer (friendlier) blob radius.
  check(`hero '${id}' uses the hero body shape`,
    art.layers.some((l) => l.includes('42% 42% 36% 36%')));
}
check('all 10 heroes have signature art ids', HERO_ART_IDS.length === 10, String(HERO_ART_IDS.length));
check('every member id has matching hero art', memberIds.every((id) => HERO_ART_IDS.includes(id)),
  memberIds.filter((id) => !HERO_ART_IDS.includes(id)).join(', '));

// --- Enemies: every enemy def resolves to enemy art ---------------------------
for (const def of enemyDefs) {
  const art = resolveArt(def.id, true);
  check(`enemy '${def.id}' resolves to non-empty art`, art.layers.length >= MIN_LAYERS, String(art.layers.length));
  check(`enemy '${def.id}' is marked isEnemy:true`, art.isEnemy === true);
  check(`enemy '${def.id}' uses the enemy body shape`,
    art.layers.some((l) => l.includes('40% 40% 32% 32%')));
}
check('all 15 enemy defs have art ids', ENEMY_ART_IDS.length === 15, String(ENEMY_ART_IDS.length));
check('every enemy def id has matching art', enemyDefs.every((d) => ENEMY_ART_IDS.includes(d.id)),
  enemyDefs.filter((d) => !ENEMY_ART_IDS.includes(d.id)).map((d) => d.id).join(', '));

// --- spammer is "Brute": its art carries the signature fang layer -------------
{
  const brute = enemyDefs.find((d) => d.name === 'Brute');
  check('the enemy named "Brute" has roster id spammer', brute?.id === 'spammer', brute?.id);
  const art = resolveArt('spammer', true);
  // Fang underbite fangs are cream triangles (polygon(0 0,100% 0,50% 100%)).
  check('spammer/Brute art includes its fang layer',
    art.layers.some((l) => l.includes('polygon(0 0,100% 0,50% 100%)')));
}

// --- Bosses wear a gold crown (the crown zig-zag clip-path) --------------------
for (const id of ['gatewarden', 'hexweaver', 'devourer', 'boss']) {
  const art = resolveArt(id, true);
  // gatewarden/devourer/boss use the crown polygon; hexweaver's crown is its witch
  // hat + moon charm, so accept either the crown polygon or the moon-charm radial.
  const hasCrown = art.layers.some((l) => l.includes('20% 68%,34% 0%,50% 62%'))
    || art.layers.some((l) => l.includes('radial-gradient(circle at 68% 30%'));
  check(`boss '${id}' has a crown / boss headpiece`, hasCrown);
}

// --- Unknown id defaults to the plain 'enemy' art -----------------------------
{
  const unknown = resolveArt('totally-not-a-real-id');
  const plainEnemy = resolveArt('enemy', true);
  check('an unknown id falls back to the plain enemy art',
    JSON.stringify(unknown.layers) === JSON.stringify(plainEnemy.layers));
  check('the unknown-id fallback is marked isEnemy:true', unknown.isEnemy === true);
}

// --- No hero/enemy id collision (the merged lookup is unambiguous) ------------
check('no id is shared between the hero and enemy art tables',
  HERO_ART_IDS.every((id) => !ENEMY_ART_IDS.includes(id)));

finish('characterArt');
