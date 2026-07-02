# Issue 29 — Party W3: Beast Warden + pet subsystem

- **Roadmap phase:** post-demo (party wave 3)   **Size:** M–L (most invasive member)
- **Depends on:** #28   **Blocks:** #30
- **Addresses:** review §3.4 (roster wave 3)

## Why
The Beast Warden introduces a **pet** — a unit on her slot that can't be healed and absorbs whole
hits. It's the most invasive member (a new kind of board entity), so it ships last of the five.

## Scope / acceptance criteria
- [ ] **Beast Warden** — 9 HP, 1 dmg. *Call Boar* (2 MP): summon a **Boar (7 HP + abilityPower)** on
      her slot for **4 enemy turns** (recast replaces at full; no stack).
- [ ] Boar behavior: adds **+4** to her strike (total 5); **absorbs every instance aimed at her
      slot, whole**; **unhealable**; no damage spill to the Warden.
- [ ] Boar HP 7 = exactly one base heavy — the re-summon-early-vs-heal-the-tank decision is the point.

## Implementation notes
- New pet entity in the member/board model (post-#08). It occupies a slot but is exempt from heal
  targeting and from the wipe check as a member. Emit summon/expire `GameEvent`s for animation.

## Tests (required per CLAUDE.md)
- Boar absorbs a full instance aimed at the slot; is unhealable; expires after 4 enemy turns;
  recast replaces at full HP; adds +4 to the Warden's strike.

## Out of scope / follow-ups
- Full draft UI + weight surfacing is #30.
