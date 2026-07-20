// The content entry point (#100).
//
// Importing this module VALIDATES ALL CONTENT as a side effect and refuses to start if
// anything is wrong. src/constants.ts re-exports it, so every content-touching entry
// point — main.tsx, all the tsx test suites, every sim script — is covered without
// per-entry wiring.
//
// The JSON files land here in #101–#105. Today the bundle is empty and validation is a
// no-op, so this commit cannot change behavior; the wiring exists so that the phase
// which adds cards.json is a content-only diff.
//
// STATIC JSON IMPORTS are the load mechanism (tsconfig `resolveJsonModule`): identical
// semantics under Vite and under raw tsx, synchronous, no fetch/fs split. As files
// arrive they are imported at the top of this file and added to the bundle below.
import { validateOrExit } from './validate/driver';
import type { ContentBundle } from './validate/driver';

// --- the bundle ------------------------------------------------------------
// Each loader module registers its own checks at import time, so this list is the
// whole wiring a new content file needs.
import { TUNING_COLLISIONS } from './tuning';
import { registerCheck } from './validate/driver';
import './cards'; // #101 — registers the cards.json checks
import './abilities'; // #102 — registers the abilities.json checks
import './entities'; // #103/#106 — relics.json and members.json

// A constant defined in two data modules would make {"tune": "KEY"} ambiguous.
registerCheck({
  name: 'tuning',
  run(_b, errs) {
    for (const key of TUNING_COLLISIONS) {
      errs.add({ category: 'ref', file: 'tuning', path: key,
        message: `constant ${JSON.stringify(key)} is defined in more than one data module` });
    }
  },
});

const BUNDLE: ContentBundle = {};

// --- validate, then hand the content out ------------------------------------
// This runs at import time, before any game code can read a definition.
validateOrExit(BUNDLE);

export { BUNDLE as CONTENT_BUNDLE };
export { runActions, evalAmount, evalCondition, resolveSelector, STATUS_WRITERS } from './interpreter/run';
export type { ActionCtx, NativeFn } from './interpreter/run';
export { renderTemplate, templateRefs, TEMPLATE_FILTERS } from './interpreter/template';
export { NATIVES, NATIVE_NAMES } from './natives';
export { CARD_ACTIONS, CARD_DESCS, CARD_JSON, CARD_JSON_IDS } from './cards';
export { ABILITY_ACTIONS, ABILITY_JSON_IDS } from './abilities';
export { RELIC_JSON, MEMBER_JSON, ENEMY_JSON, RELIC_JSON_IDS, MEMBER_JSON_IDS, ENEMY_JSON_IDS } from './entities';
export type { RelicJson, MemberJson } from './entities';
export type { AbilityJson } from './abilities';
export type { CardJson } from './cards';
export { validateContent, registeredChecks } from './validate/driver';
export { registerCheck };
export { CONTENT_TUNING, CONTENT_TUNING_KEYS } from './tuning';
export type { ContentBundle, ContentCheck, ValidationResult } from './validate/driver';
export { ErrorCollector, formatReport, failStartup, editDistance, nearest, suggest } from './validate/report';
export type { ContentError, ErrorCategory } from './validate/report';
export * from './schema/dsl';
