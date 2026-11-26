/** records a drag across the whole stage moves. */
const PER_STAGE = 1.2;
/** the least travel, in records, that steps to a neighbour when the finger lifts. */
const THRESHOLD = 0.12;

const clamp = (p: number, last: number) => Math.min(last, Math.max(0, p));

/** the scrub position under a finger `dx` CSS px from where it touched down on a stage `width` wide, started at `from`. */
export const swipeScrub = (from: number, dx: number, width: number, last: number) =>
  clamp(from - (dx / width) * PER_STAGE, last);

/** the whole record a drag from `from` lands on when the finger lifts at `at`: the next one past a small pull, or further after a long one. */
export function swipeSettle(from: number, at: number, last: number) {
  const base = Math.round(from);
  const moved = at - from;

  if (Math.abs(moved) < THRESHOLD) return base;

  return clamp(moved > 0 ? Math.max(base + 1, Math.round(at)) : Math.min(base - 1, Math.round(at)), last);
}
