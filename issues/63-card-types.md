# Issue 63 — Card types (Holy / Nature / Shadow / Blood / Arcane / Iron)

- **Status:** 📋 Open
- **Phase:** systems (cards)   **Size:** XL
- **Depends on:** —   **Blocks:** future type-synergy content (relics, cards, events)
- **Addresses:** intake 2026-07-07 — "Add types to cards; go back and type every existing card;
  use the system for synergies and starter decks. Example types: Holy (one-shot heals + resurrect),
  Nature (regen/refresh/buffs), Shadow (enemy debuffs + direct damage), Blood (sacrifice for gain).
  Suggest others."

## Why

Cards today are an untyped flat list. Adding a **single primary type** to every card gives the game a
readable identity axis to build on: synergy relics and cards can key off type, and run-start **starter
decks** can be themed presets instead of one fixed heal-heavy list. This issue lays the taxonomy *and*
ships a first, deliberately-small layer of synergy + starter content on top of it.

## Design decisions (intake interview 2026-07-07)

- **Six types**, each card carries **exactly one** primary type (a required field — the typechecker
  forces every card to be tagged). The four requested plus two to house the current cards that aren't
  heals/regen/debuff/sacrifice:
  - **Holy** — one-shot heals, resurrect, purify. *(the current starter core)*
  - **Nature** — regen family, and buffs generally (incl. combat buffs like Battle Hymn / Rally).
  - **Shadow** — enemy debuffs and direct damage to the enemy.
  - **Blood** — sacrifice something (usually HP) to gain something.
  - **Arcane** — the mana / card-draw economy (Refresh, Font of Mana, Inspiration, Surge, Channel).
  - **Iron** — protection: shields, Defense, Taunt/Provoke, braces.
- Each type is a **theme, not a rulebook** — a few outliers per type are wanted (see the mapping).
- **Scope is "everything in one issue"**: taxonomy + tag all cards + a small synergy layer (a couple
  relics *and* a couple count-based payoff cards — "not too many of either") + themed preset starter
  decks the player picks at run start. (May land as multiple `jj` commits; see acceptance.)

## Part A — the taxonomy

- New `CardType = 'holy' | 'nature' | 'shadow' | 'blood' | 'arcane' | 'iron'` beside `CardTarget`.
- `CardDef.type: CardType` — **required**, so every card in `CARDS` must declare one (typecheck-enforced,
  no runtime "untyped" fallback).
- Helper `cardsOfType(type)` / `cardType(id)` in `constants.ts`; a per-type grouping for pool building.

### The full mapping (every existing card)

| Type | Cards |
|------|-------|
| **Holy** | `lowHeal`, `highHeal`, `aoeHeal`, `resurrect`, `cleanse` (purify), `focus` |
| **Nature** | `regen`, `overgrowth`, `cultivate`, `bloom`, `lifebloom`, `battleHymn` *(outlier: offense buff)*, `rally` *(outlier: offense buff)*, `beckon` *(outlier: summon)*, `imbuePoison` *(outlier: venom/toxin DoT)* |
| **Shadow** | `unleash`, `hex`, `hush`, + the new Shadow cards in **Part A′** below |
| **Blood** | `bloodTithe`, `martyrsGift`, `grimHarvest`, `incite` *(outlier: HP-cost doubled strike)* |
| **Arcane** | `refresh`, `fontOfMana`, `inspiration`, `surge`, `channel`, `conduct` |
| **Iron** | `shield`, `barrier`, `phalanx`, `brace`, `provoke`, `holdTheLine`, `bolster` |

- **Per-member ability cards are typed too** (`imbuePoison`→Nature, `bolster`→Iron, `unleash`→Shadow,
  `hex`→Shadow, `conduct`→Arcane, `incite`→Blood, `hush`→Shadow, `beckon`→Nature). They stay excluded
  from the shop/starter pools (`isAbilityCard`), but their type **counts for in-fight synergies** so the
  Warlock's Hex reads as a Shadow play. This is intended, not incidental.
- **Shadow gets shoppable cards in this issue** — see **Part A′** below. Without them Shadow would live
  only on member ability cards; the intake explicitly wants healer-castable Shadow cards.

## Part A′ — new Shadow cards (shoppable)

Three healer-castable Shadow cards so the type has a shop/starter presence beyond member ability
cards. Costs and magnitudes are tunable constants (a later balance pass owns numbers).

1. **Shadow Bolt** — cheap direct damage to the enemy (`target 'none'`). The type's entry-level nuke
   and its natural starter-deck anchor. Reuses `_damageEnemy`.
2. **Siphon Life** — deal direct damage to the enemy **and** heal a chosen member for part of it
   (lifesteal). `target 'single'` (the heal target). Damage and heal each route through their normal
   pipelines — Vulnerability applies to the damage, Field Triage etc. to the heal.
3. **Doom** (rare) — a large nuke whose damage **scales with how debuffed the enemy is** (base + per
   point of Vulnerability / per active enemy debuff), capped. Rewards a debuff-first Shadow line; flagged
   **rare** in the shop/reward pool.

- A **channeled** Shadow card, **Drain**, is specified separately in **#64 (channeled cards)** — it also
  reads as a shoppable Shadow card once both land.
- Doom's build-around Vulnerability comes from the Warlock's **Hex** (member) and **Sap** (a channeled
  card in #64); this issue does **not** add a standalone Curse card (deferred — it wasn't picked in the
  intake interview).
- **Telegraph invariant:** all three deal party→enemy damage and don't touch enemy telegraphs — no
  `attackTargets()` change.

## Part B — synergies (small, tunable)

Keep both kinds few; magnitudes are tunable constants a later balance pass owns.

- **~3 synergy relics** that read card type on play. Suggested set (trim/rename in review):
  - **Holy** relic — Holy cards heal +1.
  - **Shadow** relic — after you play a Shadow card, deal +1 to the enemy.
  - **Iron** relic — the first Iron card each turn costs 1 less (min 0).
- **~2 count-based payoff cards** whose effect scales with type play/composition:
  - an **Arcane** card that costs 1 less per Arcane card already played this turn (floor 0);
  - a **Shadow** card that deals damage scaling with Shadow cards played this fight (capped).
- The engine tracks **per-type cards-played counters** (per-turn and per-fight) reset at the right
  boundaries, so both relics and count cards read the same source.
- **Telegraph invariant:** any synergy that touches an *enemy* attack's damage must keep
  `attackTargets()` preview == applied (the property test). The suggested synergies only add
  *party→enemy* damage / party heals / card cost, which don't touch the enemy telegraph — but if a
  chosen relic modifies incoming damage, it must respect the invariant.

## Part C — themed preset starter decks

- Player picks **one preset starter deck at run start** (replaces the single hardcoded `defaultDeck()`).
- Each preset is ~6–8 cards weighted toward its 1–2 types. Suggested three (names/lists tunable):
  - **Preserver** (Holy/Nature) — the current heal-lean list, roughly today's default.
  - **Reaper** (Shadow/Blood) — damage + sacrifice tempo.
  - **Warden** (Iron/Arcane) — protection + economy.
- Presets draw only from **shoppable, non-ability** cards; ability cards are still injected per-deploy.
- **Save/quick-play:** the sim and quick-play must keep working with a default preset (Preserver) so
  no caller is forced through a picker; the picker is the interactive-run path only.

## Acceptance criteria

- [ ] `CardType` defined; `CardDef.type` **required**; **every** card in `CARDS` (incl. all 8 ability
      cards) carries a type per the mapping table. Missing a type is a compile error, not a runtime one.
- [ ] `cardsOfType` / `cardType` helpers exist and back the pool/starter/synergy code (single source).
- [ ] The 3 new **Shadow** cards (Shadow Bolt, Siphon Life, Doom) are defined with tunable costs/
      magnitudes and are shop/reward-eligible; **Doom** flagged rare. Siphon Life damages through the
      enemy-damage pipeline (Vulnerability applies) and heals through the heal pipeline; Doom's damage
      scales with the enemy's Vulnerability/debuffs and is capped. None perturb an enemy telegraph.
- [ ] The ~3 synergy relics work off the per-type counters and are shop/reward-eligible with tunable
      magnitudes; each has a test. The Shadow damage relic does **not** perturb any enemy telegraph.
- [ ] The ~2 count-based cards scale correctly with the per-type counters, are capped/floored as
      designed, and reset their counters at the correct fight/turn boundary; each has a test.
- [ ] Per-type play counters reset at the right boundaries (per-turn counter each turn; per-fight
      counter each fight) — a test proves counts don't bleed across turns/fights.
- [ ] Run start offers **3 themed preset starter decks**; choosing one builds that deck. Quick-play and
      the sim default to **Preserver** without a picker. Chosen preset persists across save/resume;
      `RUN_SAVE_VERSION` bumped (13 → 14) with the field defaulting to Preserver on older saves.
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean. Lands as focused `jj` commits — suggest:
      (1) taxonomy + tag every card + helpers; (2) per-type counters + synergy relics; (3) count-based
      cards; (4) preset starter decks + picker + save bump.

## Implementation notes (anchors)

- **Type + field:** `CardTarget` at `src/constants.ts:10`; `CardDef` at `:51-88`; the `CARDS` table at
  `:684-769` (add `type:` to each entry). `CardId` union `:22-35`.
- **Ability cards / pools:** `isAbilityCard` + `CARD_POOL` filter `src/constants.ts:1312-1313`;
  `ABILITY_CARD` map `:786-795`. Type ability cards but leave them out of shoppable pools.
- **Per-type counters:** add to the engine's play path — `playCard` (`src/engine.ts:1371+`); reset with
  the existing per-turn / per-fight reset sites. Mirror the `drumPrimed`/one-shot-flag bookkeeping style.
- **Relics:** `RelicId` union `src/constants.ts:1501-1524`; `RELICS` table `:1577-1622`; magnitude
  consts `:1535-1575`; `hasRelic` reads `src/engine.ts:372`. Hook the card-play relics where `playCard`
  resolves an effect; keep the telegraph==applied property test green (`attackTargets()`).
- **Count-based cards:** new `CardId`s in the union + `CARDS`; effect reads the per-type counters in the
  card resolver / `canPlay` cost path (mirror `surge`'s next-card-cost hook at `:738`).
- **Starter decks:** `DECK_LIST` / `defaultDeck()` at `src/constants.ts:778-782`, `:1000-1002`; new
  `STARTER_DECKS: Record<StarterDeckId, { name; desc; types; list: CardId[] }>`. Run constructor uses
  the chosen preset (`src/run.ts:152`, `Run` fields `:117-170`); add the field to `RunSnapshot`/`toJSON`
  (`:186+`) and the loader migration (`:240+`), bump `RUN_SAVE_VERSION` (`src/run.ts:93`, 13→14).
- **Picker screen:** run-start routing seam in `src/App.tsx` / `src/main.tsx`; a new small component in
  `src/components/`. Follow the deploy/draft screen pattern.

## Tests (`test/engine.test.ts` + sibling as needed)

- A card→type coverage assertion (every `CardId` maps to a `CardType`; the mapping table matches).
- `cardsOfType` returns the expected members per type.
- Per-type counters: increment on the matching play, reset per turn and per fight, no cross-bleed.
- Each synergy relic: on/off changes exactly its effect by its magnitude; the Shadow damage relic keeps
  `attackTargets()` == applied on the enemy telegraph.
- Each count-based card: effect scales with the counter and respects its cap/floor.
- Shadow cards: Shadow Bolt deals its damage (and it obeys Vulnerability); Siphon Life both damages the
  enemy and heals its target by the designed split; Doom's damage rises with enemy Vulnerability/debuffs
  and stops at its cap; none change `attackTargets()`.
- Starter presets: each preset builds the declared card list; default path (no picker) yields Preserver;
  round-trips through save/resume and an old (v13) save loads as Preserver.

## Out of scope

- A large synergy set — this is a first, small layer; more type payoffs are follow-up issues.
- Multi-type cards (primary + secondary) — one type per card for now; revisit if synergies need it.
- Deep starter-deck balancing / a fourth+ preset (tunable lists; a later balance pass owns numbers).
- Heavy card-face visuals for types (a type badge/color on the Card component is welcome but the
  maintainer verifies visuals per `CLAUDE.md`).
