# Handoff: War-Torn Character Set (Mendlings)

## Overview
The full cast of the healer-deckbuilder — 14 heroes and 15 enemies (4 bosses, incl. the generic fallback defs) — in the **"War-Torn" art style**: a cartoony but battle-hardened look with shaded blob bodies, thick ink outlines, white eyes with pupils, and per-character battle detail (armor, cracks, scars, gritted teeth). This is the style chosen for implementation out of five candidates.

## About the Design Files
The files in this bundle are **design references created in HTML** — they show the intended look, not production code to copy directly. The task is to **recreate these characters as reusable art assets in the target codebase's environment** (most likely as SVGs, or as a canvas/component renderer, whichever fits the game's stack). If no environment exists yet, choose whatever fits the game project best; SVG export is the expected end format.

## Fidelity
**High-fidelity.** Colors, proportions, layer geometry, and per-character features are final. Recreate them faithfully. All geometry is data-driven (see "Construction system") so translation to SVG is mechanical.

## Construction system
Every character is a stack of absolutely-positioned layers inside a **96 × 104 px tile** (scale-free — all values are % of tile or small px offsets; keep the 96:104 aspect when exporting at other sizes).

Layer order (bottom → top):
1. **Ground shadow** — ellipse, `rgba(58,45,40,.16)`, bottom of tile.
2. **Body** — the character's fill color `c`, `4px` ink outline, blob border-radius:
   - Heroes: `border-radius: 42% 42% 36% 36% / 48% 48% 34% 34%`
   - Enemies: `border-radius: 40% 40% 32% 32% / 44% 44% 30% 30%` (squarer, more aggressive)
   - Shading: inner bottom shade `rgba(58,45,40,.14)` (12px) + inner top highlight `rgba(255,255,255,.3)` (4px). In SVG, reproduce as two overlay paths or a vertical gradient.
3. **Brows** — ink bars, rotated ±7° (heroes, neutral) or ±24° (enemies, angry). Some characters omit them (see table).
4. **Eyes** — white `#fffdf6` circles (16×14) with 2.5px ink outline + ink pupil (6×7). Exceptions noted per character.
5. **Mouth** — heroes: small ink smile; enemies: gritted-teeth rectangle (cream with a center ink gap, 2px ink border). Several characters replace this with a custom maw.
6. **Signature features** — per-character layers, exact geometry in `reference.html`.

All layer geometry is in `reference.html` in three plain-JS structures:
- `HEROES` / `ENEMIES` — roster with per-character fill color `c` and ids
- `S2F` — per-character signature feature layers (CSS `left/top/width/height/background/clip-path/transform` strings)
- `s2(entity, isEnemy)` — assembles the full layer list for one character

Open `reference.html` in a browser to see the rendered set; read those structures for exact values.

## Roster id mapping
Character ids in `reference.html` match the roster ids in the game's `src/constants.ts` (`MemberId` / `EnemyDef.id`). Note: the enemy with display name **"Brute"** has roster id **`spammer`** — the reference data uses `spammer`. The generic `enemy` / `boss` fallback defs (`DEFAULT_ENEMY_DEF` / `BOSS_ENEMY_DEF`) get deliberately plain art.

## Characters & signature features

### Heroes (roleColor `#57b8a5`)
| Name | Body color | War-Torn signature features |
|---|---|---|
| Ranger | `#9ed486` | Torn/jagged-edged hood (`#4e6a3e` over ink underlayer), leaf clasp, worn brown belt strap (`#6a4a32`) with square buckle |
| Tank | `#8fc3e8` | Riveted steel helmet (`#4a6a8a`, dome + nose guard, 4 rivets `#c9d8e8`), 2 crack lines on body |
| Mage | `#c7a4f0` | Crooked bent-tip wizard hat (`#5a3f8a`) with darker band (`#472f70`) and a square fabric patch (`#ffd97a`, dashed stitch border) |
| Warlock | `#b58ad6` | Two horns (`#3a2453`) — **left horn chipped/broken** with a pale scratch; ragged cloak fringe at the bottom |
| Berserker | `#ff9d7e` | **Jagged scar** (`#8f3d2e` lightning-bolt shape, rotated 8°) crossed by 3 ink stitch bars, over a **squinting right eye** |
| Grave Augur | `#8fd4c8` | Third eye on forehead (cream sclera, teal `#2a7a6a` iris) with 3 lash ticks; twin teal dot markings on cheeks |
| Sentinel | `#a9bdd4` | Metal face-visor plate (`#5a6f85`, full-width) with glowing rivet eye and scratch highlight; helmet crest on top |
| Duelist | `#ffa9be` | Rapier at back (blade `#e0e5ec`, gold guard `#ffd97a`); an X of cloth bandage strips (`#e8d9b8`) on the body |
| Skald | `#f2c078` | Feathered minstrel cap (`#8f5a3e` with `#6a4326` brim, red feather) and a battered lute at the hip (`#a86a3e` body, ink sound hole) with a snapped, curling string |
| Beast Warden | `#c9a06e` | Fur hood (`#8a6a44`) with round bear ears and fur-stitch texture; twin tusk pendants; a tiny boar companion (`#9a7250`) at her side |
| Plaguewright | `#8aab5f` | Plague-doctor look: dark green hood (`#4a5a30`), brass goggle eyes (`#d8b878` rims, dark glass — replaces standard eyes), stitched cream beak mask over the mouth, and a dripping poison vial at the hip |
| Hierophant | `#ece0b8` | Tall cracked mitre (`#f0e6d0`) with gold band and sun disc (`#f0a832`); twin gold stole strips down the body; a censer swinging on a chain with a smoke wisp |
| Flagellant | `#e8c9a8` | Cloth wraps: a bandage headband (`#e8dcc0`, stitched, with a loose tail) and a body wrap; red welt marks (`#c0453a`); a knotted rope flail hanging at his side |
| Lightkeeper | `#ffd166` | Gold circlet with glowing sun disc (`#ffd97a`); a lantern staff at her side — hooked pole (`#6a4a32`) with a glowing lantern (`#ffd97a`, red flame) |

### Enemies (roleColor `#f07a5e`, bosses `#f0a832`)
| Name | Body color | War-Torn signature features |
|---|---|---|
| Brute | `#cf8a70` | Fang underbite (2 cream triangle fangs, no mouth bar), stitched dark patch on brow, 3 claw-scratch lines |
| Swarm | `#c2a86a` | Two smaller blob minions clinging to the sides, each with its own dot eyes |
| Stalker | `#8fa0b8` | Full-width dark visor band (`#3f3a48`) with two **glowing pale slit eyes** (`#eafcff`, glow shadow) and 3 scratch marks — replaces standard eyes |
| Gatewarden (boss) | `#a08fd0` | Battered gold crown (`#f0a832`, ink outline) with red gem; keyhole plate (`#f0d998`) on body with ink keyhole |
| Ironmaw | `#a8b0b8` | Riveted jaw-plate (`#7a828c`) covering lower body with a row of cream teeth zig-zag and 5 rivets — replaces mouth |
| Needler | `#b8c078` | Spiky crest (`#8a9048` over ink underlayer, 9-point zig-zag) plus two side spikes |
| Hexweaver (boss) | `#cf8ac2` | Tattered witch hat (`#5a2a52`) with band + gold crescent-moon charm; stitched grin (ink line + 3 stitch bars) — replaces mouth |
| Juggernaut | `#c29070` | Heavy helm (`#6a4a32`) with ink visor slit and 2 gold side bolts (`#d8b878`); belt strap with gold rivet |
| Devourer (boss) | `#b06a80` | Battered gold crown + red gem; gaping dark maw (`#3a1018`) with two rows of cream teeth and tongue (`#c05a6a`) — replaces mouth |
| Cleaver | `#c76a5a` | Big notched cleaver blade (`#c9d0d8` on ink underlayer) slung over the shoulder with a wooden handle (`#6a4326`); brow scratch scar |
| Leech | `#d8a0c0` | Round sucker maw (`#7a3a52`) with a dotted ring of cream teeth and a dark throat — replaces mouth; drool drip and a slime puddle (`#c887ab`) |
| Lancer | `#7fa8c9` | Steel helmet (`#5a7a99`) with red plume and nose guard; a long lance (`#c9d0d8`) angled over the shoulder with a red pennant |
| Devourling | `#c07898` | Mini-Devourer: two horn nubs (`#8a4a62`), gaping dark maw (`#3a1018`) with one row of teeth and tongue — replaces mouth. No crown |
| Enemy (`enemy`) | `#b0a89c` | Generic fallback — plain body, standard angry face, two hairline cracks only |
| Boss (`boss`) | `#8a8296` | Generic boss fallback — plain body with a battered IRON crown (`#8a929c`, not gold) and a crack |

## Design tokens
- Ink (outlines, pupils, brows): `#3a2d28`
- Cream (sclera, teeth): `#fffdf6`
- Ground shadow: `rgba(58,45,40,.16)`
- Body shade / highlight: `rgba(58,45,40,.14)` / `rgba(255,255,255,.3)`
- Outline weights: body 4px, features 2.5–3px, small details 2px (at 96px tile width; scale proportionally)
- Crown gold `#f0a832`, gem red `#e05a4e`, glow-eye `#eafcff`
- Body colors: per character, in the tables above / `HEROES` & `ENEMIES` in `reference.html`

## Implementation notes
- Recommended: one SVG per character, `viewBox="0 0 96 104"`, layers in the order listed. CSS `border-radius` blobs translate to SVG ellipse-ish paths; `clip-path: polygon(...)` values translate 1:1 to SVG `<polygon>` points.
- Some layers use `color-mix(in srgb, <c> N%, <dark>)` — precompute these to flat hex when exporting.
- Include the ground shadow in the asset only if the game doesn't render its own.
- Keep hero vs enemy brow angle and eye treatment consistent when adding future characters — that's what reads as "friendly vs hostile" at small sizes.

## Files
- `reference.html` — self-contained rendered reference of all 29 characters + the complete geometry data (open in any browser; no build step)
