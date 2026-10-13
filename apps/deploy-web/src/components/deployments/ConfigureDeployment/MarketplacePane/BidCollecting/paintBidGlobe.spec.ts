import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GlobeShape } from "./bidGlobeScene";
import { projectOnGlobe, RADIANS_PER_DEGREE } from "./globeGeometry";
import type { GlobePicture } from "./paintBidGlobe";
import { createBidGlobePainter } from "./paintBidGlobe";

const FULL_TURN = Math.PI * 2;
const STATE_KEYS = ["fillStyle", "strokeStyle", "lineWidth", "lineCap", "globalAlpha", "shadowColor", "shadowBlur"] as const;

type DrawingState = Pick<CanvasRenderingContext2D, (typeof STATE_KEYS)[number]>;
type Operation = { op: string; args: unknown[]; state?: DrawingState };

describe(createBidGlobePainter.name, () => {
  it("shades a dark orb in the middle of the canvas with a violet glow", () => {
    const { paint, operations, gradients, createdGradients } = setup();

    paint(picture({}));

    expect(operations.slice(0, 3)).toEqual([op("save"), op("beginPath"), op("arc", 140, 140, expect.closeTo(112), 0, FULL_TURN)]);
    expect(gradients).toEqual([
      {
        args: [
          expect.closeTo(140 - 112 * 0.38),
          expect.closeTo(140 - 112 * 0.42),
          expect.closeTo(112 * 0.05),
          140,
          140,
          expect.closeTo(112 * 1.05)
        ],
        stops: [
          [0, "#2a2a3c"],
          [0.55, "#111119"],
          [1, "#07070b"]
        ]
      }
    ]);
    expect(operations[3]).toEqual({ op: "fill", args: [], state: expect.objectContaining({ shadowColor: "rgba(124,58,237,0.30)", shadowBlur: 22 }) });
    expect(operations[3].state?.fillStyle).toBe(createdGradients[0]);
    expect(operations[4]).toEqual(op("restore"));
  });

  it("scales the orb and its glow with the canvas", () => {
    const { paint, operations } = setup();

    paint(picture({ size: 560 }));

    expect(operations[2]).toEqual(op("arc", 280, 280, expect.closeTo(224), 0, FULL_TURN));
    expect(operations[3].state).toMatchObject({ shadowBlur: 44 });
  });

  it("draws a faint graticule without the orb's glow", () => {
    const { paint, strokes } = setup();

    paint(picture({}));

    expect(strokes()[0]).toMatchObject({ strokeStyle: "rgba(141,141,171,0.14)", lineWidth: 0.6, shadowBlur: 0, globalAlpha: 1 });
  });

  it("draws the land where the view turns it, at its fade-in opacity", () => {
    const { paint, operations, fills, strokes } = setup();
    const view = { centerLng: 0.5, tilt: 0.38 };
    const expected = projectOnGlobe(view, 40 * RADIANS_PER_DEGREE, 20 * RADIANS_PER_DEGREE);

    paint(picture({ view, land: { shape: { type: "Point", coordinates: [40, 20] }, opacity: 0.5 } }));

    const landPoint = operations.find(operation => operation.op === "arc" && operation.args[2] === 4.5);
    expect(landPoint?.args.slice(0, 2)).toEqual([expect.closeTo(140 + 112 * expected.x), expect.closeTo(140 - 112 * expected.y)]);
    expect(fills()[1]).toMatchObject({ fillStyle: "rgba(150,150,178,0.32)", globalAlpha: 0.5 });
    expect(strokes()[1]).toMatchObject({ strokeStyle: "rgba(176,176,206,0.34)", lineWidth: 0.5, globalAlpha: 0.5 });
  });

  it("draws no land until it loads", () => {
    const { paint, fills } = setup();

    paint(picture({ land: null }));

    expect(fills()).toHaveLength(1);
  });

  it("outlines the orb's rim at full opacity after the land", () => {
    const { paint, operations } = setup();

    paint(picture({ land: { shape: { type: "Sphere" }, opacity: 0.3 } }));

    expect(operations.slice(-3)).toEqual([
      op("beginPath"),
      op("arc", 140, 140, expect.closeTo(112), 0, FULL_TURN),
      { op: "stroke", args: [], state: expect.objectContaining({ strokeStyle: "rgba(201,138,232,0.30)", lineWidth: 1, globalAlpha: 1 }) }
    ]);
  });

  it("paints the overlay's dots, rings and segments on top, each in its own state", () => {
    const { paint, operations } = setup();
    const shapes: GlobeShape[] = [
      { kind: "dot", x: 10, y: 20, radius: 3, color: "#abcdef", opacity: 0.5 },
      { kind: "dot", x: 30, y: 40, radius: 2, color: "#ffffff", opacity: 1, glow: { color: "rgba(255,255,255,0.8)", blur: 6 } },
      { kind: "ring", x: 50, y: 60, radiusX: 4, radiusY: 8, rotation: 0.3, color: "rgba(1,2,3,0.500)" },
      { kind: "segment", fromX: 1, fromY: 2, toX: 3, toY: 4, width: 1.25, color: "rgba(4,5,6,0.900)" }
    ];

    paint(picture({ shapes }));

    expect(operations.slice(-21)).toEqual([
      op("save"),
      op("beginPath"),
      op("arc", 10, 20, 3, 0, FULL_TURN),
      { op: "fill", args: [], state: expect.objectContaining({ fillStyle: "#abcdef", globalAlpha: 0.5, shadowBlur: 0 }) },
      op("restore"),
      op("save"),
      op("beginPath"),
      op("arc", 30, 40, 2, 0, FULL_TURN),
      { op: "fill", args: [], state: expect.objectContaining({ fillStyle: "#ffffff", globalAlpha: 1, shadowColor: "rgba(255,255,255,0.8)", shadowBlur: 6 }) },
      op("restore"),
      op("save"),
      op("beginPath"),
      op("ellipse", 50, 60, 4, 8, 0.3, 0, FULL_TURN),
      { op: "stroke", args: [], state: expect.objectContaining({ strokeStyle: "rgba(1,2,3,0.500)", lineWidth: 1, shadowBlur: 0 }) },
      op("restore"),
      op("save"),
      op("beginPath"),
      op("moveTo", 1, 2),
      op("lineTo", 3, 4),
      { op: "stroke", args: [], state: expect.objectContaining({ strokeStyle: "rgba(4,5,6,0.900)", lineWidth: 1.25, lineCap: "round" }) },
      op("restore")
    ]);
  });

  function op(name: string, ...args: unknown[]): Operation {
    return { op: name, args };
  }

  function picture(overrides: Partial<GlobePicture>): GlobePicture {
    return { size: 280, view: { centerLng: 0, tilt: 0.38 }, land: null, shapes: [], ...overrides };
  }

  function setup() {
    const operations: Operation[] = [];
    const gradients: Array<{ args: number[]; stops: Array<[number, string]> }> = [];
    const createdGradients: CanvasGradient[] = [];
    const savedStates: DrawingState[] = [];
    const readState = (): DrawingState => Object.fromEntries(STATE_KEYS.map(key => [key, context[key]])) as DrawingState;
    const record =
      (name: string, withState = false) =>
      (...args: unknown[]) => {
        operations.push(withState ? { op: name, args, state: readState() } : { op: name, args });
      };
    const context: CanvasRenderingContext2D = Object.assign(mock<CanvasRenderingContext2D>(), {
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      lineCap: "butt" as CanvasLineCap,
      globalAlpha: 1,
      shadowColor: "rgba(0, 0, 0, 0)",
      shadowBlur: 0,
      save: vi.fn(() => {
        savedStates.push(readState());
        operations.push(op("save"));
      }),
      restore: vi.fn(() => {
        Object.assign(context, savedStates.pop());
        operations.push(op("restore"));
      }),
      beginPath: vi.fn(record("beginPath")),
      arc: vi.fn(record("arc")),
      ellipse: vi.fn(record("ellipse")),
      moveTo: vi.fn(record("moveTo")),
      lineTo: vi.fn(record("lineTo")),
      closePath: vi.fn(record("closePath")),
      fill: vi.fn(record("fill", true)),
      stroke: vi.fn(record("stroke", true)),
      createRadialGradient: vi.fn((...args: number[]) => {
        const gradient = { args, stops: [] as Array<[number, string]> };
        gradients.push(gradient);
        const created = mock<CanvasGradient>({ addColorStop: vi.fn((offset: number, color: string) => void gradient.stops.push([offset, color])) });
        createdGradients.push(created);
        return created;
      })
    });
    const paint = createBidGlobePainter(context);
    const statesOf = (name: string) => operations.filter(operation => operation.op === name).map(operation => operation.state);

    return { paint, operations, gradients, createdGradients, fills: () => statesOf("fill"), strokes: () => statesOf("stroke") };
  }
});
