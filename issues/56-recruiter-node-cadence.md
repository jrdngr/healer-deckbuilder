# Issue 56 — Recruiter cadence: drop post-boss recruit, guarantee a recruiter each cycle

- **Phase:** structure (map/nodes)   **Size:** M
- **Depends on:** —   **Blocks:** #58 (settles the node/branch machinery the Infirmary node slots into)
- **Addresses:** intake 2026-07-06 — "Remove party member recruitment after bosses. Leave it to the
  recruiter node and always offer a path with a recruiter node at the beginning of each fight cycle.
  … offered a recruiter node after the first fight and then again after each boss."

## Why

Recruitment currently happens in two places: a **post-boss draft** (auto-offered after an act
boss's spoils) and the random **recruiter map node**. Consolidate to one channel — the recruiter
node — and make its availability *guaranteed* at the start of each fight cycle: a fork containing a
recruiter node is always offered **after the first fight** and **after each boss**. This makes the
"who joins" beat predictable and removes the redundant post-boss draft.

## Acceptance criteria

- [ ] The post-boss party-member draft is **removed** (act bosses no longer auto-offer a new hero
      after spoils).
- [ ] After fight 1, and after each act boss, the player is guaranteed a branch whose path contains
      a **recruiter node** (Reliquary-style forced injection), provided the roster isn't full.
- [ ] Recruiter nodes elsewhere still roll normally; a full roster still hides recruiter offers.
- [ ] Recruit offers still draw from `availableMembers()` (graveyard exclusions from #40 respected).
- [ ] No dangling `post: 'boss'` draft state anywhere (win flow, `upcomingFightIndex`, DraftScreen).
- [ ] Tests pass; typecheck/build clean.

## Implementation notes (anchors)

- **Remove post-boss draft:** `src/run.ts:495-509` `_leaveSpoils()` (sets `location = {kind:'draft',
  post:'boss', …}` — delete that branch so spoils flow straight on); `src/run.ts:471-493` `winFight()`
  boss→spoils routing (`:486-489`); `src/components/DraftScreen.tsx:40-44` (`post === 'boss'` copy);
  `src/run.ts:383` `upcomingFightIndex` `post === 'boss'` handling.
- **Guarantee recruiter forks:** `src/run.ts:322-349` `_generateMap()` — the `:334-347` "guaranteed
  act-1 Recruit (#41)" block is the template (mirror it to force a recruiter node into the forks that
  begin each cycle: post-fight-1 and post-boss). Reliquary injection at `:328-333` is the same shape.
- Node plumbing: `NODE_TYPE_WEIGHTS` `src/constants.ts:1148-1151` (`['recruit', 20]`),
  `nodeAvailable('recruit')` `src/run.ts:584-587` (roster-full hide), `recruitMember` `:591-597`,
  content roll `_rollMemberOffer(availableMembers(), RECRUIT_OFFER_SIZE)` `:634`, `RECRUIT_OFFER_SIZE`
  `src/constants.ts:183`; UI `src/components/RecruitScreen.tsx:14-43`.

## Tests

- `test/run.test.ts`: winning an act boss no longer produces a `post:'boss'` draft; the forks after
  fight 1 and after each boss contain a recruiter node when the roster has room; a full roster
  suppresses it; recruit offers exclude graveyard members.

## Out of scope

- Redesigning recruiter *offer contents* or salaries (#42 territory).
