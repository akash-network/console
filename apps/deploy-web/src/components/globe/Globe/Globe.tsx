"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";

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

interface Props {
  markers: GlobeMarker[];
  /** Diameter in CSS pixels. If omitted, the globe sizes to its container. */
  size?: number;
  /** Rotation speed, radians per frame at 60fps; scaled by elapsed time so wall-clock speed is independent of refresh rate. */
  rotationSpeed?: number;
  /** Force a surface theme for color resolution. Set when rendering inside an inverted-theme scope. */
  surfaceTheme?: "light" | "dark";
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

type Rgb = [number, number, number];

/** Default angular velocity; chosen to match the cobe playground (one full revolution every ~21s at 60fps). */
const DEFAULT_ROTATION_SPEED = 0.005;

/** Vertical tilt of the camera in radians. Positive values pitch the north hemisphere toward the viewer. */
const GLOBE_THETA = 0.2;

/** Marker dot radius as a fraction of the globe's unit-sphere radius. Mirrors the cobe playground "Data Centers" preset. */
const MARKER_SIZE = 0.04;

/** Pink-500 (#ec4899) normalized to 0–1 RGB. cobe takes colors as `[r, g, b]` floats. */
const MARKER_COLOR_PINK: Rgb = [236 / 255, 72 / 255, 153 / 255];

/** Tooltip pill background. Lab() color from cobe playground `--ink` token — saturated electric indigo-blue. */
const TOOLTIP_BG = "lab(36 55.64 -107.68)";

export function Globe({ markers, size, rotationSpeed = DEFAULT_ROTATION_SPEED, surfaceTheme, className, dependencies: d = DEPENDENCIES }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phi = useRef(0);
  const documentTheme = d.useTheme();
  const effectiveTheme = surfaceTheme ?? documentTheme;

  const [measuredSize, setMeasuredSize] = useState<number | null>(null);
  const resolvedSize = size ?? measuredSize ?? 400;

  useEffect(
    function trackContainerSize() {
      if (size || !containerRef.current) return;
      const el = containerRef.current;
      const observer = new ResizeObserver(function onContainerResize(entries) {
        const rect = entries[0].contentRect;
        const next = Math.floor(Math.min(rect.width, rect.height));
        if (next > 0) setMeasuredSize(next);
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
      const isDark = effectiveTheme === "dark";

      const baseColor = readToken(canvasRef.current, "--card", [0.09, 0.09, 0.09]);
      const glowColor = readToken(canvasRef.current, "--background", isDark ? [0.05, 0.05, 0.05] : [0.96, 0.96, 0.96]);

      const globe = d.createGlobe(canvasRef.current, {
        devicePixelRatio: 2,
        width: resolvedSize * 2,
        height: resolvedSize * 2,
        phi: 0,
        theta: GLOBE_THETA,
        dark: isDark ? 1 : 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor,
        markerColor: MARKER_COLOR_PINK,
        markerElevation: 0,
        glowColor,
        markers: markers.map(m => ({ id: m.id, location: [m.lat, m.lng], size: MARKER_SIZE }))
      });

      let rafId = 0;
      let lastTime = performance.now();
      function tickGlobeRotation(now: number) {
        const deltaFrames = (now - lastTime) / (1000 / 60);
        lastTime = now;
        phi.current += rotationSpeed * deltaFrames;
        globe.update({ phi: phi.current });
        rafId = requestAnimationFrame(tickGlobeRotation);
      }
      rafId = requestAnimationFrame(tickGlobeRotation);

      return function teardownGlobe() {
        cancelAnimationFrame(rafId);
        globe.destroy();
      };
    },
    [markers, resolvedSize, rotationSpeed, effectiveTheme, d]
  );

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", width: size ?? "100%", height: size ?? "100%" }}>
      <canvas ref={canvasRef} style={{ width: resolvedSize, height: resolvedSize, display: "block" }} />
      {markers
        .filter(m => m.label)
        .map(m => (
          <div
            key={m.id}
            className="pointer-events-none absolute whitespace-nowrap uppercase text-white"
            style={
              {
                positionAnchor: `--cobe-${m.id}`,
                bottom: "anchor(top)",
                left: "anchor(center)",
                translate: "-50% 0",
                marginBottom: "14px",
                padding: "0.15rem 0.35rem",
                background: TOOLTIP_BG,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.08em",
                opacity: `var(--cobe-visible-${m.id}, 0)`,
                transition: "opacity 0.3s, filter 0.3s"
              } as CSSProperties
            }
          >
            {m.label}
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
        ))}
    </div>
  );
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
  const [hStr, sStr, lStr] = hsl.trim().split(/\s+/);
  if (!hStr || !sStr || !lStr) throw new Error("Invalid HSL token");
  const h = parseFloat(hStr);
  const s = parseFloat(sStr) / 100;
  const l = parseFloat(lStr) / 100;
  if (![h, s, l].every(Number.isFinite)) throw new Error("Invalid numeric HSL token");

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hPrime = h / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = l - c / 2;

  const [r, g, b]: Rgb = hPrime < 1 ? [c, x, 0] : hPrime < 2 ? [x, c, 0] : hPrime < 3 ? [0, c, x] : hPrime < 4 ? [0, x, c] : hPrime < 5 ? [x, 0, c] : [c, 0, x];

  return [r + m, g + m, b + m];
}
