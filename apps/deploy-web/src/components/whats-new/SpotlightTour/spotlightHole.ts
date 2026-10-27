import type { CSSProperties } from "react";

import type { Box } from "./placeCoachCard";

export type Hole = Box & { radius: number };

const GLIDE_TIME_CONSTANT_SECONDS = 0.085;
const SNAP_DISTANCE = 0.4;
const ARRIVAL_DISTANCE = 3;

export function holeAround(rect: Pick<DOMRect, "left" | "top" | "width" | "height">, padding: number, radius: number): Hole {
  return { x: rect.left - padding, y: rect.top - padding, width: rect.width + padding * 2, height: rect.height + padding * 2, radius };
}

/** Eases every edge toward the goal at a rate that does not depend on the frame rate, snapping once it is close. */
export function glideHole(current: Hole, goal: Hole, elapsedSeconds: number): Hole {
  const share = 1 - Math.exp(-elapsedSeconds / GLIDE_TIME_CONSTANT_SECONDS);
  const glide = (from: number, to: number) => (Math.abs(to - from) < SNAP_DISTANCE ? to : from + (to - from) * share);
  return {
    x: glide(current.x, goal.x),
    y: glide(current.y, goal.y),
    width: glide(current.width, goal.width),
    height: glide(current.height, goal.height),
    radius: glide(current.radius, goal.radius)
  };
}

export function isSameHole(first: Hole | null, second: Hole | null) {
  if (!first || !second) return first === second;
  return first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height && first.radius === second.radius;
}

export function hasReached(hole: Hole, goal: Hole) {
  return (
    Math.abs(hole.x - goal.x) < ARRIVAL_DISTANCE &&
    Math.abs(hole.y - goal.y) < ARRIVAL_DISTANCE &&
    Math.abs(hole.width - goal.width) < ARRIVAL_DISTANCE &&
    Math.abs(hole.height - goal.height) < ARRIVAL_DISTANCE
  );
}

export function roundToPixels(hole: Hole): Hole {
  return { x: Math.round(hole.x), y: Math.round(hole.y), width: Math.round(hole.width), height: Math.round(hole.height), radius: hole.radius };
}

/** An SVG path for the hole, drawn so an even-odd fill cuts it out of the full-screen dim. */
export function roundedRectPath({ x, y, width, height, radius }: Hole) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return `M${x + r} ${y}H${x + width - r}A${r} ${r} 0 0 1 ${x + width} ${y + r}V${y + height - r}A${r} ${r} 0 0 1 ${x + width - r} ${y + height}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + height - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** Catches clicks everywhere except through the hole, so only the highlighted control stays usable. */
export function blockersAround(hole: Hole): CSSProperties[] {
  return [
    { left: 0, top: 0, right: 0, height: Math.max(0, hole.y) },
    { left: 0, top: hole.y + hole.height, right: 0, bottom: 0 },
    { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.height },
    { left: hole.x + hole.width, top: hole.y, right: 0, height: hole.height }
  ];
}
