// Lightweight global UI settings that don't belong in the pure run/engine model.
// The animation-speed multiplier scales every scheduled animation delay: 1 = the
// designed pace, 0.5 = "fast" (delays halved). Read at schedule time, so toggling
// it takes effect on the next animation without a re-render of the battle view.

let animSpeed = 1;

export const getAnimSpeed = (): number => animSpeed;
export const setAnimSpeed = (s: number): void => { animSpeed = s; };
// Cycle normal (1x) <-> fast (2x, i.e. half delays). Returns the new multiplier.
export const toggleAnimSpeed = (): number => {
  animSpeed = animSpeed === 1 ? 0.5 : 1;
  return animSpeed;
};
// Human label for the current speed ("1x" / "2x").
export const animSpeedLabel = (): string => (animSpeed === 1 ? '1x' : '2x');
