// Barrel (issue #84): the tunable data + shared types now live in ./data/* modules;
// this file only re-exports them so every existing `from './constants'` import site is
// unchanged. Load order is leaf-first (tuning → … → relics) to keep module init acyclic.
export * from './data/tuning';
// The name→value lookup content JSON references via {"tune": "KEY"}. Its own module
// rather than part of tuning.ts, to avoid a self-import TDZ hazard — see the header
// comment there.
export * from './data/tuning-table';
export * from './data/members';
export * from './data/enemies';
export * from './data/cards';
export * from './data/keywords';
export * from './data/run';
export * from './data/relics';
// Last, and deliberately: importing this VALIDATES ALL CONTENT and refuses to start on
// any error. Placing it at the tail means every data module above is fully initialised
// before a check can read one. Because every content-touching entry point reaches
// constants, this one line is the whole validation wiring (#100).
export * from './content';
