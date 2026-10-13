import { geoOrthographic } from "d3-geo";
import { describe, expect, it } from "vitest";

import {
  angleBetween,
  clamp,
  easeInOutCubic,
  easeOutBack,
  globeLayout,
  hashToUnit,
  interpolateGreatCircle,
  locateViewer,
  projectOnGlobe,
  RADIANS_PER_DEGREE,
  toGeoPoint
} from "./globeGeometry";

describe("globeGeometry", () => {
  describe(globeLayout.name, () => {
    it("centers a orb 40% as wide as the canvas and scales every size from a 280px canvas", () => {
      expect(globeLayout(280)).toEqual({ center: 140, radius: 112, unit: 1 });
      expect(globeLayout(560)).toEqual({ center: 280, radius: 224, unit: 2 });
    });
  });

  describe(toGeoPoint.name, () => {
    it("places longitude 0 on the x axis, longitude 90° on the y axis and the north pole on the z axis", () => {
      expectVector(toGeoPoint(0, 0).vector, [1, 0, 0]);
      expectVector(toGeoPoint(Math.PI / 2, 0).vector, [0, 1, 0]);
      expectVector(toGeoPoint(0.4, Math.PI / 2).vector, [0, 0, 1]);
      expectVector(toGeoPoint(Math.PI / 4, Math.PI / 4).vector, [0.5, 0.5, Math.SQRT1_2]);
    });
  });

  describe(angleBetween.name, () => {
    it("measures the angle between two points through the center of the earth", () => {
      expect(angleBetween(toGeoPoint(0, 0), toGeoPoint(Math.PI / 2, 0))).toBeCloseTo(Math.PI / 2);
      expect(angleBetween(toGeoPoint(0, 0), toGeoPoint(Math.PI, 0))).toBeCloseTo(Math.PI);
      expect(angleBetween(toGeoPoint(0, 0), toGeoPoint(0, -Math.PI / 4))).toBeCloseTo(Math.PI / 4);
    });

    it("reads a point against itself as no angle when rounding pushes the dot product past 1", () => {
      const point = toGeoPoint(-1.3, 0.33);

      expect(angleBetween(point, point)).toBe(0);
    });
  });

  describe(interpolateGreatCircle.name, () => {
    it("walks the great circle from one point to the other", () => {
      const from = toGeoPoint(0, 0);
      const to = toGeoPoint(Math.PI / 2, 0);

      expectPair(interpolateGreatCircle(from, to, Math.PI / 2, 0), [0, 0]);
      expectPair(interpolateGreatCircle(from, to, Math.PI / 2, 0.5), [Math.PI / 4, 0]);
      expectPair(interpolateGreatCircle(from, to, Math.PI / 2, 1), [Math.PI / 2, 0]);
    });

    it("climbs in latitude along a meridian", () => {
      const from = toGeoPoint(0.3, 0);
      const to = toGeoPoint(0.3, Math.PI / 3);

      expectPair(interpolateGreatCircle(from, to, Math.PI / 3, 0.25), [0.3, Math.PI / 12]);
      expectPair(interpolateGreatCircle(from, to, Math.PI / 3, 0.75), [0.3, Math.PI / 4]);
    });

    it("stays on the starting point when both points coincide", () => {
      const point = toGeoPoint(0.2, 0.1);

      expect(interpolateGreatCircle(point, point, 0, 0.5)).toEqual([0.2, 0.1]);
    });
  });

  describe(projectOnGlobe.name, () => {
    it("puts the view's center in the middle of the disc, facing the viewer", () => {
      expect(projectOnGlobe({ centerLng: 0.5, tilt: 0 }, 0.5, 0)).toEqual({ x: 0, y: 0, depth: 1, isVisible: true });
    });

    it("hides the far side and keeps the near side visible", () => {
      const view = { centerLng: 0, tilt: 0 };

      expect(projectOnGlobe(view, Math.PI - 0.2, 0).isVisible).toBe(false);
      expect(projectOnGlobe(view, Math.PI / 2 - 0.2, 0).isVisible).toBe(true);
    });

    it("keeps a point lifted off the far side visible while it clears the orb's outline", () => {
      const view = { centerLng: 0, tilt: 0 };

      expect(projectOnGlobe(view, Math.PI / 2 + 0.1, 0, 1.2)).toMatchObject({ isVisible: true });
      expect(projectOnGlobe(view, Math.PI / 2 + 0.1, 0, 1.2).x).toBeCloseTo(1.2 * Math.cos(0.1));
      expect(projectOnGlobe(view, Math.PI / 2 + 0.1, 0, 1).isVisible).toBe(false);
    });

    it("leans the north pole toward the viewer by the tilt", () => {
      const pole = projectOnGlobe({ centerLng: 0, tilt: 0.38 }, 0, Math.PI / 2);

      expect(pole.y).toBeCloseTo(Math.cos(0.38));
      expect(pole.depth).toBeCloseTo(Math.sin(0.38));
    });

    it.each([
      [10, 20],
      [-60, 45],
      [100, -30],
      [-150, 5]
    ])("lands where d3's orthographic projection draws the map (%d°, %d°)", (lngDegrees, latDegrees) => {
      const view = { centerLng: -0.9, tilt: 0.38 };
      const d3Projection = geoOrthographic()
        .translate([0, 0])
        .scale(1)
        .rotate([-view.centerLng / RADIANS_PER_DEGREE, -view.tilt / RADIANS_PER_DEGREE]);
      const [d3X, d3Y] = d3Projection([lngDegrees, latDegrees]) ?? [NaN, NaN];

      const point = projectOnGlobe(view, lngDegrees * RADIANS_PER_DEGREE, latDegrees * RADIANS_PER_DEGREE);

      expect(point.x).toBeCloseTo(d3X);
      expect(point.y).toBeCloseTo(-d3Y);
    });
  });

  describe(locateViewer.name, () => {
    it.each([
      { offset: 300, lng: -75, lat: 37, where: "west of UTC" },
      { offset: -60, lng: 15, lat: 47, where: "just east of UTC" },
      { offset: 0, lng: 0, lat: 47, where: "on UTC" },
      { offset: -300, lng: 75, lat: 47, where: "five hours east of UTC" },
      { offset: -540, lng: 135, lat: 30, where: "far east of UTC" },
      { offset: -720, lng: 165, lat: 30, where: "at the date line, held back from it" },
      { offset: 720, lng: -165, lat: 37, where: "at the date line on the other side" }
    ])("places a viewer $where by their UTC offset", ({ offset, lng, lat }) => {
      const viewer = locateViewer(offset);

      expect(viewer.lng).toBeCloseTo(lng * RADIANS_PER_DEGREE);
      expect(viewer.lat).toBeCloseTo(lat * RADIANS_PER_DEGREE);
    });
  });

  describe(hashToUnit.name, () => {
    it("maps text to a stable fraction", () => {
      expect(hashToUnit("")).toBe(0.5043428998906165);
      expect(hashToUnit("a")).toBe(0.8908105595037341);
      expect(hashToUnit("akash1abc")).toBe(0.368506311904639);
    });
  });

  describe(easeInOutCubic.name, () => {
    it("starts and ends slowly", () => {
      expect([0, 0.25, 0.5, 0.75, 1].map(easeInOutCubic)).toEqual([0, 0.0625, 0.5, 0.9375, 1]);
    });
  });

  describe(easeOutBack.name, () => {
    it("overshoots before settling", () => {
      expect(easeOutBack(0)).toBeCloseTo(0);
      expect(easeOutBack(0.5)).toBeCloseTo(1.0876975);
      expect(easeOutBack(1)).toBe(1);
    });
  });

  describe(clamp.name, () => {
    it("holds a value between its bounds", () => {
      expect([clamp(-2, -1, 1), clamp(0.5, -1, 1), clamp(3, -1, 1)]).toEqual([-1, 0.5, 1]);
    });
  });

  function expectVector(actual: readonly number[], expected: number[]) {
    expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value));
  }

  function expectPair(actual: [number, number], expected: [number, number]) {
    expect(actual[0]).toBeCloseTo(expected[0]);
    expect(actual[1]).toBeCloseTo(expected[1]);
  }
});
