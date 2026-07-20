# Issue 107 — Two inconsistencies surfaced by the characterization pass (log text and gold-return convention)

- **Status:** 📋 Planned
- **Phase:** cleanup
- **Depends:** — (independent of #100–#106, but #102 and #105 must know about these)
- **Addresses:** findings recorded while writing #99's characterization suite

## Why

Writing #99 meant reading all 67 effect arms and every run-layer outcome closely
enough to assert their exact behavior. **No genuine bugs turned up** — every surprise
was deliberate design, and is now pinned by a test. Two *inconsistencies* did, and
both are currently enshrined in the suite as-is per #99's characterize-don't-fix rule.

They need a deliberate decision, not silent drift during the migration.

## 1. The `taunt` ability logs the BASE Defense, not the value it applies

`src/engine/effects.ts:491-512`. The bundled Defense is `max(0, DEFENSE_AMOUNT +
m.abilityPower)` — scaled by the caster's ability power — but the log interpolates the
raw `DEFENSE_AMOUNT` constant:

```ts
const strength = Math.max(0, DEFENSE_AMOUNT + m.abilityPower);
m.defenseAmount = m.defense > 0 ? Math.max(m.defenseAmount, strength) : strength;
...
this._log(`${m.name} Taunts and braces (Defense ${DEFENSE_AMOUNT}) ...`);
```

So a Tank with +3 ability power braces for 4 and the log says 1. Purely cosmetic — no
mechanical consequence — but it misinforms the player exactly when the upgrade they
bought is doing its job.

Pinned by `test/content/abilities.test.ts` ("the taunt log prints the BASE Defense, not
the scaled one"). **#102 must reproduce this** unless it is fixed first; if it is
fixed, that test flips in the same commit.

**Decision needed:** print `strength` (a text-only fix, no balance impact), or keep the
constant deliberately. Recommend printing `strength`.

## 2. `cursedChest` and `gambleGold` disagree on what `gold` means

`src/run.ts:1380` vs `:1461`. Both return an object with a `gold` field:

| Method | Returns | `gold` means |
|---|---|---|
| `gambleGold()` | `{ delta, gold }` | the **resulting total** |
| `cursedChest()` | `{ gold, removed }` | the **payout** |

Two run-layer outcome methods, two opposite conventions for the same field name. No
caller is currently wrong, but it is a trap for the next one.

Pinned by `test/content/events.test.ts` ("the chest reports its payout, not the new
total"), with the discrepancy named in a comment.

**Decision needed — and #105 forces it anyway:** that issue replaces both with a shared
outcome vocabulary, which cannot hold both conventions. Pick one (recommend `delta` for
the change and `gold` for the resulting total, matching `gambleGold`) and align the
other before or during #105.

## Acceptance criteria

- [ ] The `taunt` log either prints the applied Defense strength or carries a comment
      saying the base constant is intentional; the #99 test updated to match either way.
- [ ] `cursedChest` and `gambleGold` use one convention for `gold`, with the #99 test
      and every caller updated.
- [ ] `npm test` green, `npm run typecheck` clean.

## Out of scope

- Any balance change. Both items are text/API shape only.
- The rest of the migration — this is independent of #100–#106 and can land before,
  during, or after.
