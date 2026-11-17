import type { CSSProperties } from "react";

export type Point3 = [x: number, y: number, z: number];

export type Point2 = [x: number, y: number];

export type Box = [x: number, y: number, z: number, width: number, depth: number, height: number];

/** A footprint on the floor, in the drawing's world units of one centimetre. */
export type Plan = { x: number; y: number; width: number; depth: number };

export type BoxPaths = { outline: string; side: string; front: string; top: string; crease: string };

export type CylinderPaths = { body: string; top: string };

/** One rack unit, 1.75 in. */
export const RACK_UNIT = 4.445;

export const RACK_UNITS = 42;

/** A 600 × 1070 mm cabinet. */
export const RACK: Plan = { x: 60, y: 10, width: 60, depth: 107 };

export const RACK_DOOR = RACK.y + RACK.depth;

/** The plinth's top, where the first rack unit starts. */
export const RAILS_BOTTOM = 12;

export const RAILS_TOP = RAILS_BOTTOM + RACK_UNITS * RACK_UNIT;

export const ROOF_TOP = RAILS_TOP + 7;

/** A chassis on its rails, which leaves a 7 cm channel on the open side for the power strips. */
export const CHASSIS: Plan = { x: 64, y: 22, width: 46, depth: 91 };

/** Every front panel faces +y on this plane. */
export const FRONT = CHASSIS.y + CHASSIS.depth;

/** Three by three raised-floor tiles of 60 cm. */
export const FLOOR: Plan = { x: 0, y: 0, width: 180, depth: 180 };

export const FLOOR_PEDESTAL_BOTTOM = -16;

export const UPS: Plan = { x: 128, y: 64, width: 30, depth: 44 };

export const UPS_HEIGHT = 62;

/** The wall calendar's backing board, flat on the wall over the floor's x = 0 edge. */
export const CALENDAR = { y0: 94, y1: 132, z0: 92, z1: 144 };

export const VIEW = { width: 230, height: 280 };

const VIEW_PADDING = 3;

/** The camera looks down at 30° from a 45° azimuth, so +y faces read on the left and +x faces on the right. */
const SCREEN_X_PER_UNIT = Math.SQRT1_2;
const SCREEN_Y_PER_FLOOR_UNIT = Math.SQRT1_2 / 2;
const SCREEN_Y_PER_HEIGHT_UNIT = Math.sqrt(3) / 2;

function projectUnscaled([x, y, z]: Point3): Point2 {
  return [(x - y) * SCREEN_X_PER_UNIT, (x + y) * SCREEN_Y_PER_FLOOR_UNIT - z * SCREEN_Y_PER_HEIGHT_UNIT];
}

function cornersOf({ x, y, width, depth }: Plan, bottom: number, top: number): Point3[] {
  return [x, x + width].flatMap(cornerX => [y, y + depth].flatMap(cornerY => [bottom, top].map((z): Point3 => [cornerX, cornerY, z])));
}

/** Scales and centres everything the room can hold, so the drawing keeps one size while its parts arrive. */
const PROJECTION = (() => {
  const calendarWall: Plan = { x: 0, y: CALENDAR.y0, width: 16, depth: CALENDAR.y1 - CALENDAR.y0 };
  const extent = [
    ...cornersOf(FLOOR, FLOOR_PEDESTAL_BOTTOM, 0),
    ...cornersOf(RACK, 0, ROOF_TOP),
    ...cornersOf(UPS, 0, UPS_HEIGHT),
    ...cornersOf(calendarWall, CALENDAR.z0, CALENDAR.z1 + 8)
  ].map(projectUnscaled);
  const xs = extent.map(([x]) => x);
  const ys = extent.map(([, y]) => y);
  const [left, right, up, down] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((VIEW.width - VIEW_PADDING * 2) / (right - left), (VIEW.height - VIEW_PADDING * 2) / (down - up));

  return { scale, originX: VIEW.width / 2 - ((left + right) / 2) * scale, originY: VIEW.height / 2 - ((up + down) / 2) * scale };
})();

export function project(point: Point3): Point2 {
  const [x, y] = projectUnscaled(point);
  return [PROJECTION.originX + x * PROJECTION.scale, PROJECTION.originY + y * PROJECTION.scale];
}

/** How far a world offset moves a point on screen. */
export function projectOffset(dx: number, dy: number, dz: number): Point2 {
  const [x, y] = projectUnscaled([dx, dy, dz]);
  return [x * PROJECTION.scale, y * PROJECTION.scale];
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

/** A rectangle on a face that looks along +y, at depth `y`. */
export function faceRect(x1: number, x2: number, z1: number, z2: number, y: number): Point3[] {
  return [
    [x1, y, z1],
    [x2, y, z1],
    [x2, y, z2],
    [x1, y, z2]
  ];
}

/** A rectangle on a face that looks along +x, at `x`. */
export function sideRect(y1: number, y2: number, z1: number, z2: number, x: number): Point3[] {
  return [
    [x, y1, z1],
    [x, y2, z1],
    [x, y2, z2],
    [x, y1, z2]
  ];
}

export function topRect({ x, y, width, depth }: Plan, z: number): Point3[] {
  return [
    [x, y, z],
    [x + width, y, z],
    [x + width, y + depth, z],
    [x, y + depth, z]
  ];
}

const CORNER_ARC_STEPS = 4;

/** A rectangle with rounded corners, lying flat at height `z`. */
export function roundedTopRect({ x, y, width, depth }: Plan, radius: number, z: number): Point3[] {
  const corners: [centerX: number, centerY: number, startDegrees: number][] = [
    [x + width - radius, y + radius, -90],
    [x + width - radius, y + depth - radius, 0],
    [x + radius, y + depth - radius, 90],
    [x + radius, y + radius, 180]
  ];

  return corners.flatMap(([centerX, centerY, startDegrees]) =>
    Array.from({ length: CORNER_ARC_STEPS + 1 }, (_, step): Point3 => {
      const angle = ((startDegrees + (90 * step) / CORNER_ARC_STEPS) * Math.PI) / 180;
      return [centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle), z];
    })
  );
}

export function boxOf({ x, y, width, depth }: Plan, z: number, height: number): Box {
  return [x, y, z, width, depth, height];
}

export function insetPlan({ x, y, width, depth }: Plan, by: number): Plan {
  return { x: x + by, y: y + by, width: width - by * 2, depth: depth - by * 2 };
}

/** Far corners come first, so shapes standing on nearer ones paint over them. */
export function planCorners({ x, y, width, depth }: Plan, inset: number): Point2[] {
  const corners: Point2[] = [
    [x + inset, y + inset],
    [x + width - inset, y + inset],
    [x + inset, y + depth - inset],
    [x + width - inset, y + depth - inset]
  ];

  return corners.sort((first, second) => first[0] + first[1] - (second[0] + second[1]));
}

/** A line around the two faces the camera sees, at height `z`. */
export function seamPath({ x, y, width, depth }: Plan, z: number): string {
  return pathOf([
    [x, y + depth, z],
    [x + width, y + depth, z],
    [x + width, y, z]
  ]);
}

/** The silhouette, the three faces the camera sees, and the crease where the top meets the two sides. */
export function boxPaths([x, y, z, width, depth, height]: Box): BoxPaths {
  const [x2, y2, z2] = [x + width, y + depth, z + height];

  return {
    outline: pathOf(
      [
        [x, y, z2],
        [x2, y, z2],
        [x2, y, z],
        [x2, y2, z],
        [x, y2, z],
        [x, y2, z2]
      ],
      true
    ),
    side: pathOf(sideRect(y, y2, z, z2, x2), true),
    front: pathOf(faceRect(x, x2, z, z2, y2), true),
    top: pathOf(topRect({ x, y, width, depth }, z2), true),
    crease: pathOf([
      [x, y2, z2],
      [x2, y2, z2],
      [x2, y, z2]
    ])
  };
}

type Ellipse = { left: number; right: number; y: number; radiusX: number; radiusY: number };

/** A circle lying flat projects to an ellipse twice as wide as it is tall. */
function ellipseOf([centerX, centerY]: Point2, radius: number, z: number): Ellipse {
  const [x, y] = project([centerX, centerY, z]);
  const radiusX = radius * PROJECTION.scale;

  return { left: round(x - radiusX), right: round(x + radiusX), y: round(y), radiusX: round(radiusX), radiusY: round(radiusX / 2) };
}

export function ringPath(center: Point2, radius: number, z: number): string {
  const { left, right, y, radiusX, radiusY } = ellipseOf(center, radius, z);
  return `M${left} ${y}A${radiusX} ${radiusY} 0 1 0 ${right} ${y}A${radiusX} ${radiusY} 0 1 0 ${left} ${y}Z`;
}

/** An upright cylinder: its body down to the near half of its base, and its top. */
export function cylinderPaths(center: Point2, radius: number, z: number, height: number): CylinderPaths {
  const base = ellipseOf(center, radius, z);
  const cap = ellipseOf(center, radius, z + height);

  return {
    body: `M${cap.left} ${cap.y}L${base.left} ${base.y}A${base.radiusX} ${base.radiusY} 0 0 0 ${base.right} ${base.y}L${cap.right} ${cap.y}Z`,
    top: ringPath(center, radius, z + height)
  };
}

/** Lays text flat on a face that looks along +x, reading away from the camera's left. */
export function sideTextMatrix([x, y, z]: Point3): string {
  const [alongX, alongY] = projectOffset(0, -1, 0);
  const [downX, downY] = projectOffset(0, 0, -1);
  const [originX, originY] = project([x, y, z]);
  const fine = (value: number) => Math.round(value * 1000) / 1000;

  return `matrix(${fine(alongX)} ${fine(alongY)} ${fine(downX)} ${fine(downY)} ${fine(originX)} ${fine(originY)})`;
}

/** Where a part slides in from, as a world offset turned into screen offsets for the entry animation. */
export function slideFrom(dx: number, dy: number, dz: number, delayMs = 0): CSSProperties {
  const [x, y] = projectOffset(dx, dy, dz);
  return { "--slide-x": `${round(x)}px`, "--slide-y": `${round(y)}px`, "--slide-delay": `${delayMs}ms` } as CSSProperties;
}
