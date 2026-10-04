import type { feature } from "topojson-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createLandCanvasLoader, LAND_TOPOLOGY_URL, loadLandCanvas } from "./landTexture";

type Topology = Parameters<typeof feature>[0];

describe(createLandCanvasLoader.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws the land the topology describes over the grid", async () => {
    const { load, context } = setup({ topology: Promise.resolve(createTopology()) });

    const canvas = await load();

    expect(canvas).toMatchObject({ width: 4096, height: 2048 });
    expect(context.fill).toHaveBeenCalledTimes(1);
    expect(context.stroke).toHaveBeenCalledTimes(2);
  });

  it("fetches and draws the land once, then reuses the drawing", async () => {
    const { load, fetchTopology } = setup({ topology: Promise.resolve(createTopology()) });

    const [first, second] = await Promise.all([load(), load()]);

    expect(first).toBe(second);
    expect(fetchTopology).toHaveBeenCalledTimes(1);
  });

  it("draws the grid alone when the land can't be fetched, and fetches it again next time", async () => {
    const { load, context, fetchTopology } = setup({ topology: Promise.reject(new Error("offline")) });

    await load();
    await load();

    expect(context.fill).not.toHaveBeenCalled();
    expect(context.stroke).toHaveBeenCalledTimes(2);
    expect(fetchTopology).toHaveBeenCalledTimes(2);
  });

  it("leaves the canvas blank when the browser can't draw on it", async () => {
    const { load, fetchTopology } = setup({ topology: Promise.resolve(createTopology()), canDraw: false });

    await load();

    expect(fetchTopology).not.toHaveBeenCalled();
  });

  it("loads the land from the world atlas", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mock<CanvasRenderingContext2D>());
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createTopology())));

    await loadLandCanvas();

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(LAND_TOPOLOGY_URL);
  });

  function createTopology(): Topology {
    return {
      type: "Topology",
      objects: { land: { type: "GeometryCollection", geometries: [{ type: "Polygon", arcs: [[0]] }] } },
      arcs: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0]
        ]
      ]
    } as Topology;
  }

  function setup(input: { topology: Promise<Topology>; canDraw?: boolean }) {
    const context = mock<CanvasRenderingContext2D>();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(input.canDraw === false ? null : context);
    input.topology.catch(() => undefined);
    const fetchTopology = vi.fn(() => input.topology);

    return { load: createLandCanvasLoader(fetchTopology), context, fetchTopology };
  }
});
