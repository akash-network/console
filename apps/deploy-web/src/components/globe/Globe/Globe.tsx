"use client";

import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import createGlobe, { type COBEOptions, type Globe as CobeInstance } from "cobe";

import useCookieTheme from "@src/hooks/useTheme";

export type GlobeMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
};

export const DEPENDENCIES = {
  createGlobe,
  useTheme: useCookieTheme
};

type Props = {
  markers: GlobeMarker[];
  /** Diameter in CSS pixels. If omitted, the globe sizes to its container. */
  size?: number;
  /** Rotation speed, radians per frame at 60fps; scaled by elapsed time so wall-clock speed is independent of refresh rate. */
  rotationSpeed?: number;
  /**
   * Coordinates of a marker to focus on. When set, the globe smoothly interpolates rotation and
   * tilt toward this point and stops spinning. When unset, the globe free-spins at `rotationSpeed`.
   */
  focusedMarker?: { lat: number; lng: number } | null;
  /**
   * Duration in milliseconds of the eased rotation that plays when `focusedMarker` changes. Longer
   * values make the reposition slower and more deliberate so the eye can actually follow the globe
   * turning toward the marker rather than perceiving a snap.
   */
  focusDurationMs?: number;
  /**
   * Where, vertically, a focused marker should come to rest — as a signed fraction of the sphere's
   * projected radius, measured from the camera center. `0` rests the marker at the geometric center
   * of the globe; negative values lift it toward the top of the sphere, positive values push it
   * toward the bottom. Use this when the globe is rendered oversized and cropped (only a top cap
   * visible) so the marker lands inside the visible region instead of the off-screen center.
   * Clamped to (-1, 1).
   */
  focusScreenBiasY?: number;
  /**
   * Where, horizontally, a focused marker should come to rest — as a signed fraction of the
   * sphere's projected radius, measured from the camera center. `0` rests the marker on the camera
   * meridian; positive values push it toward the right. Useful to correct the sideways drift a
   * focused marker picks up when it's also lifted vertically on a cropped globe. Clamped to (-1, 1).
   */
  focusScreenBiasX?: number;
  /**
   * Marker dot radius as a fraction of the globe's unit-sphere radius. Override when the globe is
   * rendered oversized (e.g. cropped at the top of a container) — the default reads as too big
   * relative to the visible cap. Mirrors the cobe playground "Data Centers" preset by default.
   */
  markerSize?: number;
  /** Force a surface theme for color resolution. Set when rendering inside an inverted-theme scope. */
  surfaceTheme?: "light" | "dark";
  /** Additional cobe options to merge with the defaults when creating the globe. Use this to tweak globe appearance or behavior. */
  cobeOptions?: Partial<COBEOptions>;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Active focus tween. Recreated by `tickGlobeRotation` whenever the focus target changes: it
 * snapshots the phi/theta the globe is currently at and the resolved target, then eases between
 * them over wall-clock time so the full rotation stays visible regardless of distance or refresh
 * rate. `null` while free-spinning or once the tween has completed.
 */
type FocusTween = {
  startedAt: number;
  durationMs: number;
  fromPhi: number;
  toPhi: number;
  fromTheta: number;
  toTheta: number;
  /** Identity of the `focusedMarker` this tween targets; a change restarts the tween. */
  target: { lat: number; lng: number };
};

type Rgb = [number, number, number];

/** Default angular velocity; chosen to match the cobe playground (one full revolution every ~21s at 60fps). */
const DEFAULT_ROTATION_SPEED = 0.005;

/** Vertical tilt of the camera in radians. Positive values pitch the north hemisphere toward the viewer. */
const GLOBE_THETA = 0.2;

/** Per-frame wall-clock duration assuming a 60Hz refresh. Used to normalize per-frame rates so wall-clock motion is independent of the display's actual framerate. */
const FRAME_MS_60HZ = 1000 / 60;

/** Open-interval clamp for the focus-bias fractions so `Math.asin` never hits ±1 (which would map to ±π/2 — a pole — and produce a degenerate camera). */
const MAX_BIAS_FRACTION = 0.999;

/**
 * Open-interval bound for camera theta. Beyond ±π/2 the camera flips past a pole (gimbal-locks and
 * renders an upside-down globe). `targetTheta` is the sum of the marker's latitude and the Y bias's
 * `asin`, each individually capped near ±π/2 — so the sum can still overshoot for high-latitude
 * markers paired with extreme bias. We clamp the final value to this bound to keep the camera safe.
 */
const MAX_THETA = (Math.PI / 2) * MAX_BIAS_FRACTION;

/**
 * cobe maps input longitude 0 onto sphere position (1, 0, 0) — 90° to the right of the camera's
 * view direction — because its surface texture is wound starting at the antimeridian. To make a
 * focused marker actually land on the camera meridian (screen-x centerline) at `focusScreenBiasX = 0`,
 * the globe needs an additional −π/2 of yaw beyond `-lng_rad`. Baking that offset in here lets the
 * X bias keep its documented "0 = centered, +x = right" semantics instead of accidentally meaning
 * "rotate the texture by π/2".
 */
const CAMERA_MERIDIAN_PHI_OFFSET = -Math.PI / 2;

/**
 * Per-frame easing applied when relaxing tilt back to rest after a focus is cleared. Scaled by
 * `deltaFrames` so wall-clock duration is framerate-independent.
 */
const FOCUS_LERP_RATE = 0.08;

/**
 * Default duration of the focus reposition tween. A time-based eased tween (rather than an
 * asymptotic per-frame lerp) keeps the whole rotation visible: an exponential lerp does most of its
 * motion in the first ~150ms and then crawls imperceptibly close to the target, which reads as a
 * snap. ~1.6s with an ease-in-out curve makes the turn slow enough for the eye to follow.
 */
const DEFAULT_FOCUS_DURATION_MS = 1600;

/** Default marker dot radius as a fraction of the globe's unit-sphere radius. Mirrors the cobe playground "Data Centers" preset. */
const DEFAULT_MARKER_SIZE = 0.04;

/** Pink-500 (#ec4899) normalized to 0–1 RGB. cobe takes colors as `[r, g, b]` floats. */
const MARKER_COLOR_PINK: Rgb = [236 / 255, 72 / 255, 153 / 255];

/** Tooltip pill background. Lab() color from cobe playground `--ink` token — saturated electric indigo-blue. */
const TOOLTIP_BG = "lab(36 55.64 -107.68)";

export function Globe({
  markers,
  size,
  rotationSpeed = DEFAULT_ROTATION_SPEED,
  focusedMarker = null,
  focusDurationMs = DEFAULT_FOCUS_DURATION_MS,
  focusScreenBiasY = 0,
  focusScreenBiasX = 0,
  markerSize = DEFAULT_MARKER_SIZE,
  surfaceTheme,
  className,
  cobeOptions = {},
  dependencies: d = DEPENDENCIES
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phi = useRef(0);
  const theta = useRef(GLOBE_THETA);
  const focusedMarkerRef = useRef(focusedMarker);
  focusedMarkerRef.current = focusedMarker;
  const focusDurationRef = useRef(focusDurationMs);
  focusDurationRef.current = focusDurationMs;

  const markersKey = useMemo(() => markers.map(m => `${m.id}:${m.lat},${m.lng}`).join("|"), [markers]);
  const cobeOptionsKey = useMemo(() => JSON.stringify(cobeOptions), [cobeOptions]);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const cobeOptionsRef = useRef(cobeOptions);
  cobeOptionsRef.current = cobeOptions;
  const focusTween = useRef<FocusTween | null>(null);
  const documentTheme = d.useTheme();
  const effectiveTheme = surfaceTheme ?? documentTheme;

  const [measuredSize, setMeasuredSize] = useState<number | null>(null);
  const resolvedSize = size ?? measuredSize ?? 400;
  /**
   * Latest `resolvedSize` mirrored into a ref so {@link createAndDriveGlobe} can read it on the
   * first run without listing it as a dep. Listing `resolvedSize` as a dep would tear down and
   * recreate the cobe globe on every resize, and cobe wraps the canvas in a `position:relative`
   * div on creation but never unwraps on destroy — recreations would accumulate nested wrappers.
   * Subsequent size changes flow through {@link syncGlobeSize} instead.
   */
  const resolvedSizeRef = useRef(resolvedSize);
  resolvedSizeRef.current = resolvedSize;
  /** Active cobe globe so {@link syncGlobeSize} can push size updates without tearing it down. */
  const globeRef = useRef<CobeInstance | null>(null);

  useLayoutEffect(
    function measureContainerBeforePaint() {
      if (size || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = Math.floor(Math.min(rect.width, rect.height));
      if (next > 0) setMeasuredSize(prev => (prev === next ? prev : next));
    },
    [size]
  );

  useEffect(
    function trackContainerSize() {
      if (size || !containerRef.current) return;
      const el = containerRef.current;
      const observer = new ResizeObserver(function onContainerResize(entries) {
        const rect = entries[0].contentRect;
        const next = Math.floor(Math.min(rect.width, rect.height));
        if (next > 0) setMeasuredSize(prev => (prev === next ? prev : next));
      });
      observer.observe(el);
      return function disconnectResizeObserver() {
        observer.disconnect();
      };
    },
    [size]
  );

  useEffect(
    function createAndDriveGlobe() {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const isDark = effectiveTheme === "dark";

      const baseColor = readToken(canvas, "--card", [0.09, 0.09, 0.09]);
      const glowColor = readToken(canvas, "--background", isDark ? [0.05, 0.05, 0.05] : [0.96, 0.96, 0.96]);

      const globe = d.createGlobe(canvas, {
        devicePixelRatio: 1,
        width: resolvedSizeRef.current,
        height: resolvedSizeRef.current,
        phi: phi.current,
        theta: theta.current,
        dark: isDark ? 1 : 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor,
        markerColor: MARKER_COLOR_PINK,
        markerElevation: 0,
        glowColor,
        markers: markersRef.current.map(m => ({ id: m.id, location: [m.lat, m.lng], size: markerSize })),
        ...cobeOptionsRef.current
      });
      globeRef.current = globe;

      let rafId = 0;
      let lastTime = performance.now();
      function tickGlobeRotation(now: number) {
        const deltaFrames = (now - lastTime) / FRAME_MS_60HZ;
        lastTime = now;
        const focus = focusedMarkerRef.current;
        if (focus) {
          const clampedBiasY = Math.max(-MAX_BIAS_FRACTION, Math.min(MAX_BIAS_FRACTION, focusScreenBiasY));
          const clampedBiasX = Math.max(-MAX_BIAS_FRACTION, Math.min(MAX_BIAS_FRACTION, focusScreenBiasX));
          const targetPhi = -degreesToRadians(focus.lng) + CAMERA_MERIDIAN_PHI_OFFSET + Math.asin(clampedBiasX);
          const targetTheta = Math.max(-MAX_THETA, Math.min(MAX_THETA, degreesToRadians(focus.lat) + Math.asin(clampedBiasY)));

          const existing = focusTween.current;
          const active =
            existing && existing.target.lat === focus.lat && existing.target.lng === focus.lng
              ? existing
              : {
                  startedAt: now,
                  durationMs: Math.max(1, focusDurationRef.current),
                  fromPhi: phi.current,
                  toPhi: phi.current + shortestAngleDelta(phi.current, targetPhi),
                  fromTheta: theta.current,
                  toTheta: targetTheta,
                  target: { lat: focus.lat, lng: focus.lng }
                };
          focusTween.current = active;

          const progress = Math.min(1, (now - active.startedAt) / active.durationMs);
          const eased = easeInOutCubic(progress);
          phi.current = active.fromPhi + (active.toPhi - active.fromPhi) * eased;
          theta.current = active.fromTheta + (active.toTheta - active.fromTheta) * eased;
        } else {
          focusTween.current = null;
          phi.current += rotationSpeed * deltaFrames;
          theta.current = lerp(theta.current, GLOBE_THETA, FOCUS_LERP_RATE * deltaFrames);
        }
        globe.update({ phi: phi.current, theta: theta.current });
        rafId = requestAnimationFrame(tickGlobeRotation);
      }
      rafId = requestAnimationFrame(tickGlobeRotation);

      return function teardownGlobe() {
        cancelAnimationFrame(rafId);
        globe.destroy();
        globeRef.current = null;
        removeCobeCanvasWrapper(canvas, containerRef.current);
      };
    },
    // `resolvedSize` is intentionally omitted — `syncGlobeSize` pushes size updates through
    // `globe.update()` so cobe doesn't re-wrap the canvas on every resize. See `globeRef`.

    [markersKey, rotationSpeed, focusScreenBiasY, focusScreenBiasX, markerSize, effectiveTheme, d, cobeOptionsKey]
  );

  useEffect(
    /**
     * Push size changes to the existing globe instead of recreating it. Recreation would re-run
     * `createGlobe`, which wraps the canvas in a fresh `position:relative` div without unwrapping
     * the previous one — wrappers would accumulate on every resize.
     */
    function syncGlobeSize() {
      globeRef.current?.update({ width: resolvedSize, height: resolvedSize });
    },
    [resolvedSize]
  );

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", width: size ?? "100%", height: size ?? "100%" }}>
      <canvas ref={canvasRef} style={{ width: resolvedSize, height: resolvedSize, display: "block" }} />
      {markers
        .filter(marker => marker.label)
        .map(marker => (
          <GlobeMarkerLabel key={marker.id} marker={marker} />
        ))}
    </div>
  );
}

/**
 * Floating label pinned to a cobe marker via CSS anchor positioning. cobe writes the marker's
 * on-screen anchor + a `--cobe-visible-${id}` opacity custom prop on the container, so the label
 * fades in/out as the dot rotates onto/off the visible hemisphere.
 */
function GlobeMarkerLabel({ marker }: { marker: GlobeMarker }) {
  return (
    <div
      className="pointer-events-none absolute whitespace-nowrap uppercase text-white"
      style={
        {
          positionAnchor: `--cobe-${marker.id}`,
          bottom: "anchor(top)",
          left: "anchor(center)",
          translate: "-50% 0",
          marginBottom: "14px",
          padding: "0.15rem 0.35rem",
          background: TOOLTIP_BG,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: "0.6rem",
          letterSpacing: "0.08em",
          opacity: `var(--cobe-visible-${marker.id}, 0)`,
          transition: "opacity 0.3s, filter 0.3s"
        } as CSSProperties
      }
    >
      {marker.label}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translate3d(-50%, -1px, 0)",
          width: 0,
          height: 0,
          border: "5px solid transparent",
          borderTopColor: TOOLTIP_BG
        }}
      />
    </div>
  );
}

/**
 * Strip the `position:relative;width:100%;height:100%` wrapper cobe adds around the canvas on
 * `createGlobe` so it doesn't accumulate across recreations. Cobe inserts that wrapper on every
 * call but never removes it on `destroy`, so without this the canvas ends up nested inside one
 * extra wrapper for every theme/marker/option-key change that re-runs `createAndDriveGlobe`.
 * No-op when the canvas is already a direct child of its expected container.
 */
function removeCobeCanvasWrapper(canvas: HTMLCanvasElement, expectedParent: HTMLElement | null): void {
  const wrapper = canvas.parentElement;
  if (!wrapper || !expectedParent || wrapper === expectedParent) return;
  wrapper.parentElement?.insertBefore(canvas, wrapper);
  wrapper.remove();
}

/** Convert a longitude/latitude in degrees to radians. cobe accepts radians for `phi`/`theta`. */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/** Standard linear interpolation. `t` is clamped to [0, 1] so per-frame easing is well-behaved at low framerates. */
function lerp(from: number, to: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return from + (to - from) * clamped;
}

/**
 * Signed shortest angular distance from `from` to `to`, treating both as 2π-periodic and returning
 * a value in (−π, π]. Resolving this once when a tween starts (rather than per frame) keeps the
 * eased rotation going one consistent direction even across the antimeridian (e.g. +175° → −175°).
 */
function shortestAngleDelta(from: number, to: number): number {
  const twoPi = Math.PI * 2;
  let delta = (((to - from) % twoPi) + twoPi) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  return delta;
}

/**
 * Cubic ease-in-out on a normalized [0, 1] progress value. Eases out of rest and back into rest so
 * the focus reposition accelerates and decelerates smoothly instead of starting and stopping
 * abruptly — the slow tails are what make the rotation read as a deliberate turn.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Read a CSS custom property as an RGB triplet, resolving HSL via {@link hslStringToRgb}.
 * Reading from `scope` rather than `document.documentElement` lets the value cascade through
 * an inverted-theme wrapper (e.g. a `.dark`-class panel rendered inside a light app).
 */
function readToken(scope: Element | null, name: string, fallback: Rgb): Rgb {
  if (!scope) return fallback;
  const raw = getComputedStyle(scope).getPropertyValue(name);
  if (!raw) return fallback;
  try {
    return hslStringToRgb(raw);
  } catch {
    return fallback;
  }
}

/**
 * Convert a shadcn-style `"H S% L%"` token (no `hsl()` wrapper) to a `[r, g, b]` triplet in 0–1.
 * Throws on malformed input so callers can fall back to a baked default.
 */
function hslStringToRgb(hsl: string): Rgb {
  const [hueStr, satStr, lightStr] = hsl.trim().split(/\s+/);
  if (!hueStr || !satStr || !lightStr) throw new Error("Invalid HSL token");
  const hue = parseFloat(hueStr);
  const saturation = parseFloat(satStr) / 100;
  const lightness = parseFloat(lightStr) / 100;
  if (![hue, saturation, lightness].every(Number.isFinite)) throw new Error("Invalid numeric HSL token");

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const lightnessOffset = lightness - chroma / 2;

  const [r, g, b] = rgbFromChroma(huePrime, chroma, secondary);

  return [r + lightnessOffset, g + lightnessOffset, b + lightnessOffset];
}

/** Pick the RGB triplet for the current 60°-sextant of the hue wheel — the table form of the standard HSL→RGB derivation. */
function rgbFromChroma(huePrime: number, chroma: number, secondary: number): Rgb {
  switch (Math.floor(huePrime)) {
    case 0:
      return [chroma, secondary, 0];
    case 1:
      return [secondary, chroma, 0];
    case 2:
      return [0, chroma, secondary];
    case 3:
      return [0, secondary, chroma];
    case 4:
      return [secondary, 0, chroma];
    default:
      return [chroma, 0, secondary];
  }
}
