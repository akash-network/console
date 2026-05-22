import { afterEach, describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES, GlobeMarker } from "./Globe";
import { Globe } from "./Globe";

import { render, screen } from "@testing-library/react";

describe(Globe.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes cobe on mount and tears it down on unmount", () => {
    const { unmount, createGlobe, destroy } = setup({ markers: [{ id: "test-a", lat: 0, lng: 0 }] });

    expect(createGlobe).toHaveBeenCalledTimes(1);
    const [canvas, opts] = createGlobe.mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect((opts as { markers: unknown[] }).markers).toEqual([{ id: "test-a", location: [0, 0], size: 0.04 }]);

    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("initializes cobe with dark=0 when mounted under the light theme", () => {
    const { createGlobe } = setup({ markers: [{ id: "test-a", lat: 0, lng: 0 }], theme: "light" });

    expect(createGlobe).toHaveBeenCalledTimes(1);
    const dark = (createGlobe.mock.calls[0][1] as { dark: number }).dark;
    expect(dark).toBe(0);
  });

  it("initializes cobe with dark=1 when mounted under the dark theme", () => {
    const { createGlobe } = setup({ markers: [{ id: "test-a", lat: 0, lng: 0 }], theme: "dark" });

    expect(createGlobe).toHaveBeenCalledTimes(1);
    const dark = (createGlobe.mock.calls[0][1] as { dark: number }).dark;
    expect(dark).toBe(1);
  });

  it("renders label overlays for markers that have a label", () => {
    setup({
      markers: [
        { id: "us-east-1", lat: 0, lng: 0, label: "US-EAST-1" },
        { id: "unlabeled", lat: 10, lng: 10 }
      ]
    });

    expect(screen.queryByText("US-EAST-1")).toBeInTheDocument();
  });

  it("rests a focused marker at the camera center when focusScreenBias is 0", () => {
    const { runFrames, latestTheta } = setup({
      markers: [{ id: "eq", lat: 0, lng: 0 }],
      focusedMarker: { lat: 0, lng: 0 },
      focusScreenBias: 0
    });

    runFrames();

    expect(latestTheta()).toBeCloseTo(0, 3);
  });

  it("lifts a focused marker above the camera center by asin(bias) of extra tilt", () => {
    const { runFrames, latestTheta } = setup({
      markers: [{ id: "eq", lat: 0, lng: 0 }],
      focusedMarker: { lat: 0, lng: 0 },
      focusScreenBias: 2 / 3
    });

    runFrames();

    expect(latestTheta()).toBeCloseTo(Math.asin(2 / 3), 2);
  });

  it("clamps targetTheta to keep the camera within (-π/2, π/2) for high-latitude markers with extreme bias", () => {
    // Without the clamp, lat=-60° + biasY=-0.95 would push theta below -π/2 (camera flipped past
    // the south pole, gimbal lock). The clamp keeps it just inside ±π/2.
    const { runFrames, latestTheta } = setup({
      markers: [{ id: "south", lat: -60, lng: 0 }],
      focusedMarker: { lat: -60, lng: 0 },
      focusScreenBias: -0.95
    });

    runFrames();

    expect(latestTheta()).toBeGreaterThan(-Math.PI / 2);
    expect(latestTheta()).toBeLessThan(Math.PI / 2);
  });

  it("rests a focused marker on the camera meridian when focusScreenBiasX is 0", () => {
    const { runFrames, latestPhi } = setup({
      markers: [{ id: "eq", lat: 0, lng: 0 }],
      focusedMarker: { lat: 0, lng: 0 },
      focusScreenBiasX: 0
    });

    runFrames();

    // cobe wraps its surface texture starting at the antimeridian, so a marker at lng=0 sits at
    // sphere position (1, 0, 0) — 90° right of the camera. The globe must rotate an additional
    // −π/2 of yaw to bring it onto the camera meridian.
    expect(latestPhi()).toBeCloseTo(-Math.PI / 2, 3);
  });

  it("pushes a focused marker right of the camera meridian by asin(biasX) of extra yaw", () => {
    const { runFrames, latestPhi } = setup({
      markers: [{ id: "eq", lat: 0, lng: 0 }],
      focusedMarker: { lat: 0, lng: 0 },
      focusScreenBiasX: 2 / 3
    });

    runFrames();

    // Same −π/2 meridian offset as the centered case, plus asin(2/3) of yaw to shift the marker
    // 2/3 of the projected radius right of center.
    expect(latestPhi()).toBeCloseTo(-Math.PI / 2 + Math.asin(2 / 3), 2);
  });

  describe("focus reposition tween", () => {
    it("eases over focusDurationMs instead of snapping to the target", () => {
      const { runFrames, framesFor, latestTheta } = setup({
        markers: [{ id: "far", lat: 40, lng: 120 }],
        focusedMarker: { lat: 40, lng: 120 },
        focusDurationMs: 1600
      });

      runFrames(framesFor(400));

      const targetTheta = (40 * Math.PI) / 180;
      const theta = latestTheta();
      expect(theta).toBeGreaterThan(0);
      expect(theta).toBeLessThan(targetTheta * 0.5);
    });

    it("reaches the target once focusDurationMs has elapsed", () => {
      const { runFrames, framesFor, latestTheta } = setup({
        markers: [{ id: "far", lat: 40, lng: 120 }],
        focusedMarker: { lat: 40, lng: 120 },
        focusDurationMs: 1600
      });

      runFrames(framesFor(1800));

      expect(latestTheta()).toBeCloseTo((40 * Math.PI) / 180, 3);
    });

    it("takes proportionally longer to reach the target with a longer focusDurationMs", () => {
      const target = (40 * Math.PI) / 180;

      const short = setup({
        markers: [{ id: "far", lat: 40, lng: 120 }],
        focusedMarker: { lat: 40, lng: 120 },
        focusDurationMs: 800
      });
      short.runFrames(short.framesFor(1000));
      const shortDurationTheta = short.latestTheta();
      short.unmount();

      const long = setup({
        markers: [{ id: "far", lat: 40, lng: 120 }],
        focusedMarker: { lat: 40, lng: 120 },
        focusDurationMs: 3200
      });
      long.runFrames(long.framesFor(1000));
      const longDurationTheta = long.latestTheta();

      expect(shortDurationTheta).toBeCloseTo(target, 3);
      expect(longDurationTheta).toBeLessThan(target * 0.9);
    });

    it("restarts the tween from the current position when the focused marker changes", () => {
      const { rerender, runFrames, framesFor, latestTheta, createGlobe } = setup({
        markers: [{ id: "a", lat: 40, lng: 120 }],
        focusedMarker: { lat: 40, lng: 120 },
        focusDurationMs: 1600
      });

      runFrames(framesFor(1800));
      const firstTargetTheta = (40 * Math.PI) / 180;
      expect(latestTheta()).toBeCloseTo(firstTargetTheta, 3);

      rerender(
        <Globe
          markers={[{ id: "b", lat: -30, lng: 120 }]}
          size={400}
          focusedMarker={{ lat: -30, lng: 120 }}
          focusDurationMs={1600}
          dependencies={{ createGlobe, useTheme: () => "light" }}
        />
      );
      const secondTargetTheta = (-30 * Math.PI) / 180;
      runFrames(framesFor(400));

      const midTheta = latestTheta();
      expect(midTheta).toBeLessThan(firstTargetTheta);
      expect(midTheta).toBeGreaterThan(secondTargetTheta);

      runFrames(framesFor(1800));
      expect(latestTheta()).toBeCloseTo(secondTargetTheta, 3);
    });
  });

  function setup(input: {
    markers: GlobeMarker[];
    theme?: "light" | "dark";
    focusedMarker?: { lat: number; lng: number } | null;
    focusDurationMs?: number;
    focusScreenBias?: number;
    focusScreenBiasX?: number;
  }) {
    const destroy = vi.fn();
    const update = vi.fn();
    const createGlobe = vi.fn<typeof DEPENDENCIES.createGlobe>(() => ({ destroy, update }));

    const rafCallbacks: FrameRequestCallback[] = [];
    let now = 0;

    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(cb => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

    function framesFor(ms: number) {
      return Math.ceil(ms / (1000 / 60));
    }

    function runFrames(count = 400) {
      for (let i = 0; i < count; i++) {
        now += 1000 / 60;
        rafCallbacks.splice(0).forEach(cb => cb(now));
      }
    }

    function latestTheta() {
      const calls = update.mock.calls;
      return (calls[calls.length - 1][0] as { theta: number }).theta;
    }

    function latestPhi() {
      const calls = update.mock.calls;
      return (calls[calls.length - 1][0] as { phi: number }).phi;
    }

    const useTheme: typeof DEPENDENCIES.useTheme = () => input.theme ?? "light";

    const view = render(
      <Globe
        markers={input.markers}
        size={400}
        focusedMarker={input.focusedMarker ?? null}
        focusDurationMs={input.focusDurationMs}
        focusScreenBiasY={input.focusScreenBias}
        focusScreenBiasX={input.focusScreenBiasX}
        dependencies={{ createGlobe, useTheme }}
      />
    );

    return { ...view, createGlobe, destroy, update, runFrames, framesFor, latestTheta, latestPhi };
  }
});
