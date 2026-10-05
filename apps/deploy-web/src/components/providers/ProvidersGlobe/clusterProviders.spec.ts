import { describe, expect, it } from "vitest";

import type { GlobeProvider } from "./clusterProviders";
import { clusterProviders, clusterRadiusForZoom, UNKNOWN_LOCATION_LABEL } from "./clusterProviders";

describe(clusterProviders.name, () => {
  it("merges providers that share a location into one pin labelled with that location", () => {
    const providers = [
      createProvider({ id: "akash1first", lat: 38.63, lng: -90.21, location: "Missouri, US", gpuCount: 4 }),
      createProvider({ id: "akash1second", lat: 38.64, lng: -90.2, location: "Missouri, US", gpuCount: 2 })
    ];

    const clusters = clusterProviders(providers, 1.2);

    expect(clusters).toEqual([
      {
        id: "cluster-akash1first",
        lat: expect.closeTo(38.635, 5),
        lng: expect.closeTo(-90.205, 5),
        providerIds: ["akash1first", "akash1second"],
        gpuCount: 6,
        label: "Missouri, US"
      }
    ]);
  });

  it("labels a pin by its provider count when its providers sit in different places", () => {
    const providers = [
      createProvider({ id: "akash1paris", lat: 48.86, lng: 2.35, location: "Île-de-France, FR" }),
      createProvider({ id: "akash1brussels", lat: 50.85, lng: 4.35, location: "Brussels, BE" })
    ];

    const [cluster] = clusterProviders(providers, 11.5);

    expect(cluster.label).toBe("2 providers");
  });

  it("keeps providers farther apart than the radius on separate pins", () => {
    const providers = [createProvider({ id: "akash1paris", lat: 48.86, lng: 2.35 }), createProvider({ id: "akash1brussels", lat: 50.85, lng: 4.35 })];

    const clusters = clusterProviders(providers, 1.2);

    expect(clusters.map(cluster => cluster.providerIds)).toEqual([["akash1brussels"], ["akash1paris"]]);
  });

  it("seeds each pin with the provider with the most GPUs, then the most vCPUs", () => {
    const providers = [
      createProvider({ id: "akash1small", lat: 0, lng: 0, gpuCount: 0, vcpuCount: 8 }),
      createProvider({ id: "akash1large", lat: 0.1, lng: 0.1, gpuCount: 0, vcpuCount: 64 }),
      createProvider({ id: "akash1gpu", lat: 30, lng: 30, gpuCount: 1, vcpuCount: 1 })
    ];

    const clusters = clusterProviders(providers, 1.2);

    expect(clusters.map(cluster => cluster.id)).toEqual(["cluster-akash1gpu", "cluster-akash1large"]);
    expect(clusters[1].providerIds).toEqual(["akash1large", "akash1small"]);
  });

  it("seeds a pin with its largest provider even when a smaller one has an earlier address", () => {
    const providers = [createProvider({ id: "akash1aaa", lat: 0, lng: 0, gpuCount: 0 }), createProvider({ id: "akash1zzz", lat: 0.1, lng: 0.1, gpuCount: 4 })];

    const clusters = clusterProviders(providers, 1.2);

    expect(clusters.map(cluster => cluster.id)).toEqual(["cluster-akash1zzz"]);
    expect(clusters[0].providerIds).toEqual(["akash1zzz", "akash1aaa"]);
  });

  it("merges providers at the very same spot even with a zero radius", () => {
    const providers = [
      createProvider({ id: "akash1first", lat: 0, lng: 0 }),
      createProvider({ id: "akash1second", lat: 0, lng: 0 }),
      createProvider({ id: "akash1elsewhere", lat: 0.1, lng: 0.1 })
    ];

    const clusters = clusterProviders(providers, 0);

    expect(clusters.map(cluster => cluster.providerIds)).toEqual([["akash1elsewhere"], ["akash1first", "akash1second"]]);
  });

  it("averages longitudes across the antimeridian onto the near side", () => {
    const providers = [createProvider({ id: "akash1east", lat: 0, lng: 179.5 }), createProvider({ id: "akash1west", lat: 0, lng: -179.5 })];

    const [cluster] = clusterProviders(providers, 2);

    expect(Math.abs(cluster.lng)).toBeCloseTo(180, 5);
  });

  it("labels a provider without a known location as such", () => {
    const [cluster] = clusterProviders([createProvider({ id: "akash1nowhere", location: null })], 1.2);

    expect(cluster.label).toBe(UNKNOWN_LOCATION_LABEL);
  });

  describe(clusterRadiusForZoom.name, () => {
    it("narrows the radius from 11.5° fully zoomed out to 1.2° fully zoomed in", () => {
      expect(clusterRadiusForZoom(0)).toBe(11.5);
      expect(clusterRadiusForZoom(0.5)).toBeCloseTo(6.35, 5);
      expect(clusterRadiusForZoom(1)).toBeCloseTo(1.2, 5);
    });

    it("clamps zoom levels outside the range", () => {
      expect(clusterRadiusForZoom(-1)).toBe(11.5);
      expect(clusterRadiusForZoom(2)).toBeCloseTo(1.2, 5);
    });
  });

  function createProvider(overrides: Partial<GlobeProvider> & { id: string }): GlobeProvider {
    return { lat: 0, lng: 0, location: "Somewhere, XX", gpuCount: 0, vcpuCount: 8, ...overrides };
  }
});
