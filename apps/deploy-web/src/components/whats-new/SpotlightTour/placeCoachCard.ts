export type CoachSide = "top" | "bottom" | "left" | "right";

export type Box = { x: number; y: number; width: number; height: number };

type Size = { width: number; height: number };

export type CoachPlacement = {
  side: CoachSide | "none";
  x: number;
  y: number;
  /** Where the arrow meets the card, measured along the edge that faces the target; null on the other axis. */
  arrowX: number | null;
  arrowY: number | null;
};

const GAP_TO_TARGET = 14;
const VIEWPORT_MARGIN = 8;
const MIN_ARROW_INSET = 18;

/** The preferred side when the card fits there, then the first side that fits, else pinned to the bottom of the viewport. */
export function placeCoachCard(target: Box, preferred: CoachSide, card: Size, viewport: Size): CoachPlacement {
  const fits: Record<CoachSide, boolean> = {
    bottom: target.y + target.height + GAP_TO_TARGET + card.height <= viewport.height - VIEWPORT_MARGIN,
    top: target.y - GAP_TO_TARGET - card.height >= VIEWPORT_MARGIN,
    right: target.x + target.width + GAP_TO_TARGET + card.width <= viewport.width - VIEWPORT_MARGIN,
    left: target.x - GAP_TO_TARGET - card.width >= VIEWPORT_MARGIN
  };
  const side = ([preferred, "bottom", "right", "left", "top"] as const).find(candidate => fits[candidate]) ?? "none";
  const centeredX = clamp(target.x + target.width / 2 - card.width / 2, VIEWPORT_MARGIN, viewport.width - card.width - VIEWPORT_MARGIN);
  const centeredY = clamp(target.y + target.height / 2 - card.height / 2, VIEWPORT_MARGIN, viewport.height - card.height - VIEWPORT_MARGIN);

  if (side === "bottom" || side === "top") {
    const y = side === "bottom" ? target.y + target.height + GAP_TO_TARGET : target.y - GAP_TO_TARGET - card.height;
    return { side, x: centeredX, y, arrowX: arrowOffset(target.x + target.width / 2 - centeredX, card.width), arrowY: null };
  }

  if (side === "left" || side === "right") {
    const x = side === "right" ? target.x + target.width + GAP_TO_TARGET : target.x - GAP_TO_TARGET - card.width;
    return { side, x, y: centeredY, arrowX: null, arrowY: arrowOffset(target.y + target.height / 2 - centeredY, card.height) };
  }

  return { side, x: centeredX, y: viewport.height - card.height - VIEWPORT_MARGIN, arrowX: null, arrowY: null };
}

function arrowOffset(offsetToTargetCenter: number, cardEdgeLength: number) {
  return clamp(offsetToTargetCenter, MIN_ARROW_INSET, cardEdgeLength - MIN_ARROW_INSET);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
