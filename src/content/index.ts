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
import './cards'; // #101 — registers the cards.json checks

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
export type { CardJson } from './cards';
export { validateContent, registerCheck, registeredChecks } from './validate/driver';
export type { ContentBundle, ContentCheck, ValidationResult } from './validate/driver';
export { ErrorCollector, formatReport, failStartup, editDistance, nearest, suggest } from './validate/report';
export type { ContentError, ErrorCategory } from './validate/report';
export * from './schema/dsl';
