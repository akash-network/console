import { describe, expect, it } from "vitest";

import type { Hole } from "./spotlightHole";
import { blockersAround, glideHole, hasReached, holeAround, isSameHole, roundedRectPath, roundToPixels } from "./spotlightHole";

const HOLE: Hole = { x: 10, y: 20, width: 100, height: 50, radius: 8 };

describe("spotlightHole", () => {
  describe(holeAround.name, () => {
    it("pads the target's box on every side and rounds it with the step's radius", () => {
      expect(holeAround({ left: 10, top: 20, width: 100, height: 40 }, 6, 12)).toEqual({ x: 4, y: 14, width: 112, height: 52, radius: 12 });
    });
  });

  describe(glideHole.name, () => {
    it("moves every edge part of the way toward the goal, by an amount set by the time elapsed", () => {
      const goal: Hole = { x: 100, y: 200, width: 300, height: 400, radius: 20 };

      const next = glideHole({ x: 0, y: 0, width: 0, height: 0, radius: 0 }, goal, 0.085);

      const share = 1 - Math.exp(-1);
      expect(next.x).toBeCloseTo(100 * share);
      expect(next.y).toBeCloseTo(200 * share);
      expect(next.width).toBeCloseTo(300 * share);
      expect(next.height).toBeCloseTo(400 * share);
      expect(next.radius).toBeCloseTo(20 * share);
    });

    it("moves further the more time has passed", () => {
      const start: Hole = { x: 0, y: 0, width: 0, height: 0, radius: 0 };
      const goal: Hole = { x: 100, y: 100, width: 100, height: 100, radius: 10 };

      expect(glideHole(start, goal, 0.05).x).toBeGreaterThan(glideHole(start, goal, 0.01).x);
    });

    it("snaps an edge onto the goal once it is less than half a pixel away", () => {
      const next = glideHole({ ...HOLE, x: 99.7 }, { ...HOLE, x: 100 }, 0.001);

      expect(next.x).toBe(100);
    });

    it("keeps easing an edge that is still half a pixel away or more", () => {
      const next = glideHole({ ...HOLE, x: 0 }, { ...HOLE, x: 0.4 }, 0.085);

      expect(next.x).toBeCloseTo(0.4 * (1 - Math.exp(-1)));
    });

    it("snaps from either direction", () => {
      expect(glideHole({ ...HOLE, y: 100.3 }, { ...HOLE, y: 100 }, 0.001).y).toBe(100);
    });
  });

  describe(isSameHole.name, () => {
    it("treats two missing holes as the same", () => {
      expect(isSameHole(null, null)).toBe(true);
    });

    it("tells a missing hole from a shown one", () => {
      expect(isSameHole(null, HOLE)).toBe(false);
      expect(isSameHole(HOLE, null)).toBe(false);
    });

    it("treats holes with equal edges and radius as the same", () => {
      expect(isSameHole(HOLE, { ...HOLE })).toBe(true);
    });

    it.each(["x", "y", "width", "height", "radius"] as const)("tells holes apart by %s", edge => {
      expect(isSameHole(HOLE, { ...HOLE, [edge]: HOLE[edge] + 1 })).toBe(false);
    });
  });

  describe(hasReached.name, () => {
    it("counts a hole within three pixels of the goal on every edge as arrived", () => {
      expect(hasReached({ x: 12.9, y: 17.1, width: 102.9, height: 47.1, radius: 0 }, HOLE)).toBe(true);
    });

    it.each(["x", "y", "width", "height"] as const)("waits while %s is three pixels away or more", edge => {
      expect(hasReached({ ...HOLE, [edge]: HOLE[edge] + 3 }, HOLE)).toBe(false);
      expect(hasReached({ ...HOLE, [edge]: HOLE[edge] - 3 }, HOLE)).toBe(false);
    });

    it("ignores the radius", () => {
      expect(hasReached({ ...HOLE, radius: 40 }, HOLE)).toBe(true);
    });
  });

  describe(roundToPixels.name, () => {
    it("rounds the edges to whole pixels and leaves the radius as is", () => {
      expect(roundToPixels({ x: 10.4, y: 20.6, width: 99.5, height: 50.2, radius: 8.5 })).toEqual({ x: 10, y: 21, width: 100, height: 50, radius: 8.5 });
    });
  });

  describe(roundedRectPath.name, () => {
    it("draws a closed rounded rectangle", () => {
      expect(roundedRectPath(HOLE)).toBe("M18 20H102A8 8 0 0 1 110 28V62A8 8 0 0 1 102 70H18A8 8 0 0 1 10 62V28A8 8 0 0 1 18 20Z");
    });

    it("caps the radius at half the shorter side", () => {
      expect(roundedRectPath({ x: 0, y: 0, width: 20, height: 10, radius: 12 })).toBe(
        "M5 0H15A5 5 0 0 1 20 5V5A5 5 0 0 1 15 10H5A5 5 0 0 1 0 5V5A5 5 0 0 1 5 0Z"
      );
      expect(roundedRectPath({ x: 0, y: 0, width: 10, height: 20, radius: 12 })).toBe(
        "M5 0H5A5 5 0 0 1 10 5V15A5 5 0 0 1 5 20H5A5 5 0 0 1 0 15V5A5 5 0 0 1 5 0Z"
      );
    });

    it("draws square corners for a negative radius", () => {
      expect(roundedRectPath({ ...HOLE, radius: -4 })).toBe("M10 20H110A0 0 0 0 1 110 20V70A0 0 0 0 1 110 70H10A0 0 0 0 1 10 70V20A0 0 0 0 1 10 20Z");
    });
  });

  describe(blockersAround.name, () => {
    it("covers the screen above, below, left and right of the hole", () => {
      expect(blockersAround(HOLE)).toEqual([
        { left: 0, top: 0, right: 0, height: 20 },
        { left: 0, top: 70, right: 0, bottom: 0 },
        { left: 0, top: 20, width: 10, height: 50 },
        { left: 110, top: 20, right: 0, height: 50 }
      ]);
    });

    it("collapses the blockers above and left of a hole that starts off screen", () => {
      const [above, , left] = blockersAround({ ...HOLE, x: -5, y: -8 });

      expect(above.height).toBe(0);
      expect(left.width).toBe(0);
    });
  });
});
