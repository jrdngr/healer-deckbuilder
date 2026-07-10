# Issue 78 — Channeling UI feedback (banner + card highlight)

- **Status:** 📋 Open
- **Phase:** ui (battle)   **Size:** S
- **Depends on:** #64 (channeled cards — engine state + events already exist)   **Blocks:** none
- **Addresses:** intake 2026-07-10 — "Channeling needs to have UI feedback. I should always know
  when I'm channeling and what the effect is."

## Why

Player-cast channels (#64) are a commit-your-whole-turn tempo primitive: while a channel runs, the
effect repeats each turn, you gain no passive MP, and **playing any card cancels it**. But there is
**no on-screen feedback** for a running channel. The engine tracks it and emits events, yet no
component reads them — the only channel UI today is the *enemy* cast-bar in `EnemyPanel`. The player
can't tell they're channeling, which card, what it's doing, how many turns are left, or that playing
a card will break it.

Maintainer decision (intake 2026-07-10): **a persistent status banner + a highlight on the
channeling card** (mirrors the enemy cast-bar style).

## What the engine already exposes (from #64)

- **State:** `Game.channelActive()` (`src/engine.ts:498`), `channelCard` / `channelTarget` /
  `channelTurns` (`src/engine.ts:292-294`), and `channelDualCadence` (#73, `src/engine.ts:298`).
- **Events:** `channelStart` / `channelPulse` / `channelCancel` / `channelEnd`
  (`src/engine.ts:237-240`), each carrying the card id (and turns-left on start/pulse).

No new engine state is required — this issue is pure UI (read-only) over what #64 already surfaces.

## Acceptance criteria

- [ ] **Channel banner.** While `game.channelActive()`, a persistent banner is shown in the battle
      screen (near the mana bar) with:
  - the channeling card's **name**,
  - a short **effect** line (derive from the card's `desc`/def — no new engine field needed),
  - **turns left** (`channelTurns`), updating each tick,
  - and the warning that **playing any card cancels the channel**.
  - If the channel is single-target (`channelTarget` set), name/indicate the bound member.
- [ ] **Channeling-card highlight.** The card in hand that is currently channeling gets a distinct
      highlight/badge (a glow + a small "channeling · N left" marker), so the source is obvious at a
      glance.
- [ ] The banner and highlight **appear on `channelStart`, update on `channelPulse`, and clear on
      `channelCancel` / `channelEnd`** — no stale banner after a channel ends or is cancelled.
- [ ] Reads engine state only; **no engine/mechanics change**, and no change to `attackTargets()` /
      the telegraph. Purely additive UI.
- [ ] `npm test`, `npm run typecheck`, `npm run build` clean; lands as a focused `jj` commit. (Tests
      here are light — the mechanic is already covered by #64; add a small guard only if a pure
      helper is extracted, e.g. the effect-line derivation.)

## Implementation notes (anchors)

- **Where the banner mounts:** `BattleScreen.tsx` renders `ManaBar` (`:251`) and `Hand` (`:252`);
  put the banner between the enemy/party area and the hand (near `ManaBar`). `game` is already in
  scope there.
- **Pattern to mirror:** the enemy cast-bar — `EnemyPanel.tsx:23-52` (`.cast-bar`, "resolves in N
  turns"). Reuse its visual language for consistency; styles live in `styles.css` (search
  `cast-bar`).
- **Card highlight:** `Hand.tsx` / `Card.tsx` — flag the card whose id === `game.channelCard`
  (and, for instance-level correctness with duplicates, the channel is tracked per card id in the
  engine; if a specific instance matters, cross-check `channelExemptUids`, `src/engine.ts:301`).
  `Card.tsx` already keys color by card type (`:40,47`); add a channeling state class alongside.
- **Effect text:** the per-tick magnitude is applied by the engine keyed by card id and is **not**
  on `CardChannelDef` (`src/constants.ts:111-115`); the simplest safe source is the card's `desc`
  (or a small formatter). Do not add engine fields just for display.
- **State access:** the hook exposes the live `game` (`src/useGame.ts`); the banner re-renders on
  the existing tick after each action, same as the mana bar.
- **Visual polish is the maintainer's** per `CLAUDE.md` — this issue wires the state through and
  provides a functional banner + highlight; the maintainer eyeballs the final look.

## Out of scope

- The **enemy** channel cast-bar (already exists, `EnemyPanel`).
- Any change to channel mechanics, magnitudes, `maxTurns`, MP suppression, or cancel rules (#64 owns
  those).
- Animating the channel tick beyond showing the updated turns-left / effect (juice is a later,
  maintainer-owned pass).
- Combat-log wording for channel events (already emitted by #64; restyling the log is separate).
