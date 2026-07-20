# Issue 107 — Two inconsistencies surfaced by the characterization pass (log text and gold-return convention)

- **Status:** 📋 Planned
- **Phase:** cleanup
- **Depends:** — (independent of #103; both items are text/API shape only)
- **Addresses:** findings recorded while writing #99's characterization suite

> **Anchors re-verified 2026-07-20 after the content migration.** The original write-up
> pointed at `src/engine/effects.ts:491-512`, which **no longer exists** — #102 deleted
> the `_fireAbility` switch and the Taunt arm moved to `src/content/natives.ts`. Anyone
> following the old citation would have searched a file whose switch is gone.

## Why

Writing #99 meant reading all 67 effect arms and every run-layer outcome closely enough
to assert their exact behavior. **No genuine bugs turned up** — every surprise was
deliberate design, and is now pinned by a test. Two *inconsistencies* did, and both are
currently enshrined in the suite as-is per #99's characterize-don't-fix rule.

They need a deliberate decision, not silent drift.

## 1. The Taunt ability logs the BASE Defense, not the value it applies

**Now at `src/content/natives.ts` → `NATIVES.tauntApply`** (moved from `effects.ts` by
#102; it is one of the only two natives in the codebase).

The bundled Defense is `Math.max(0, DEFENSE_AMOUNT + m.abilityPower)` — scaled by the
caster's ability power — but the log interpolates the raw constant:

```ts
const strength = Math.max(0, DEFENSE_AMOUNT + m.abilityPower);
m.defenseAmount = m.defense > 0 ? Math.max(m.defenseAmount, strength) : strength;
…
game._log(`${m.name} Taunts and braces (Defense ${DEFENSE_AMOUNT}) …`);
```

So a Tank with +3 ability power braces for 4 and the log says 1. Purely cosmetic — no
mechanical consequence — but it misinforms the player exactly when the upgrade they
bought is doing its job.

**Pinned by:** `test/content/abilities.test.ts`, the case named *"the taunt log prints
the BASE Defense, not the scaled one"*. That test flips in the same commit as the fix.

**Fix:** print `strength`. One character of real change. Recommended — there is no
argument for the current behavior beyond "that is what it does today".

## 2. `cursedChest` and `gambleGold` disagree on what `gold` means

`src/run.ts` → `gambleGold()` (~`:1383`) and `cursedChest()` (~`:1464`).

| Method | Returns | `gold` means |
|---|---|---|
| `gambleGold()` | `{ delta, gold }` | the **resulting total** |
| `cursedChest()` | `{ gold, removed }` | the **payout** |

Two run-layer outcome methods, two opposite conventions for the same field name. No
caller is currently wrong, but it is a trap for the next one.

**Pinned by:** `test/content/events.test.ts`, *"the chest reports its payout, not the
new total"*, with the discrepancy named in a comment.

**Fix:** adopt `gambleGold`'s convention — `delta` for the change, `gold` for the
resulting total — and update `cursedChest` plus its callers. Note that **#105 did NOT
force this**: event *outcomes* are still `Run` methods dispatched on `choice.kind`, so
there is no shared outcome-op signature yet. If #103's run-layer hook set is ever built
(see #103), that is when the two must converge, and doing it first would make that work
smaller.

## Acceptance criteria

- [ ] `NATIVES.tauntApply` logs the applied Defense strength, or carries a comment
      stating the base constant is intentional; the #99 ability test updated to match.
- [ ] `cursedChest` and `gambleGold` share one convention for `gold`, with the #99 event
      test and every caller updated.
- [ ] `npm test` green, `npm run typecheck` clean, `tsx sim/trace.ts 30` diff empty
      except for the intended Taunt log line.

## Out of scope

- Any balance change. Both items are text/API shape only.
- The rest of the migration — this is independent of #103 and can land before, during
  or after it.
