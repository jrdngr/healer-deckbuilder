# Issue 75 — Flagellant: the blood battery and Penance

- **Status:** 📋 Open
- **Phase:** content (roster + ability)   **Size:** M
- **Depends on:** #68 (knife-edge blood web this kit anchors)   **Blocks:** none
- **Addresses:** intake 2026-07-07 — new-content wave: a member whose HP is the party's fuel;
  Penance revised per user verdict — **no clamp, it can kill him**, the buff still applies if he
  dies, and it includes him if he lives.

## Why

Blood cards need a body willing to pay. The Flagellant is that body: high HP, low auto, and an
ability that spends his health for party-wide offense. Penance is deliberately the **one blood
effect that breaks the never-lethal clamp** — casting it at 4 HP or less kills him, a real death
(injury scars, permadeath economy, ability-card removal), and the party still gets the fury. He
holds Sanguine Pact's below-50% window open, feeds Ossuary Bell (#66), gets +2 heals from Field
Triage below half, and his HP pool bankrolls Crimson Pact / Open Veins / Transfusion (#68).

## The member

- **`flagellant`**, name "Flagellant" — `maxHP 15`, `damage 2`, salary **14**, ability
  `'penance'`. Big body, weak swing (Berserker-adjacent chassis).

## The ability — Penance (ability card)

- **Card:** cost **2**, `target 'none'`, `ability 'penance'`, type **blood** (`incite`
  precedent). Counts toward blood type counters.
- **Effect:** the Flagellant pays **4 HP — no clamp; this can kill him.** Every **living member's
  auto deals +2 this turn**, including the Flagellant if he survives; **the buff still applies if
  he dies** (resolve buff regardless of the payment's outcome).
- Sanguine Pact (#68) raises the payment to 6 (curse costs apply to blood *ability* cards too —
  document this scope decision in the constants comment).
- No playability gate on his HP — casting lethal Penance is a legal, informed sacrifice (the UI
  already shows HP; a confirm affordance is a UI nicety, not engine scope).

## Design decisions

- **Death is real:** the standard death path runs — injury accrual, `deadMemberIds`, incapacitate
  rules, and the #54 behavior (his ability card handling on member death) all apply. No special
  revival hooks; Resurrect works on him normally.
- **Martyr's Icon interaction:** the once-per-run death-save relic triggers on *member death* —
  Penance suicide is a member death, so the Icon can eat it (he survives at 1 HP). Intended;
  do not special-case.
- **Buff resolution order:** payment → death check → buff to every living member (him included if
  alive). The buff is the standard strike-bonus (1-turn) machinery, additive with Battle Hymn /
  Blood Banner / Hex's party multiplier.
- **Berserker chemistry is intended:** Penance turns +2 flat; Berserker's own low-HP scaling is
  his own HP, not the Flagellant's — no double-dip beyond the flat buff.

## Acceptance criteria

- [ ] `AbilityId 'penance'`; `flagellant` in `MEMBER_POOL`, `DRAFT_POOL`, `MEMBER_BASE_SALARY`
      (14), `MEMBER_ABILITY_FLAVOR`; ability card in `ABILITY_CARD` (cost 2, `target 'none'`) +
      `CARD_TYPE` (`blood`); excluded from shop/starter pools; unplayable while he's down.
- [ ] Payment bypasses the blood clamp: at 5+ HP he survives at HP−4; at 4 or less he **dies**,
      with the full standard death pipeline (scars, permadeath bookkeeping, party-phase removal).
- [ ] The +2 auto buff lands on every living member this turn in both outcomes (his own auto
      included only if he lives).
- [ ] Sanguine Pact raises the payment by its blood-cost rider.
- [ ] Martyr's Icon can convert the suicide to 1-HP survival (buff includes him then).
- [ ] Party→enemy surface only; telegraph property test green.
- [ ] Mechanic-coverage row (both branches: survive and die); N=1000 sim with the Flagellant
      fieldable stays in the 25–35% band — watch the **died-vs-answered split**, not just
      winrate (the Gatewarden lesson: deaths mask lethality).
- [ ] `npm test` / `npm run typecheck` clean; own `jj` commit.

## Implementation notes (anchors)

- **Member/ability plumbing:** #61 template (`MEMBER_POOL` `src/constants.ts:140-198`,
  `ABILITY_CARD` `:795-815`, `_fireAbility` `src/engine.ts:~1700-2160`; Incite's HP-cost case is
  the closest sibling — but it clamps; Penance must route around the clamp).
- **Death path:** the member-death handling around `src/engine.ts:829` (Martyr's Icon branch
  lives there) — call it, don't reimplement it.
- **Buff:** the 1-turn party strike machinery (Battle Hymn's case in `_applyCard`).

## Tests

- Penance at 15 HP → 11 HP, all autos +2 (his included).
- Penance at 4 HP → he dies (scar/permadeath bookkeeping asserted), other members still +2.
- Penance at 4 HP with Martyr's Icon unspent → survives at 1, Icon spent, buff includes him.
- With Sanguine Pact: payment is 6; below-50% window opens after the cast.
- Buff stacks with Battle Hymn in the same turn.

## Out of scope

- A generic lethal-blood mechanic for other cards (Penance is the sole exception by design).
- UI confirm dialogs (maintainer verifies UX affordances separately).
