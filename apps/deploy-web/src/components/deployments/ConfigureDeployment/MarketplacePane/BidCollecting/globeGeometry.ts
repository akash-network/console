export const RADIANS_PER_DEGREE = Math.PI / 180;

/** Every size in the drawing is tuned for a canvas this wide and scales with the real one. */
const REFERENCE_SIZE_PX = 280;
const ORB_RADIUS_RATIO = 0.4;

const MIN_INTERPOLATED_ANGLE = 1e-6;

/** Radians, unlike the degrees providers are located in. */
export interface GeoPoint {
  lng: number;
  lat: number;
  vector: readonly [number, number, number];
}

export interface GlobeView {
  centerLng: number;
  tilt: number;
}

/** On the unit disc with y pointing up, unlike the canvas; `depth` is positive on the visible hemisphere. */
export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  isVisible: boolean;
}

export interface GlobeLayout {
  center: number;
  radius: number;
  unit: number;
}

export function globeLayout(size: number): GlobeLayout {
  return { center: size / 2, radius: size * ORB_RADIUS_RATIO, unit: size / REFERENCE_SIZE_PX };
}

export function toGeoPoint(lng: number, lat: number): GeoPoint {
  return { lng, lat, vector: [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)] };
}

export function angleBetween(from: GeoPoint, to: GeoPoint): number {
  const dot = from.vector[0] * to.vector[0] + from.vector[1] * to.vector[1] + from.vector[2] * to.vector[2];
  return Math.acos(clamp(dot, -1, 1));
}

export function interpolateGreatCircle(from: GeoPoint, to: GeoPoint, angle: number, progress: number): [number, number] {
  if (angle < MIN_INTERPOLATED_ANGLE) return [from.lng, from.lat];

  const sinAngle = Math.sin(angle);
  const fromWeight = Math.sin((1 - progress) * angle) / sinAngle;
  const toWeight = Math.sin(progress * angle) / sinAngle;
  const x = fromWeight * from.vector[0] + toWeight * to.vector[0];
  const y = fromWeight * from.vector[1] + toWeight * to.vector[1];
  const z = fromWeight * from.vector[2] + toWeight * to.vector[2];
  return [Math.atan2(y, x), Math.asin(clamp(z, -1, 1))];
}

/** Matches d3's geoOrthographic rotated by [-centerLng, -tilt], so pins and arcs land on the map d3 draws. */
export function projectOnGlobe(view: GlobeView, lng: number, lat: number, altitude = 1): ProjectedPoint {
  const lngFromCenter = lng - view.centerLng;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLngFromCenter = Math.cos(lngFromCenter);
  const x = cosLat * Math.sin(lngFromCenter);
  const y = Math.cos(view.tilt) * sinLat - Math.sin(view.tilt) * cosLat * cosLngFromCenter;
  const depth = Math.sin(view.tilt) * sinLat + Math.cos(view.tilt) * cosLat * cosLngFromCenter;
  const clearsOutline = (x * x + y * y) * altitude * altitude > 1;
  return { x: x * altitude, y: y * altitude, depth, isVisible: depth > 0 || clearsOutline };
}

/** Guessed from the UTC offset, since asking for the real location would prompt for a permission. */
export function locateViewer(timezoneOffsetMinutes: number): GeoPoint {
  const lngDegrees = clamp(-timezoneOffsetMinutes / 4, -165, 165);
  const latDegrees = timezoneOffsetMinutes > 0 ? 37 : timezoneOffsetMinutes < -300 ? 30 : 47;
  return toGeoPoint(lngDegrees * RADIANS_PER_DEGREE, latDegrees * RADIANS_PER_DEGREE);
}

/** Stable per input, so a placement replays the same launch order. */
export function hashToUnit(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function easeInOutCubic(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

export function easeOutBack(progress: number): number {
  return 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
