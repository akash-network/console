import type { CSSProperties } from "react";

export type Point3 = [x: number, y: number, z: number];

export type Box = [x: number, y: number, z: number, width: number, depth: number, height: number];

export type BoxPaths = { outline: string; side: string; front: string; top: string; edges: string };

export type CalloutAnchor<T> = { id: T; at: Point3 };

export type PlacedCallout<T> = { id: T; anchorX: number; anchorY: number; y: number };

const SCREEN_X_PER_UNIT = Math.SQRT1_2;
const SCREEN_Y_PER_FLOOR_UNIT = Math.SQRT1_2 / 2;
const SCREEN_Y_PER_HEIGHT_UNIT = Math.sqrt(3) / 2;

/** One rack unit, in the drawing's world units of about a centimetre. */
export const RACK_UNIT = 4.4;

/** Servers and switches face +y with their fronts here, a hair proud of the rack posts so their lines draw on top. */
export const FRONT = 96.02;

export const FLOOR = { x0: -30, x1: 138, y0: -24, y1: 156 };

export const CAGE_HEIGHT = 210;

export const VIEW_BOX = { x: -170, y: -206, width: 330, height: 324 };

/** The share of the view's width each callout column covers. */
export const CALLOUT_COLUMN = 0.3;

/** Callouts render about 38px tall, so anchors closer than this in view units would overlap. */
export const MIN_CALLOUT_GAP = 50;

/** Room left below the lowest callout so it stays inside the view. */
const CALLOUT_BOTTOM_MARGIN = 22;

/** Where the GPU slots and drive bays sit across a server's front. */
export const BAY_COLUMNS = Array.from({ length: 8 }, (_, index) => 8 + index * 5.5);

/** The camera looks down at 30° from a 45° azimuth, so +y faces read on the left and +x faces on the right. */
export function project([x, y, z]: Point3): [number, number] {
  return [(x - y) * SCREEN_X_PER_UNIT, (x + y) * SCREEN_Y_PER_FLOOR_UNIT - z * SCREEN_Y_PER_HEIGHT_UNIT];
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pathOf(points: Point3[], isClosed = false): string {
  const segments = points.map((point, index) => {
    const [x, y] = project(point);
    return `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`;
  });
  return segments.join("") + (isClosed ? "Z" : "");
}

/** A rectangle on a face parallel to the x–z plane, at depth `y`. */
export function faceRect(x1: number, x2: number, z1: number, z2: number, y: number): Point3[] {
  return [
    [x1, y, z1],
    [x2, y, z1],
    [x2, y, z2],
    [x1, y, z2]
  ];
}

/** The three faces the camera sees, plus the silhouette and the edges between the faces. */
export function boxPaths([x, y, z, width, depth, height]: Box): BoxPaths {
  const [x2, y2, z2] = [x + width, y + depth, z + height];
  const outline = pathOf(
    [
      [x, y, z2],
      [x2, y, z2],
      [x2, y, z],
      [x2, y2, z],
      [x, y2, z],
      [x, y2, z2]
    ],
    true
  );

  return {
    outline,
    side: pathOf(
      [
        [x2, y, z],
        [x2, y2, z],
        [x2, y2, z2],
        [x2, y, z2]
      ],
      true
    ),
    front: pathOf(faceRect(x, x2, z, z2, y2), true),
    top: pathOf(
      [
        [x, y, z2],
        [x2, y, z2],
        [x2, y2, z2],
        [x, y2, z2]
      ],
      true
    ),
    edges:
      outline +
      pathOf([
        [x, y2, z2],
        [x2, y2, z2],
        [x2, y, z2]
      ]) +
      pathOf([
        [x2, y2, z2],
        [x2, y2, z]
      ])
  };
}

/** Diagonal wire mesh across a wall, each strand clipped to end on the wall's frame. */
export function meshPath({ wall, at, from, to, bottom, top, step }: { wall: "x" | "y"; at: number; from: number; to: number; bottom: number; top: number; step: number }): string {
  const pointOnWall = (along: number, height: number): Point3 => (wall === "y" ? [along, at, height] : [at, along, height]);
  const width = to - from;
  const height = top - bottom;
  let path = "";

  for (let offset = -height + step / 2; offset < width; offset += step) {
    const start = Math.max(0, -offset);
    const end = Math.min(height, width - offset);
    if (end - start < 0.5) continue;

    path +=
      pathOf([pointOnWall(from + offset + start, bottom + start), pointOnWall(from + offset + end, bottom + end)]) +
      pathOf([pointOnWall(to - offset - start, bottom + start), pointOnWall(to - offset - end, bottom + end)]);
  }

  return path;
}

/** Where a part slides in from, as a world offset turned into screen offsets for the entry animation. */
export function slideFrom(dx: number, dy: number, dz: number, delayMs = 0): CSSProperties {
  const [x, y] = project([dx, dy, dz]);
  return { "--slide-x": `${round(x)}px`, "--slide-y": `${round(y)}px`, "--slide-delay": `${delayMs}ms` } as CSSProperties;
}

/** Keeps each callout level with its anchor where it can, pushes neighbours apart, and lifts the column if it runs off the bottom. */
export function placeCallouts<T>(anchors: CalloutAnchor<T>[]): PlacedCallout<T>[] {
  const sorted = anchors
    .map(({ id, at }) => {
      const [anchorX, anchorY] = project(at);
      return { id, anchorX, anchorY };
    })
    .sort((first, second) => first.anchorY - second.anchorY);
  const placed: PlacedCallout<T>[] = [];
  let previousY = -Infinity;

  for (const anchor of sorted) {
    previousY = Math.max(anchor.anchorY, previousY + MIN_CALLOUT_GAP);
    placed.push({ ...anchor, y: previousY });
  }

  const overflow = previousY - (VIEW_BOX.y + VIEW_BOX.height - CALLOUT_BOTTOM_MARGIN);
  return overflow > 0 ? placed.map(callout => ({ ...callout, y: callout.y - overflow })) : placed;
}

/** The x where a callout column's leader lines start, at its inner edge. */
export function calloutEdge(side: "left" | "right"): number {
  return side === "left" ? VIEW_BOX.x + VIEW_BOX.width * CALLOUT_COLUMN + 1 : VIEW_BOX.x + VIEW_BOX.width * (1 - CALLOUT_COLUMN) - 1;
}
