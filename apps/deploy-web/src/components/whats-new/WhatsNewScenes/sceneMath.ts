export const SCENE_WIDTH = 800;
export const SCENE_HEIGHT = 450;

export type Easing = (progress: number) => number;

export const EASE = {
  inOut: progress => (progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2),
  out: progress => 1 - (1 - progress) ** 3,
  ui: progress => 1 - (1 - progress) ** 4,
  back: progress => 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2
} satisfies Record<string, Easing>;

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function progressBetween(time: number, start: number, end: number) {
  if (end <= start) return time >= start ? 1 : 0;
  return clamp((time - start) / (end - start));
}

export function tween(time: number, start: number, end: number, ease: Easing = EASE.inOut) {
  return ease(progressBetween(time, start, end));
}

export function mix(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

export type Keyframe<Values extends number[]> = readonly [time: number, ...values: Values];

/** Repeating a keyframe's values holds them until the next one. */
export function keyframes<Values extends number[]>(time: number, frames: ReadonlyArray<Keyframe<Values>>, ease: Easing = EASE.inOut): Values {
  const valuesOf = (frame: Keyframe<Values>) => frame.slice(1) as Values;
  const first = frames[0];
  if (time <= first[0]) return valuesOf(first);

  for (let index = 0; index < frames.length - 1; index++) {
    const from = frames[index];
    const to = frames[index + 1];
    if (time > to[0]) continue;
    const progress = ease(progressBetween(time, from[0], to[0]));
    const toValues = valuesOf(to);
    return valuesOf(from).map((value, valueIndex) => mix(value, toValues[valueIndex], progress)) as Values;
  }

  return valuesOf(frames[frames.length - 1]);
}

export function typedText(text: string, time: number, start: number, end: number) {
  return text.slice(0, Math.round(text.length * progressBetween(time, start, end)));
}

/** Every scene opens and closes on a veil so its loop never jumps. */
export function veilOpacity(time: number, duration: number) {
  return Math.max(1 - tween(time, 0, 0.35, EASE.out), tween(time, duration - 0.35, duration));
}

export function caretOpacity(time: number) {
  return Math.floor(time * 1.9) % 2 === 0 ? 1 : 0;
}

/** Ramps in over the 80 ms before a click and releases over the 180 ms after it. */
export function pressAmount(time: number, clickAt: number) {
  const offset = time - clickAt;
  if (offset < -0.08 || offset >= 0.18) return 0;
  return offset < 0 ? 1 + offset / 0.08 : 1 - offset / 0.18;
}

export type FolderState = { base: number; sheet: (depth: number) => number; head: number };

export const SHUT_FOLDER: FolderState = { base: 0, sheet: () => 0, head: 0 };

export type FolderSpan = readonly [openAt: number, closeAt: number | null];

/** Matches the Projects page hover: 480 ms of travel, sheets staggered by 45 ms, labels in after 140 ms. */
export function folderState(time: number, spans: readonly FolderSpan[]): FolderState {
  const openness = (delay: number, duration: number) =>
    clamp(
      spans.reduce(
        (sum, [openAt, closeAt]) =>
          sum +
          tween(time, openAt + delay, openAt + delay + duration, EASE.ui) -
          (closeAt === null ? 0 : tween(time, closeAt + delay, closeAt + delay + duration, EASE.ui)),
        0
      )
    );
  const head = clamp(
    spans.reduce(
      (sum, [openAt, closeAt]) =>
        sum + tween(time, openAt + 0.14, openAt + 0.3, EASE.out) - (closeAt === null ? 0 : tween(time, closeAt, closeAt + 0.16, EASE.out)),
      0
    )
  );

  return { base: openness(0, 0.48), sheet: depth => openness(depth * 0.045, 0.48), head };
}

export function folderSlot(index: number) {
  return { x: 24 + (index % 2) * 386, y: 160 + Math.floor(index / 2) * 230 };
}
