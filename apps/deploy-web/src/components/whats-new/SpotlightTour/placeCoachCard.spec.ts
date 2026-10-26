import { describe, expect, it } from "vitest";

import { placeCoachCard } from "./placeCoachCard";

const VIEWPORT = { width: 1200, height: 800 };
const CARD = { width: 320, height: 190 };

describe(placeCoachCard.name, () => {
  it("puts the card below the target, centered on it, when it fits there", () => {
    const placement = placeCoachCard({ x: 500, y: 100, width: 100, height: 40 }, "bottom", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "bottom", x: 390, y: 154, arrowX: 160, arrowY: null });
  });

  it("puts the card above the target when that side is preferred and fits", () => {
    const placement = placeCoachCard({ x: 500, y: 400, width: 100, height: 40 }, "top", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "top", x: 390, y: 196, arrowX: 160, arrowY: null });
  });

  it("puts the card right of the target, centered on it vertically, when that side is preferred and fits", () => {
    const placement = placeCoachCard({ x: 100, y: 300, width: 200, height: 100 }, "right", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "right", x: 314, y: 255, arrowX: null, arrowY: 95 });
  });

  it("puts the card left of the target when that side is preferred and fits", () => {
    const placement = placeCoachCard({ x: 800, y: 300, width: 200, height: 100 }, "left", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "left", x: 466, y: 255, arrowX: null, arrowY: 95 });
  });

  it("falls back to the bottom when the preferred side has no room", () => {
    const placement = placeCoachCard({ x: 10, y: 100, width: 100, height: 40 }, "left", CARD, VIEWPORT);

    expect(placement.side).toBe("bottom");
  });

  it("falls back to the right when neither the preferred side nor the bottom has room", () => {
    const placement = placeCoachCard({ x: 100, y: 600, width: 100, height: 150 }, "left", CARD, VIEWPORT);

    expect(placement.side).toBe("right");
  });

  it("falls back to the left before the top", () => {
    const placement = placeCoachCard({ x: 800, y: 600, width: 300, height: 150 }, "bottom", CARD, VIEWPORT);

    expect(placement.side).toBe("left");
  });

  it("falls back to the top when it is the only side with room", () => {
    const placement = placeCoachCard({ x: 0, y: 600, width: 1200, height: 150 }, "bottom", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "top", x: 440, y: 396, arrowX: 160, arrowY: null });
  });

  it("pins the card to the bottom of the viewport when no side has room", () => {
    const placement = placeCoachCard({ x: 0, y: 100, width: 1200, height: 650 }, "bottom", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "none", x: 440, y: 602, arrowX: null, arrowY: null });
  });

  it("keeps the card inside the viewport and points its arrow at a target near the edge", () => {
    const placement = placeCoachCard({ x: 1150, y: 10, width: 40, height: 30 }, "bottom", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "bottom", x: 872, y: 54, arrowX: 298, arrowY: null });
  });

  it("keeps the arrow off the card's rounded corner when the target sits past it", () => {
    const placement = placeCoachCard({ x: 0, y: 10, width: 10, height: 30 }, "bottom", CARD, VIEWPORT);

    expect(placement).toMatchObject({ x: 8, arrowX: 18 });
  });

  it("keeps a side card inside the viewport vertically", () => {
    const placement = placeCoachCard({ x: 100, y: 0, width: 200, height: 20 }, "right", CARD, VIEWPORT);

    expect(placement).toEqual({ side: "right", x: 314, y: 8, arrowX: null, arrowY: 18 });
  });

  it("counts a card that exactly fits the margin as fitting", () => {
    const placement = placeCoachCard({ x: 500, y: 100, width: 100, height: 488 }, "bottom", CARD, VIEWPORT);

    expect(placement.side).toBe("bottom");
  });

  it("counts a card that exactly fits the top margin as fitting", () => {
    const placement = placeCoachCard({ x: 0, y: 212, width: 1200, height: 600 }, "top", CARD, VIEWPORT);

    expect(placement.side).toBe("top");
  });

  it("counts a card that exactly fits beside the target as fitting", () => {
    expect(placeCoachCard({ x: 0, y: 300, width: 858, height: 100 }, "right", CARD, VIEWPORT).side).toBe("right");
    expect(placeCoachCard({ x: 342, y: 300, width: 858, height: 100 }, "left", CARD, VIEWPORT).side).toBe("left");
  });
});
