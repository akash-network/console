import { describe, expect, it } from "vitest";

import { boxPaths, calloutEdge, faceRect, meshPath, pathOf, placeCallouts, project, round, slideFrom } from "./rackGeometry";

describe("rackGeometry", () => {
  describe(project.name, () => {
    it("draws +x down to the right, +y down to the left and +z straight up", () => {
      expect(project([10, 0, 0]).map(round)).toEqual([7.07, 3.54]);
      expect(project([0, 10, 0]).map(round)).toEqual([-7.07, 3.54]);
      expect(project([0, 0, 10]).map(round)).toEqual([0, -8.66]);
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
      ).toBe("M0 0L7.07 3.54");
      expect(
        pathOf(
          [
            [0, 0, 0],
            [0, 0, 10]
          ],
          true
        )
      ).toBe("M0 0L0 -8.66Z");
    });
  });

  describe(faceRect.name, () => {
    it("lays a rectangle on the face at the given depth", () => {
      expect(faceRect(1, 2, 3, 4, 5)).toEqual([
        [1, 5, 3],
        [2, 5, 3],
        [2, 5, 4],
        [1, 5, 4]
      ]);
    });
  });

  describe(boxPaths.name, () => {
    it("outlines a box and shades the faces the camera sees", () => {
      expect(boxPaths([0, 0, 0, 10, 10, 10])).toEqual({
        outline: "M0 -8.66L7.07 -5.12L7.07 3.54L0 7.07L-7.07 3.54L-7.07 -5.12Z",
        side: "M7.07 3.54L0 7.07L0 -1.59L7.07 -5.12Z",
        front: "M-7.07 3.54L0 7.07L0 -1.59L-7.07 -5.12Z",
        top: "M0 -8.66L7.07 -5.12L0 -1.59L-7.07 -5.12Z",
        edges: "M0 -8.66L7.07 -5.12L7.07 3.54L0 7.07L-7.07 3.54L-7.07 -5.12ZM-7.07 -5.12L0 -1.59L7.07 -5.12M0 -1.59L0 7.07"
      });
    });

    it("places the box at its origin", () => {
      expect(boxPaths([10, 0, 0, 1, 1, 1]).top).toBe(pathOf([[10, 0, 1], [11, 0, 1], [11, 1, 1], [10, 1, 1]], true));
    });
  });

  describe(meshPath.name, () => {
    it("crosses a wall with strands clipped to its frame", () => {
      expect(meshPath({ wall: "y", at: 0, from: 0, to: 10, bottom: 0, top: 10, step: 10 })).toBe(
        "M0 -4.33L3.54 -6.89M7.07 -0.79L3.54 -6.89" + "M3.54 1.77L7.07 -0.79M3.54 1.77L0 -4.33"
      );
    });

    it("draws on the x wall at its depth and skips strands too short to see", () => {
      const path = meshPath({ wall: "x", at: 5, from: 0, to: 10, bottom: 0, top: 10, step: 10 });

      expect(path.startsWith(pathOf([[5, 0, 5], [5, 5, 10]]))).toBe(true);
      expect(meshPath({ wall: "y", at: 0, from: 0, to: 0.2, bottom: 0, top: 0.2, step: 1 })).toBe("");
    });
  });

  describe(slideFrom.name, () => {
    it("turns a world offset into screen offsets and a delay for the entry animation", () => {
      expect(slideFrom(0, 0, 10, 120)).toEqual({ "--slide-x": "0px", "--slide-y": "-8.66px", "--slide-delay": "120ms" });
      expect(slideFrom(10, 0, 0)).toEqual({ "--slide-x": "7.07px", "--slide-y": "3.54px", "--slide-delay": "0ms" });
    });
  });

  describe(placeCallouts.name, () => {
    it("keeps callouts level with their anchors when they have room", () => {
      expect(
        placeCallouts([
          { id: "high", at: [0, 0, 100] },
          { id: "low", at: [0, 0, 0] }
        ])
      ).toEqual([
        { id: "high", anchorX: 0, anchorY: -86.60254037844386, y: -86.60254037844386 },
        { id: "low", anchorX: 0, anchorY: 0, y: 0 }
      ]);
    });

    it("pushes crowded callouts apart from the top down", () => {
      const placed = placeCallouts([
        { id: "second", at: [0, 0, 0] },
        { id: "first", at: [0, 0, 10] }
      ]);

      expect(placed.map(({ id, y }) => [id, round(y)])).toEqual([
        ["first", -8.66],
        ["second", 41.34]
      ]);
    });

    it("lifts the column when its last callout would leave the view", () => {
      const placed = placeCallouts([
        { id: "top", at: [100, 100, 0] },
        { id: "bottom", at: [100, 100, -10] }
      ]);

      expect(placed.map(({ id, y }) => [id, round(y)])).toEqual([
        ["top", 46],
        ["bottom", 96]
      ]);
    });
  });

  describe(calloutEdge.name, () => {
    it("starts leaders at the inner edge of each callout column", () => {
      expect(calloutEdge("left")).toBeCloseTo(-70);
      expect(calloutEdge("right")).toBeCloseTo(60);
    });
  });
});
