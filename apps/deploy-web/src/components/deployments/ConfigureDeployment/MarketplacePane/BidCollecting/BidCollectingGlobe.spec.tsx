import type { GeoPermissibleObjects } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./BidCollectingGlobe";
import { BidCollectingGlobe } from "./BidCollectingGlobe";
import type { LocatedProvider } from "./bidGlobeScene";

import { act, render } from "@testing-library/react";

const NORTH: LocatedProvider = { id: "north", lat: 40, lng: 20 };
const PIN_DIM = "#6b5c7d";
const PIN_LIT = "#d9b6f7";
const LAND = "rgba(150,150,178,0.32)";
const BID_ANSWER_HEAD = "#d1fae5";

describe(BidCollectingGlobe.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
  });

  it("hides the decorative canvas from assistive technology", () => {
    const { container } = setup({});

    expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([
    { pixelRatio: 1, width: 280 },
    { pixelRatio: 1.5, width: 420 },
    { pixelRatio: 3, width: 560 }
  ])("backs the canvas with $width pixels at a pixel ratio of $pixelRatio", ({ pixelRatio, width }) => {
    const { container, context, playTo } = setup({ pixelRatio });

    playTo(0);

    expect(container.querySelector("canvas")).toMatchObject({ width, height: width });
    expect(context.setTransform).toHaveBeenCalledWith(Math.min(2, pixelRatio), 0, 0, Math.min(2, pixelRatio), 0, 0);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 280, 280);
  });

  it("paints a frame on every animation frame and stops once unmounted", () => {
    const { frames, playTo, unmount } = setup({});

    playTo(0);
    playTo(0.1);
    unmount();

    expect(frames.cancelled).toEqual([frames.requested.at(-1)]);
  });

  it("draws the providers as pins", () => {
    const { fills, playTo } = setup({ providers: [NORTH] });

    playTo(0);

    expect(fills().some(fill => fill.fillStyle === PIN_DIM)).toBe(true);
  });

  it("keeps lit pins lit when the same providers come back in a new list", () => {
    const { fills, playTo, rerender, clearDrawing } = setup({ providers: [NORTH] });
    playTo(1.6);
    clearDrawing();

    rerender({ providers: [{ ...NORTH }] });
    playTo(1.65);

    expect(fills().some(fill => fill.fillStyle === PIN_LIT)).toBe(true);
  });

  it("starts over for another placement", () => {
    const { fills, playTo, rerender, clearDrawing } = setup({ providers: [NORTH] });
    playTo(1.6);
    clearDrawing();

    rerender({ providers: [NORTH], seed: "placement-2" });
    playTo(1.65);

    expect(fills().filter(fill => fill.fillStyle === PIN_LIT)).toEqual([]);
  });

  it("pops the bidder in green once its bid lands", () => {
    const { fills, playTo, rerender } = setup({ providers: [NORTH] });
    playTo(0.5);

    rerender({ providers: [NORTH], bidderId: "north" });
    playTo(0.6);

    expect(fills().some(fill => fill.fillStyle === "rgba(52,211,153,1.000)")).toBe(true);
  });

  it("fades the land in over 0.4 s once it loads", () => {
    const { fills, playTo, frameAt, rerender } = setup({});
    playTo(0.5);

    rerender({ landShape: { type: "Point", coordinates: [40, 47] } });
    frameAt(0.6);
    frameAt(0.8);

    expect(fills().filter(fill => fill.fillStyle === LAND).map(fill => fill.globalAlpha)).toEqual([0, expect.closeTo(0.5)]);
  });

  it("draws a still frame four times a second when motion is reduced", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { fills, strokes, frames, playTo, unmount } = setup({ providers: [NORTH], isStill: true });

    playTo(5);
    expect(frames.requested).toHaveLength(1);
    expect(fills().some(fill => fill.fillStyle === PIN_LIT)).toBe(true);
    expect(strokes().filter(stroke => /^rgba\(201,138,232,0\.\d{3}\)$/.test(String(stroke.strokeStyle)))).toEqual([]);

    act(() => vi.advanceTimersByTime(249));
    expect(frames.requested).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(frames.requested).toHaveLength(2);

    playTo(6);
    unmount();
    act(() => vi.advanceTimersByTime(250));
    expect(frames.requested).toHaveLength(2);
  });

  it("sends the bidder's answer travelling back while motion is on", () => {
    const { fills, playTo, rerender } = setup({ providers: [NORTH] });
    playTo(0.5);

    rerender({ providers: [NORTH], bidderId: "north" });
    playTo(0.85);

    expect(fills().some(fill => fill.fillStyle === BID_ANSWER_HEAD)).toBe(true);
  });

  it("shows the bidder's answer already settled when motion is reduced", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { fills, strokes, frameAt, rerender, clearDrawing } = setup({ providers: [NORTH], isStill: true });
    frameAt(1);

    rerender({ providers: [NORTH], bidderId: "north" });
    clearDrawing();
    act(() => vi.advanceTimersByTime(250));
    frameAt(1.25);

    expect(strokes().some(stroke => stroke.strokeStyle === "rgba(52,211,153,0.950)")).toBe(true);
    expect(fills().filter(fill => fill.fillStyle === BID_ANSWER_HEAD)).toEqual([]);
  });

  it("shows the land at once when motion is reduced", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { fills, frameAt } = setup({ isStill: true, landShape: { type: "Point", coordinates: [40, 47] } });

    frameAt(1);

    expect(fills().filter(fill => fill.fillStyle === LAND).map(fill => fill.globalAlpha)).toEqual([1]);
  });

  it("draws nothing when the browser has no 2D canvas", () => {
    const { frames } = setup({ hasContext: false });

    expect(frames.requested).toEqual([]);
  });

  function setup(input: {
    providers?: LocatedProvider[];
    bidderId?: string | null;
    seed?: string;
    landShape?: GeoPermissibleObjects | null;
    isStill?: boolean;
    pixelRatio?: number;
    hasContext?: boolean;
  }) {
    const drawn: Array<{ op: "fill" | "stroke"; fillStyle: unknown; strokeStyle: unknown; globalAlpha: number }> = [];
    const saved: Array<Pick<CanvasRenderingContext2D, "fillStyle" | "strokeStyle" | "globalAlpha">> = [];
    const context: CanvasRenderingContext2D = Object.assign(mock<CanvasRenderingContext2D>(), {
      fillStyle: "#000000",
      strokeStyle: "#000000",
      globalAlpha: 1,
      save: vi.fn(() => saved.push({ fillStyle: context.fillStyle, strokeStyle: context.strokeStyle, globalAlpha: context.globalAlpha })),
      restore: vi.fn(() => Object.assign(context, saved.pop())),
      fill: vi.fn(() => drawn.push({ op: "fill", fillStyle: context.fillStyle, strokeStyle: context.strokeStyle, globalAlpha: context.globalAlpha })),
      stroke: vi.fn(() => drawn.push({ op: "stroke", fillStyle: context.fillStyle, strokeStyle: context.strokeStyle, globalAlpha: context.globalAlpha })),
      createRadialGradient: vi.fn(() => mock<CanvasGradient>())
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue((input.hasContext === false ? null : context) as never);
    vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(0);
    vi.spyOn(performance, "now").mockReturnValue(0);
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: input.pixelRatio ?? 1 });

    const frames = { pending: [] as Array<{ id: number; callback: FrameRequestCallback }>, requested: [] as number[], cancelled: [] as number[] };
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      const id = frames.requested.length + 1;
      frames.requested.push(id);
      frames.pending.push({ id, callback });
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => {
      frames.cancelled.push(id);
    });

    let props = { providers: input.providers ?? [], bidderId: input.bidderId ?? null, seed: input.seed ?? "placement-1", landShape: input.landShape ?? null };
    const globe = () => {
      const dependencies: typeof DEPENDENCIES = { useLandShape: () => props.landShape, useReducedMotion: () => input.isStill ?? false };
      return <BidCollectingGlobe providers={props.providers} bidderId={props.bidderId} seed={props.seed} dependencies={dependencies} />;
    };
    const rendered = render(globe());
    let now = 0;
    const frameAt = (seconds: number) => {
      now = seconds;
      const due = frames.pending.splice(0);
      act(() => due.forEach(frame => frame.callback(seconds * 1000)));
    };

    return {
      container: rendered.container,
      context,
      frames,
      unmount: rendered.unmount,
      clearDrawing: () => drawn.splice(0),
      fills: () => drawn.filter(entry => entry.op === "fill"),
      strokes: () => drawn.filter(entry => entry.op === "stroke"),
      rerender: (overrides: Partial<typeof props>) => {
        props = { ...props, ...overrides };
        rendered.rerender(globe());
      },
      frameAt,
      playTo: (seconds: number) => {
        while (now + 0.05 < seconds) frameAt(now + 0.05);
        frameAt(seconds);
      }
    };
  }
});
