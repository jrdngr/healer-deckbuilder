# Mendlings — Visual Style Guide

Restyling spec for the Healer Deckbuilder ("Mendlings" theme). This document + `mendlings-theme.css`
are the complete handoff. **Scope: styling only.** Do not change game layout structure, component
hierarchy, or any game logic — only colors, typography, borders, radii, shadows, iconography, and
motion. Where a recipe below implies structure (e.g. a cost bubble), attach it to the existing
element for that datum.

---

## 1. Design principles

1. **Chunky & friendly.** Everything sits on a warm cream world with a single dark chocolate ink
   (`#3a2d28`) used for ALL outlines and text. Borders are thick (2–3px), radii are big (11–24px).
2. **Sticker depth, not blur.** Depth comes from hard offset shadows (`0 5px 0 rgba(58,45,40,.18)`),
   never soft blurs. Buttons "press" by translating down 2px and shrinking the shadow.
3. **One ink.** No greys-of-many-hues: text/muted/faint are tints of the same warm brown.
4. **Color = meaning.** Teal heals, blue mana, gold ward/currency, lavender power, coral danger.
   Never use these hues decoratively.
5. **No emoji.** All iconography is the inline stroke SVG set (§6) at stroke-width 2.2–3,
   round caps/joins, `viewBox="0 0 24 24"`.
6. **Rounded pills everywhere.** Chips, badges, bars, and small buttons are full-radius (999px) pills
   with 2px ink borders.

## 2. Design tokens

All tokens live in `mendlings-theme.css` as CSS custom properties. Key values:

| Token | Value | Use |
|---|---|---|
| `--page-bg` | `linear-gradient(180deg,#c5e6dc 0%,#f2ecd8 58%,#f7efdc 100%)` | app background (mint sky → cream) |
| `--ink` | `#3a2d28` | text, ALL borders/outlines |
| `--muted` | `#7c6a60` | secondary text |
| `--faint` | `#a89890` | tertiary text, dashed placeholders |
| `--panel` | `#fffdf6` | panel & card faces |
| `--accent` | `#ffc94e` (grad `#ffd97a→#ffc23e`) | primary buttons, active pills |
| `--danger` | `#f07a5e` (grad `#ff9a80→#ef6a50`) | enemy HP, intent, destructive CTA |
| `--hp` | `#57b8a5` (hi `#7fd4c2`) | health fills, heal chips |
| `--mp` | `#6a9fe6` (hi `#8fbaf4`) | mana fills, cost bubbles |
| `--gold` | `#f0a832` | currency, rare rarity, crowns |
| `--fam-heal / -ward / -mana / -power` | `#57b8a5 / #f0a832 / #6a9fe6 / #c78ae0` | card family accents |
| `--track` | `#ece2cc` | empty bar track |
| `--grass` / `--grass-2` | `#a9d58e` / `#93c778` | battlefield meadow |
| `--r-lg / -md / -sm` | `22px / 16px / 11px` | radii: panels / cards / chips |
| `--bw / --bw-card` | `2px / 3px` | border widths: chips / cards+panels |
| `--shadow-card` | `0 5px 0 rgba(58,45,40,.18)` | resting card/panel shadow |
| `--shadow-btn` | `0 5px 0 rgba(58,45,40,.5)` | resting button shadow |

Hero identity colors (pastel, used for blob bodies and any per-hero accent):
`tank #8fc3e8 · mage #c7a4f0 · ranger #9ed486 · warlock #b58ad6 · berserker #ff9d7e ·
graveAugur #8fd4c8 · sentinel #a9bdd4 · duelist #ffa9be`

Enemy colors:
`Brute #cf8a70 · Swarm #c2a86a · Stalker #8fa0b8 · Gatewarden #a08fd0 · Ironmaw #a8b0b8 ·
Needler #b8c078 · Hexweaver #cf8ac2 · Juggernaut #c29070 · Devourer #b06a80`

Log/feedback text colors: heal `#2f9c88`, damage `#e86a50`, mana `#4a80cc`, system `#c08428`,
neutral `#8a7568`.

## 3. Typography

- **Display** (`--f-disp`): `'Baloo 2', cursive` — headings, card names, character names, buttons.
  Weights 700–800. Screen titles ~36px; card names 15–17px; the game title 800 weight.
- **UI** (`--f-ui`): `'Nunito', sans-serif` — everything else. Base weight **700** (the theme never
  uses regular weight); labels/eyebrows are 900 with `letter-spacing: 2px; text-transform: uppercase`
  at 10–11px.
- Numbers always get `font-variant-numeric: tabular-nums`.
- Google Fonts import: `Baloo+2:wght@500;600;700;800` + `Nunito:wght@500;600;700;800;900`.

## 4. Component recipes

**Primary button** — accent gradient face, 3px ink border, radius 16px, Baloo 800, ink-tinted text
`#4a3410`, shadow `--shadow-btn`. Hover: `translateY(-2px)`. Active: `translateY(2px)` +
`box-shadow: 0 2px 0 rgba(58,45,40,.5)`. Destructive CTA: same but `--danger-grad`, white text.

**Ghost/secondary button** — panel face, 3px ink border, muted text, `--shadow-card`.

**HUD pills** — `rgba(255,253,246,.78)` bg + `backdrop-filter: blur(6px)`, 2px ink border,
999px radius, 12.5px/800 text, icon + value.

**Bars (HP/MP/enemy)** — 999px-radius track `--track` with 2px ink border; fill is a vertical
two-stop gradient (hi→base) also 999px; centered label 9–11px/900 in ink; `transition: width .3s`.
HP fill shifts by fraction: >50% teal, 25–50% gold (`#ffd97a→#f0a832`), <25% danger gradient.

**Hand cards** — 128×158px min, panel face, 3px ink border, radius 16px, `--shadow-card`.
Cost bubble: 30px circle, mana gradient, 2.5px ink border, OVERHANGS top-left (-11px, -10px).
Heal value: small pill INSIDE the card face (heart icon + number, hp gradient) — never overhang
the right edge (fanned cards overlap on the right). Name: Baloo 700 15.5px centered; family tick:
22×4px pill in family color; description 11px/700 muted. Fan: cards overlap `-14px`,
rotate `(i - (n-1)/2) * 2.2deg`, sag `|offset| * 5px`; hover lifts `-16px` and straightens;
unaffordable at 45% opacity; selected: mana-blue border + `0 0 0 4px rgba(mp, .3)` ring.
Deal-in: fade + rise 24px + scale .85→1, 300ms, 45ms stagger.

**Card piles (draw/discard)** — a stack of 3 offset/rotated card backs (rotations ≈ -6°/-2°/+2.5°),
top card shows a striped inner panel (`repeating-linear-gradient(45deg, tint 0 7px, lighter 7px 14px)`;
draw = mint `#bfe0d5/#d3ebe2`, discard = peach `#ecd9c2/#f4e6d4`) inside a 2px ink inner border,
with a centered 44px circle medallion (panel face, 2.5px ink border, Baloo 800 count).
Empty pile: dashed 3px `--faint` outline with a faint count. Label below: 9.5px/900 uppercase.

**Status badges** — pill: panel face, 2px ink border, 999px, 9.5–10px/900 ink text, leading
14px stroke icon colored by status (shield=mana blue, regen=heal teal, taunt=ward gold).
Pop-in: scale .6→1.06→1, 300ms.

**Party member cards ("Cards" style)** — 160×204px min, same chassis as hand cards; blob 62px
top-center; name Baloo 700 16px; HP bar; labeled badge pills; attack chip pinned top-right corner
(-11px overhang): danger gradient pill, white sword icon + number. Targeted by enemy: danger border
+ pulsing ring `0 0 0 6px rgba(239,106,80,.35)`; valid heal target: mana border + blue ring;
fallen: 65% opacity + centered "FALLEN" pill (panel face, danger border/text).

**Enemy panel** — panel chassis, blob left (86px, angry brows), name Baloo 800 24px, ENRAGED pill
(danger bg, white 900 text, pulse 1.2s), turn pill, danger HP bar, intent chip (danger tint bg
`color-mix(danger 14%, transparent)`, danger border/text, sword icon).

**Battlefield ("Field" style)** — meadow: two stacked ellipse hills (`--grass`, `--grass-2` at 50%
opacity) with 3px ink top edge; white 55%-opacity capsule clouds drifting ±14px over 9–12s. Sprites:
hero blobs 76–98px with ellipse shadow `rgba(58,45,40,.18)` beneath; floating plate above each
(HUD-pill styling: name 13px Baloo, 86px HP bar, icon-dot statuses). Enemy sprite 136px with plate
incl. intent. Targeted: red triangle arrow (ink outline) bobbing 6px above.

**Overlays (shops/deck)** — scrim `rgba(58,45,40,.45)`; sheet: panel, 3px ink border, radius 24px,
`0 8px 0 rgba(58,45,40,.25)` shadow; offers are small cards with a 34×5px family-color tick.

**Map** — dotted trail paths (`stroke-dasharray: 1 7`, round caps, `--faint`, marching-ants
animation), node tiles = panel chassis with a 36px icon chip (family-tinted bg
`color-mix(chip 30%, transparent)`, ink icon). Next-fight tile: danger border + "THREAT I/II/III".

## 5. Motion (keep subtle; honor `prefers-reduced-motion` by disabling all of these)

| Name | Use | Spec |
|---|---|---|
| bob | idle blobs/sprites | translateY 0→-5px→0, 3.2–3.8s ease-in-out ∞ |
| hit | damaged unit | ±6px x-shake with 1° tilt, 380ms |
| heal | healed unit | brightness 1.1 / saturate 1.25 pulse, 500ms |
| float | damage/heal numbers | rise 48px, pop 1.2→1 scale, fade, 1s; Baloo 800 21px, colored |
| pop | badges/menus | scale .6→1.06→1, 300ms |
| pulse | ENRAGED chip | opacity 50% @ 50%, 1.2s ∞ |
| ring | targeted unit | pulsing 6px danger ring, 1.6s ∞ |
| deal | card draw | rise+fade+scale, 300ms, 45ms/card stagger |

## 6. Icon set (inline SVG, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, round caps/joins)

```
sword    M19 5 L9 15 M6.5 12.5 L11.5 17.5 M9 15 L5 19
heart    M12 20 C7 15.5 3.5 12 3.5 8.5 C3.5 6 5.5 4 8 4 C9.6 4 11.1 4.9 12 6.2 C12.9 4.9 14.4 4 16 4 C18.5 4 20.5 6 20.5 8.5 C20.5 12 17 15.5 12 20 Z
shield   M12 3 L19 6 V11 C19 16.5 15.5 19.5 12 21 C8.5 19.5 5 16.5 5 11 V6 Z
drop     M12 3 C12 3 6.5 10 6.5 14.5 A5.5 5.5 0 0 0 17.5 14.5 C17.5 10 12 3 12 3 Z
poison   (drop with crossbar)  M12 3 C12 3 6.5 9.5 6.5 14 A5.5 5.5 0 0 0 17.5 14 C17.5 9.5 12 3 12 3 Z M9.5 14 H14.5
leaf     M5 19 C5 10 10 5 20 4 C20 14 14 19 7 19 Z M5 19 C8 15 11 12 15 9
bolt     (fill, no stroke)  M13 2 L5 13 H11 L9 22 L19 9 H13 Z
cards    M4 7 H15 V20 H4 Z M9 4 H19 V16
gem      M7 4 H17 L21 9 L12 20 L3 9 Z M3 9 H21
plus     M12 5 V19 M5 12 H19
flask    M10 3 H14 M12 3 V9 L18 17.5 C18.6 18.6 17.9 20 16.6 20 H7.4 C6.1 20 5.4 18.6 6 17.5 L12 9
question M9 8.5 C9 6.6 10.2 5.2 12 5.2 C13.9 5.2 15 6.6 15 8.2 C15 10.4 12 10.7 12 13 M12 16.6 V17.4
target   M12 5 A7 7 0 1 0 12 19 A7 7 0 1 0 12 5 Z M12 10 A2 2 0 1 0 12 14 A2 2 0 1 0 12 10 Z
coin     <circle r=8/> + <circle r=3.4/> at 12,12
grid     four 7×7 rx-2 rects at (4,4)(13,4)(4,13)(13,13)
```

Node icon mapping: cardShop=cards, partyUpgrade=sword, reliquary=gem, infirmary=plus,
sanctum=flask, event=question, fight/threat=sword, relic chip=gem, gold=coin, mana cost=drop (filled),
heal amount=heart (filled), charge=bolt (filled).

## 7. Character art (blobs)

Character visuals are pure CSS/SVG vector "blob people" — see the separate character sheet for the
three candidate styles; final art ships as SVG assets after selection. Common recipe: an organic
border-radius body (`e.g. 50% 50% 46% 54% / 60% 58% 42% 40%`) in the hero color with a 3px ink
outline, two ink oval eyes at ~26%/41%, plus ONE signature accessory (Ranger hood triangle, Tank
helmet band, Mage hat, Warlock horns, Berserker angry brows, Grave Augur third eye, Sentinel visor,
Duelist raised brow + beauty mark). Enemies: bigger blob, angled angry brows, optional fangs;
bosses wear a gold zigzag crown (`clip-path` polygon) with ink outline.

## 8. Don'ts

- No emoji, anywhere (including logs and tooltips).
- No soft/blurred drop shadows, no glassmorphism beyond the HUD's light blur.
- No pure black or pure grey; all darks are `#3a2d28`.
- No thin (1px) borders on interactive elements.
- Don't recolor semantic hues for decoration; don't introduce new hues without adding a token.
- Don't alter layout/DOM structure or game logic — restyle in place.
