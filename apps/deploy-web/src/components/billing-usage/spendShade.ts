/** The last of a ranking keeps this much of the foreground, so even the lightest shade stands out from the empty track. */
const MIN_SHADE_PERCENT = 25;

/** Shades of the foreground from the darkest for the first of a ranking to the lightest for its last. */
export function spendShade(index: number, count: number): string {
  const fade = count > 1 ? (index / (count - 1)) * (100 - MIN_SHADE_PERCENT) : 0;

  return `color-mix(in oklab, hsl(var(--foreground)) ${Math.round(100 - fade)}%, hsl(var(--muted)))`;
}
