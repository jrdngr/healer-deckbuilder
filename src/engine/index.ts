// Barrel for the battle engine. core.ts holds the Game class; effects.ts augments
// its prototype with the card/ability effect methods. Order matters: core (defines
// Game) is evaluated before effects (augments it).
export * from './core';
import './effects';
