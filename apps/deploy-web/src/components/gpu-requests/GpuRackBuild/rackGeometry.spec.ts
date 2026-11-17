import { describe, expect, it } from "vitest";

import {
  boxOf,
  boxPaths,
  cylinderPaths,
  faceRect,
  FLOOR,
  FLOOR_PEDESTAL_BOTTOM,
  insetPlan,
  pathOf,
  planCorners,
  project,
  projectOffset,
  ringPath,
  round,
  roundedTopRect,
  seamPath,
  sideRect,
  sideTextMatrix,
  slideFrom,
  topRect,
  VIEW
} from "./rackGeometry";

describe("rackGeometry", () => {
  describe(project.name, () => {
    it("draws +x down to the right, +y down to the left and +z straight up from the view's origin", () => {
      expect(project([0, 0, 0]).map(round)).toEqual([115, 145.39]);
      expect(project([10, 0, 0]).map(round)).toEqual([121.22, 148.5]);
      expect(project([0, 10, 0]).map(round)).toEqual([108.78, 148.5]);
      expect(project([0, 0, 10]).map(round)).toEqual([115, 137.77]);
    });

    it("fits the widest thing the room holds, the raised floor on its pedestals, inside the view's padding", () => {
      const { width, depth } = FLOOR;

      expect(project([0, depth, FLOOR_PEDESTAL_BOTTOM]).map(round)).toEqual([3, 213.58]);
      expect(project([width, 0, FLOOR_PEDESTAL_BOTTOM]).map(round)).toEqual([VIEW.width - 3, 213.58]);
      expect(project([width, depth, FLOOR_PEDESTAL_BOTTOM])[1]).toBeLessThan(VIEW.height - 3);
    });
  });

  describe(projectOffset.name, () => {
    it("turns a world offset into the distance it covers on screen", () => {
      expect(projectOffset(10, 0, 0).map(round)).toEqual([6.22, 3.11]);
      expect(projectOffset(0, 10, 0).map(round)).toEqual([-6.22, 3.11]);
      expect(projectOffset(0, 0, 10).map(round)).toEqual([0, -7.62]);
    });
  });

  describe(round.name, () => {
    it("keeps two decimals", () => {
      expect(round(1.23456)).toBe(1.23);
      expect(round(-0.005)).toBe(-0);
    });
  });

  describe(pathOf.name, () => {
    it("moves to the first point, draws lines to the rest and closes the shape on request", () => {
      expect(
        pathOf([
          [0, 0, 0],
          [10, 0, 0]
        ])
      ).toBe("M115 145.39L121.22 148.5");
      expect(
        pathOf(
          [
            [0, 0, 0],
            [0, 0, 10]
          ],
          true
        )
      ).toBe("M115 145.39L115 137.77Z");
    });
  });

  describe("rectangles", () => {
    it("lays one on a front face at its depth", () => {
      expect(faceRect(1, 2, 3, 4, 5)).toEqual([
        [1, 5, 3],
        [2, 5, 3],
        [2, 5, 4],
        [1, 5, 4]
      ]);
    });

    it("lays one on a side face at its x", () => {
      expect(sideRect(1, 2, 3, 4, 5)).toEqual([
        [5, 1, 3],
        [5, 2, 3],
        [5, 2, 4],
        [5, 1, 4]
      ]);
    });

    it("lays one flat over a plan at its height", () => {
      expect(topRect({ x: 1, y: 2, width: 10, depth: 20 }, 5)).toEqual([
        [1, 2, 5],
        [11, 2, 5],
        [11, 22, 5],
        [1, 22, 5]
      ]);
    });

    it("rounds the corners of a flat one, walking each quarter turn in four steps", () => {
      const points = roundedTopRect({ x: 0, y: 0, width: 10, depth: 4 }, 2, 7).map(point => point.map(round));

      expect(points).toHaveLength(20);
      expect(points.slice(0, 5)).toEqual([
        [8, 0, 7],
        [8.77, 0.15, 7],
        [9.41, 0.59, 7],
        [9.85, 1.23, 7],
        [10, 2, 7]
      ]);
      expect(points.filter((_, index) => index % 5 === 4)).toEqual([
        [10, 2, 7],
        [8, 4, 7],
        [0, 2, 7],
        [2, 0, 7]
      ]);
    });
  });

  describe("plans", () => {
    it("stands a box on a plan", () => {
      expect(boxOf({ x: 1, y: 2, width: 3, depth: 4 }, 5, 6)).toEqual([1, 2, 5, 3, 4, 6]);
    });

    it("shrinks a plan by an inset and grows it by a negative one", () => {
      expect(insetPlan({ x: 10, y: 20, width: 30, depth: 40 }, 2)).toEqual({ x: 12, y: 22, width: 26, depth: 36 });
      expect(insetPlan({ x: 10, y: 20, width: 30, depth: 40 }, -1.5)).toEqual({ x: 8.5, y: 18.5, width: 33, depth: 43 });
    });

    it("lists a plan's inset corners from the far one to the near one", () => {
      expect(planCorners({ x: 0, y: 0, width: 10, depth: 4 }, 1)).toEqual([
        [1, 1],
        [1, 3],
        [9, 1],
        [9, 3]
      ]);
      expect(planCorners({ x: 0, y: 0, width: 4, depth: 10 }, 1)).toEqual([
        [1, 1],
        [3, 1],
        [1, 9],
        [3, 9]
      ]);
    });

    it("runs a seam around the front and the side the camera sees", () => {
      expect(seamPath({ x: 0, y: 0, width: 10, depth: 20 }, 5)).toBe("M102.56 147.8L108.78 150.91L121.22 144.69");
    });
  });

  describe(boxPaths.name, () => {
    it("outlines a box, shades the faces the camera sees and creases where the top meets them", () => {
      expect(boxPaths([0, 0, 0, 10, 10, 10])).toEqual({
        outline: "M115 137.77L121.22 140.88L121.22 148.5L115 151.61L108.78 148.5L108.78 140.88Z",
        side: "M121.22 148.5L115 151.61L115 143.99L121.22 140.88Z",
        front: "M108.78 148.5L115 151.61L115 143.99L108.78 140.88Z",
        top: "M115 137.77L121.22 140.88L115 143.99L108.78 140.88Z",
        crease: "M108.78 140.88L115 143.99L121.22 140.88"
      });
    });

    it("places the box at its origin", () => {
      expect(boxPaths([10, 0, 0, 1, 1, 1]).top).toBe(pathOf(topRect({ x: 10, y: 0, width: 1, depth: 1 }, 1), true));
    });
  });

  describe(ringPath.name, () => {
    it("draws a flat circle as an ellipse twice as wide as it is tall", () => {
      expect(ringPath([0, 0], 10, 0)).toBe("M106.2 145.39A8.8 4.4 0 1 0 123.8 145.39A8.8 4.4 0 1 0 106.2 145.39Z");
    });

    it("centres the ring on its place at its height", () => {
      expect(ringPath([10, 0], 10, 10)).toBe("M112.42 140.88A8.8 4.4 0 1 0 130.02 140.88A8.8 4.4 0 1 0 112.42 140.88Z");
    });
  });

  describe(cylinderPaths.name, () => {
    it("drops the body from the top's width to the near half of the base, under a ring for its top", () => {
      expect(cylinderPaths([0, 0], 10, 0, 10)).toEqual({
        body: "M106.2 137.77L106.2 145.39A8.8 4.4 0 0 0 123.8 145.39L123.8 137.77Z",
        top: ringPath([0, 0], 10, 10)
      });
    });
  });

  describe(sideTextMatrix.name, () => {
    it("runs text along the wall and down it from the given point", () => {
      expect(sideTextMatrix([0, 0, 0])).toBe("matrix(0.622 -0.311 0 0.762 115 145.389)");
      expect(sideTextMatrix([10, 0, 10])).toBe("matrix(0.622 -0.311 0 0.762 121.222 140.879)");
    });
  });

  describe(slideFrom.name, () => {
    it("turns a world offset into screen offsets and a delay for the entry animation", () => {
      expect(slideFrom(0, 0, 10, 120)).toEqual({ "--slide-x": "0px", "--slide-y": "-7.62px", "--slide-delay": "120ms" });
      expect(slideFrom(10, 0, 0)).toEqual({ "--slide-x": "6.22px", "--slide-y": "3.11px", "--slide-delay": "0ms" });
    });
  });
});
