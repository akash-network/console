import type { feature } from "topojson-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createLandCanvasLoader, LAND_TOPOLOGY_URL } from "./landTexture";

type Topology = Parameters<typeof feature>[0];

const GRID_STROKE = "stroke rgba(141,141,171,0.26) 2.6";
const LAND_FILL = "fill rgba(150,150,178,0.4)";
const LAND_STROKE = "stroke rgba(176,176,206,0.42) 3";
const PIXELS_PER_DEGREE = 4096 / 360;

describe(createLandCanvasLoader.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws the grid, then fills and outlines the land the topology describes on a 4096 by 2048 canvas", async () => {
    const { load, readOperations } = setup({ topology: Promise.resolve(createTopology()) });

    const canvas = await load();

    expect(canvas).toMatchObject({ width: 4096, height: 2048 });
    expect(readOperations()).toEqual(["beginPath", "trace", GRID_STROKE, "beginPath", "trace", LAND_FILL, "beginPath", "trace", LAND_STROKE]);
  });

  it("projects the land equirectangularly, with the null island at the centre of the canvas", async () => {
    const { load, paths } = setup({ topology: Promise.resolve(createTopology()) });

    await load();
    const [, landFill, landOutline] = paths;
    const tenDegrees = 10 * PIXELS_PER_DEGREE;
    const expectedSquare = [
      [2048, 1024],
      [2048, closeTo(1024 - tenDegrees)],
      [closeTo(2048 + tenDegrees), closeTo(1024 - tenDegrees)],
      [closeTo(2048 + tenDegrees), 1024]
    ];

    expect(landFill.slice(0, 4)).toEqual(expectedSquare);
    expect(landOutline.slice(0, 4)).toEqual(expectedSquare);
  });

  it("spreads the grid across the whole canvas", async () => {
    const { load, paths } = setup({ topology: Promise.resolve(createTopology()) });

    await load();
    const [grid] = paths;
    const xs = grid.map(([x]) => x);
    const ys = grid.map(([, y]) => y);

    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([closeTo(0), closeTo(4096), closeTo(0), closeTo(2048)]);
  });

  it("fetches and draws the land once, then reuses the drawing", async () => {
    const { load, fetchTopology } = setup({ topology: Promise.resolve(createTopology()) });

    const [first, second] = await Promise.all([load(), load()]);

    expect(first).toBe(second);
    expect(fetchTopology).toHaveBeenCalledTimes(1);
  });

  it("draws the grid alone when the land can't be fetched, and fetches it again next time", async () => {
    const { load, readOperations, fetchTopology } = setup({ topology: Promise.reject(new Error("offline")) });

    await load();
    await load();

    expect(readOperations()).toEqual(["beginPath", "trace", GRID_STROKE, "beginPath", "trace", GRID_STROKE]);
    expect(fetchTopology).toHaveBeenCalledTimes(2);
  });

  it("leaves the canvas blank when the browser can't draw on it", async () => {
    const { load, fetchTopology } = setup({ topology: Promise.resolve(createTopology()), canDraw: false });

    await load();

    expect(fetchTopology).not.toHaveBeenCalled();
  });

  it("fetches the land from the world atlas by default", async () => {
    const { readOperations } = setup({ topology: Promise.resolve(createTopology()) });
    const fetchAtlas = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(createTopology())));

    await createLandCanvasLoader()();

    expect(fetchAtlas).toHaveBeenCalledExactlyOnceWith(LAND_TOPOLOGY_URL);
    expect(readOperations()).toContain(LAND_FILL);
  });

  it("draws the grid alone when the world atlas answers with an error, and asks it again next time", async () => {
    const { readOperations } = setup({ topology: Promise.resolve(createTopology()) });
    const fetchAtlas = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(createTopology()), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(createTopology())));
    const load = createLandCanvasLoader();

    await load();
    expect(readOperations()).not.toContain(LAND_FILL);

    await load();
    expect(readOperations()).toContain(LAND_FILL);
    expect(fetchAtlas).toHaveBeenCalledTimes(2);
  });

  function closeTo(expected: number) {
    return expect.closeTo(expected, 4);
  }

  function createTopology(): Topology {
    return {
      type: "Topology",
      objects: { land: { type: "GeometryCollection", geometries: [{ type: "Polygon", arcs: [[0]] }] } },
      arcs: [
        [
          [0, 0],
          [0, 10],
          [10, 10],
          [10, 0],
          [0, 0]
        ]
      ]
    } as Topology;
  }

  function createRecordingContext() {
    const operations: string[] = [];
    const paths: [number, number][][] = [];
    const trace = (x: number, y: number) => {
      operations.push("trace");
      paths.at(-1)?.push([x, y]);
    };
    const context: CanvasRenderingContext2D = mock<CanvasRenderingContext2D>({
      beginPath: vi.fn(() => {
        operations.push("beginPath");
        paths.push([]);
      }),
      moveTo: vi.fn(trace),
      lineTo: vi.fn(trace),
      stroke: vi.fn(() => {
        operations.push(`stroke ${String(context.strokeStyle)} ${context.lineWidth}`);
      }),
      fill: vi.fn(() => {
        operations.push(`fill ${String(context.fillStyle)}`);
      })
    });

    return { context, paths, readOperations: () => operations.filter((operation, index) => operation !== operations[index - 1]) };
  }

  function setup(input: { topology: Promise<Topology>; canDraw?: boolean }) {
    const { context, paths, readOperations } = createRecordingContext();
    const drawableContext = input.canDraw === false ? null : context;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => (contextId === "2d" ? drawableContext : null));
    input.topology.catch(() => undefined);
    const fetchTopology = vi.fn(() => input.topology);

    return { load: createLandCanvasLoader(fetchTopology), fetchTopology, paths, readOperations };
  }
});
