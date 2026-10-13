import type { GeoPermissibleObjects } from "d3-geo";
import type { feature } from "topojson-client";
import { describe, expect, it, vi } from "vitest";

import { createLandShapeLoader, useLandShape } from "./useLandShape";

import { renderHook, waitFor } from "@testing-library/react";

type Topology = Parameters<typeof feature>[0];

const TOPOLOGY = {
  type: "Topology",
  arcs: [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0]
    ]
  ],
  objects: { land: { type: "GeometryCollection", geometries: [{ type: "Polygon", arcs: [[0]] }] } }
} as Topology;

describe(createLandShapeLoader.name, () => {
  it("turns the land topology into a shape d3 can draw", async () => {
    const load = createLandShapeLoader(() => Promise.resolve(TOPOLOGY));

    await expect(load()).resolves.toMatchObject({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon" } }] });
  });

  it("fetches the topology once for every globe on the page", async () => {
    const fetchTopology = vi.fn(() => Promise.resolve(TOPOLOGY));
    const load = createLandShapeLoader(fetchTopology);

    const [first, second] = await Promise.all([load(), load()]);

    expect(second).toBe(first);
    expect(fetchTopology).toHaveBeenCalledTimes(1);
  });

  it("fetches again after a failed fetch", async () => {
    const fetchTopology = vi.fn<() => Promise<Topology>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(TOPOLOGY);
    const load = createLandShapeLoader(fetchTopology);

    await expect(load()).rejects.toThrow("offline");
    await expect(load()).resolves.toMatchObject({ type: "FeatureCollection" });
    expect(fetchTopology).toHaveBeenCalledTimes(2);
  });
});

describe(useLandShape.name, () => {
  it("has no land until it loads", async () => {
    const shape: GeoPermissibleObjects = { type: "Sphere" };
    const { result } = renderHook(() => useLandShape(() => Promise.resolve(shape)));

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(shape));
  });

  it("keeps drawing without land when it never loads", async () => {
    const load = vi.fn(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useLandShape(load));

    await waitFor(() => expect(load).toHaveBeenCalled());
    await Promise.resolve();

    expect(result.current).toBeNull();
  });

  it("ignores land that arrives after the globe is gone", async () => {
    let resolveLand: (shape: GeoPermissibleObjects) => void = () => undefined;
    const { result, unmount } = renderHook(() => useLandShape(() => new Promise(resolve => (resolveLand = resolve))));

    unmount();
    resolveLand({ type: "Sphere" });
    await Promise.resolve();

    expect(result.current).toBeNull();
  });
});
