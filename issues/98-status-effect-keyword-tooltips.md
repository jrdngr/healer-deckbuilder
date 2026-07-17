# Issue 98 — Status-effect keyword tooltips (highlight in text, strip parentheticals, reword to effect-noun form)

- **Status:** 📋 Open
- **Phase:** ui + content
- **Depends:** #97 (themed tooltip component)
- **Addresses:** intake 2026-07-17 — "Add tooltips for status effects within text. When an effect (e.g. Provoke) appears in ability text it should be highlighted a separate color and carry a tooltip describing its effect, so we can remove the parenthetical gloss. Do this for every effect in the UI and remove the accompanying parenthetical text. Word things to be singular, e.g. instead of 'A member Provokes', write 'Applies Provoke to the caster'."

## Why

Card and ability text explains each status effect inline, every time, with a parenthetical
gloss: `Provokes (enemy aims at them)`, `Taunts (enemy aims at them)`, `A member Provokes
(enemy aims at them) and gains Riposte`, etc. This is verbose, repeats the same explanation
across many cards, and eats space on the fixed-size card faces locked in by #92 (11 descs
had to be shortened there — recurring glosses are exactly the fat to trim). It also means
the canonical definition of "Vulnerable" or "Regen" lives nowhere — it's re-paraphrased per
card.

Replace the inline glosses with a **keyword system**: each status-effect name in UI text is
highlighted (a distinct color) and carries a themed tooltip (from #97) with its canonical
one-line definition. The parenthetical is then deleted, and the surrounding sentence is
reworded to read cleanly in **effect-noun form**.

## Approach (maintainer decision, intake 2026-07-17)

- **Full reword to effect-noun form.** Don't just strip the parenthetical and highlight the
  existing verb — rewrite the sentence so the effect reads as an applied noun. E.g.
  `A member Provokes (enemy aims at them)` → `Applies Taunt to the caster`;
  `The target Taunts (enemy aims at them) for 2 enemy turns` → `Applies Taunt to the target
  for 2 enemy turns`; `Deal N (more if Vulnerable)` keeps Vulnerable as a highlighted keyword
  in place (already noun form).
- **Canonical keywords locked (maintainer decision, intake 2026-07-17):** the aim-redirect
  effect is **Taunt** (not "Provoke"); the enemy-takes-more-damage effect is **Vulnerable**
  (Evil Eye maps to it). Reword all display text to these. Do NOT re-ask during
  implementation. (The party-side healing-halving debuff **Hex** remains its own separate
  keyword — it is a different mechanic, unaffected by these two.)
- **Apply everywhere effect names appear**, not just card faces: card/ability descs, enemy
  intent lines, the poison/enrage readouts (`EnemyPanel.tsx`), the Hex banner (`Party.tsx`),
  the siphon pill (`ManaBar.tsx`), and the combat log where practical. Wherever a status name
  is shown to the player, it should be the highlighted, tooltip-bearing keyword.
- **Per-item approval loop** (standing maintainer preference): the canonical name, color, and
  gloss for **each** keyword, and the reworded text for **each** card, are approved with the
  maintainer item-by-item during implementation — do not batch-commit final wording unseen.
  This issue defines the framework and the starting catalog; the exact strings are ratified
  per item.

## Keyword catalog (starting map — verify each definition against the engine before writing its gloss)

Build a single registry of effect keywords (mirror the `MODIFIERS` shape at
`src/data/run.ts:380` — `{ id, name, desc }`, DOM-free, in a data/constants module so the
gloss text is unit-testable and lives in one place). Candidate keywords, with the
*mechanics* to verify (not the final gloss wording):

| Keyword | Mechanic to confirm | Anchor |
|---|---|---|
| **Taunt** (canonical; "Provoke" text rewords to it) | enemy aims its next attack at this member (Taunt bundles Defense on the Tank) | `effects.ts:358,510`, `core.ts:1631`, cards `provoke`/`bolster`/`enGarde`/`lunge` |
| Riposte | next hit that strikes them is answered with a counterattack | `effects.ts:439`, `core.ts:1904`, card `riposte`/`enGarde` |
| Defense | reduces incoming damage per hit (brace) | `effects.ts:510,671`, `phalanx`/`holdLine`/`shieldWall` |
| Guard | flat damage reduction per hit; stacks with Defense, not itself | card `guard` (`GUARD_DR`) |
| Shield | fully blocks the next attack instance | cards `shield`/`barrier`/`scarletWard` |
| Regen | heals a decaying amount at the start of each turn | cards `regen`/`lifebloom`/`bloom` |
| Poison | enemy takes N damage at the start of each of its turns | `EnemyPanel.tsx:49`, `imbuePoison`/`concVenom`/`sporeburst`/`hemorrhage` |
| **Vulnerable** (canonical; "Evil Eye" text rewords to it) | enemy takes increased damage | `core.ts:1512`, card `hex` (Evil Eye), `drainLife`/`doom`/`sap` |
| Hex (party debuff) | halves all party healing until it fades; Cleanse removes it — a SEPARATE mechanic from Vulnerable | `Party.tsx:22` |
| Charge | the Mage banks Charge; Lightning Bolt spends it | `members.ts:171`, `effects.ts:520,677` |
| Grudge | the Tank banks Grudge from soaked damage | `members.ts` (tank passive), `effects.ts:671` |
| Stun | cancels the enemy's telegraphed action | `effects.ts:588`, card `stagger` |
| Doom | delayed curse; detonates for damage after N enemy turns | card `doom` |
| Enraged / Enrage | enemy's attacks hit harder for the rest of the fight | `EnemyPanel.tsx:34,36` |
| Siphon | enemy drains MP | `ManaBar.tsx:22`, `core.ts:212` |

**Two naming collisions — RESOLVED (maintainer decision, intake 2026-07-17). Do not re-ask:**

1. **Provoke vs Taunt → canonical keyword is `Taunt`.** The aim-redirect mechanic is called
   both "Provoke" (En Garde, Lunge) and "Taunt" (the `provoke` card, `bolster`, engine
   `taunt` state) in existing text. All highlighted-keyword display text uses **Taunt**;
   reword "Provokes"/"Provoke" phrasing in descs/log/intent accordingly. The card named
   *Provoke* keeps its name (card names are out of scope). The engine's internal `taunt`
   field is not renamed — display text only.
2. **Evil Eye vs Vulnerable → canonical keyword is `Vulnerable`.** The enemy-takes-more-damage
   effect displays as **Vulnerable** everywhere, including the Warlock's `hex` card (named
   "Evil Eye" — keep the card name, but its desc's highlighted keyword is Vulnerable) and the
   `core.ts:1512` fade log. The party-side **Hex** (halves party healing) is a **separate**
   keyword and mechanic, unaffected by this — it keeps its own entry and gloss.

## Acceptance criteria

- [ ] A single effect-keyword registry exists (DOM-free, e.g. in `constants.ts`/`src/data/`),
      each entry `{ id, name, desc }`, holding the canonical one-line gloss for each keyword
      in the catalog above (final names/glosses per maintainer approval).
- [ ] A text-rendering helper highlights each keyword occurrence in a string and wires it to a
      #97 themed tooltip showing that keyword's gloss. Highlighting is a distinct color
      (class-based, in `styles.css`); the tooltip content comes from the registry.
- [ ] Every **parenthetical gloss** in card/ability descs is removed (grep `(` in
      `src/data/cards.ts` descs: `provoke`, `bolster`, `enGarde`, `lunge`, `hex`, plus any
      others). The information now lives only in the keyword tooltip.
- [ ] Card/ability descs are reworded to **effect-noun form** where a gloss was removed
      (e.g. `A member Provokes (enemy aims at them)` → `Applies <Keyword> to the caster`),
      each rewording approved per-item.
- [ ] The keyword treatment is applied **everywhere effect names appear**: card faces, ability
      text, enemy intent lines, poison/enrage readouts (`EnemyPanel.tsx`), Hex banner
      (`Party.tsx`), siphon pill (`ManaBar.tsx`). Combat-log highlighting is desirable where
      it doesn't fight the log's existing `'status'` styling — include it if clean, note it if
      deferred.
- [ ] No card face overflows its fixed #92 size after the reword (removing glosses should only
      free space, but verify — some rewrites add "Applies … to the …").
- [ ] Keyword matching does not mis-highlight substrings (e.g. don't highlight "Charge" inside
      an unrelated word, don't double-highlight a keyword already inside another). Matching is
      whole-word and case-aware.
- [ ] The engine stays pure/DOM-free — the registry and any pure text-tokenizer are DOM-free
      and unit-tested; the React rendering wrapper lives in `src/components/`.
- [ ] `npm test` green, `npm run typecheck` clean.

## Implementation notes (anchors)

- **Registry pattern:** copy the `MODIFIERS` map shape (`src/data/run.ts:380`). Keep it
  data-only so tests can assert every catalog keyword has a gloss and every keyword used in a
  card desc exists in the registry (exhaustiveness, like `CARD_TYPE`).
- **Tokenizer:** a pure function `string -> Array<{text} | {keyword}>` that a React component
  maps over, wrapping keyword segments in a `<Tooltip>` (from #97) + highlight span. Put the
  tokenizer in a DOM-free module and unit-test it directly.
- **Where card text renders:** `Card.tsx:121` (`<div className="cdesc">{card.desc}</div>`) —
  swap the raw string for the tokenized render. `channelView.ts:channelEffectLine` derives the
  banner effect line from `desc` via regex; confirm the reworded descs still satisfy its
  `^Channel:` / trailing-sentence strip (adjust if a reword breaks it).
- **Enemy intent / readouts:** `EnemyPanel.tsx:34,36,46,48,49`, `ManaBar.tsx:22`,
  `Party.tsx:22` — these currently pass plain strings to native `title` (now #97 tooltips) and
  render plain label text; highlight the keyword in the visible label.
- **Descs carrying parentheticals to reword** (from `cards.ts`): `provoke` (`:139`), `bolster`
  (`:30`), `enGarde` (`:49`), `lunge` (`:92`), `hex` (`:34`). Also scan every desc for bare
  effect names to highlight even where there's no parenthetical (`drainLife` "if Vulnerable",
  `regen`, `guard`, etc.).
- Anchors are a starting map — verify each mechanic in the engine before writing its gloss so
  the canonical definition is correct, not a paraphrase of one card.

## Tests

- Add to `test/engine.test.ts` (or `test/keywords.test.ts`, run via `tsx`):
  - Every keyword in the registry has a non-empty `name` and `desc`.
  - Every effect keyword referenced by a card desc resolves to a registry entry
    (exhaustiveness — no highlighted keyword without a gloss).
  - The tokenizer highlights whole-word keyword occurrences and leaves non-keyword text
    intact; does not mis-highlight substrings.
  - No card desc contains a parenthetical effect gloss anymore (assert the descs that were
    reworded no longer match `/\((enemy aims|aims at)/i` etc.).
- Visual/color confirmation is **maintainer-verified manually** — do not drive a browser.
- Known-brittle: log-substring probes are brittle (see the naming-pass memory); assert on the
  registry and tokenizer, not on rendered log strings.

## Out of scope

- Building the tooltip component or the 250ms delay — that's #97 (this depends on it).
- Renaming the engine's internal `taunt`/`hex` state fields — this is display text only.
- Changing any card's *mechanics* or balance. Text/presentation only; the reword must not
  alter what a card does.
- Renaming cards (the card named "Provoke" keeps its name even if the keyword canonicalizes to
  "Taunt", and vice-versa).
- Localization / i18n of the glosses.
