// Pure, DOM-free deploy-screen seating logic (#60). A deployment is a length-3
// array where each slot holds a roster index (which hero sits there) or null
// (empty). The one-slot-per-hero invariant — no roster index appears twice — is
// preserved by every transition here. `DeployScreen` is a thin view over this.

export type Deployment = (number | null)[];

// The source of a drag: either a seated slot or a roster (hand) entry.
export type DragSource =
  | { kind: 'slot'; index: number }   // index = slot position (0..2)
  | { kind: 'roster'; index: number }; // index = roster index of the hero

export type DeployAction =
  // Click a roster hero: toggle them in `slot` (out if already there, else in).
  | { type: 'seat'; roster: number; slot: number }
  // The ✕ on a slot: empty it.
  | { type: 'clear'; slot: number }
  // A seated hero dragged back onto the roster list: unseat them.
  | { type: 'unseat'; roster: number }
  // A roster hero dropped on a slot: they take it; anyone there is displaced
  // back to the roster (hand), and any prior seat of this hero is vacated.
  | { type: 'dropRosterToSlot'; roster: number; slot: number }
  // A seated hero dropped on another slot: swap the two slots (a drop onto an
  // empty slot is a swap with null, i.e. a move).
  | { type: 'dropSlotToSlot'; from: number; to: number };

// Vacate every slot currently holding `ri` (enforces one-slot-per-hero).
function removeRoster(d: Deployment, ri: number): Deployment {
  return d.map((x) => (x === ri ? null : x));
}

// First empty slot from the left, or 0 (Left) if the deployment is full. Used to
// seed the active slot on entering deploy.
export function firstEmptySlot(d: Deployment): number {
  const i = d.indexOf(null);
  return i === -1 ? 0 : i;
}

// Next empty slot from the left after a seat; if the deployment is full, stay on
// `fallback` (the current active slot) so the selection doesn't jump.
export function nextEmptySlot(d: Deployment, fallback: number): number {
  const i = d.indexOf(null);
  return i === -1 ? fallback : i;
}

export function reduceDeploy(d: Deployment, action: DeployAction): Deployment {
  switch (action.type) {
    case 'seat': {
      const next = removeRoster(d, action.roster);
      next[action.slot] = d[action.slot] === action.roster ? null : action.roster;
      return next;
    }
    case 'clear':
      return d.map((x, i) => (i === action.slot ? null : x));
    case 'unseat':
      return removeRoster(d, action.roster);
    case 'dropRosterToSlot': {
      const next = removeRoster(d, action.roster);
      next[action.slot] = action.roster;
      return next;
    }
    case 'dropSlotToSlot': {
      const next = [...d];
      next[action.from] = d[action.to];
      next[action.to] = d[action.from];
      return next;
    }
  }
}
