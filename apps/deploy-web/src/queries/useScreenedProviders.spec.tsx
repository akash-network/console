import { createProxy } from "@akashnetwork/react-query-proxy";
import { keepPreviousData, type UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AUDITOR } from "@src/utils/deploymentData/v1beta3";
import { setupQuery } from "../../tests/unit/query-client";
import type { ScreenedProvider, ScreenedProvidersResponse } from "./useScreenedProviders";
import { buildCatalogScreeningRequest, buildPlacementScreeningRequest, SCREENING_DEBOUNCE_MS, useScreenedProviders } from "./useScreenedProviders";

import { act, waitFor } from "@testing-library/react";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

const HELLO_WORLD_SDL = `---
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

describe("useScreenedProviders", () => {
  it("screens the given placement's group spec, audited-only", () => {
    const { useQuery } = setup({ placementName: "dcloud" });

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
        resources: expect.arrayContaining([expect.objectContaining({ count: 1 })])
      }),
      expect.anything()
    );
  });

  it("falls back to the full audited catalog (empty resources) when the SDL is invalid", () => {
    const { useQuery } = setup({ sdl: "foo: [unclosed", placementName: "dcloud" });

    expect(useQuery).toHaveBeenCalledWith(
      {
        requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
        resources: [],
        timezone: expect.any(String)
      },
      expect.anything()
    );
  });

  it("keeps the selected region as a location-region filter on the catalog fallback when the SDL is invalid", () => {
    const { useQuery } = setup({ sdl: "foo: [unclosed", placementName: "dcloud", region: "na-us-west" });

    expect(useQuery).toHaveBeenCalledWith(
      {
        requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [{ key: "location-region", value: "na-us-west" }] },
        resources: [],
        timezone: expect.any(String)
      },
      expect.anything()
    );
  });

  it("returns the screened providers from the query result", () => {
    const providers = [buildScreenedProvider()];
    const { result } = setup({ placementName: "dcloud", providers });

    expect(result.current.providers).toEqual(providers);
  });

  it("requests the previous data as a placeholder so the list refines in place instead of blanking", () => {
    const { useQuery } = setup({ placementName: "dcloud" });

    expect(useQuery).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ placeholderData: keepPreviousData }));
  });

  it("screens the first spec immediately, without waiting for the debounce", () => {
    const { useQuery } = setup({ placementName: "dcloud" });

    expect(useQuery).toHaveBeenCalledTimes(1);
    expect(lastRequest(useQuery).resources.length).toBeGreaterThan(0);
  });

  it("paces input changes so rapid edits do not change the screening request until they settle", () => {
    vi.useFakeTimers();
    try {
      const { useQuery, rerender } = setup({ sdl: "foo: [unclosed", placementName: "dcloud", region: "old" });
      expect(regionOf(lastRequest(useQuery))).toBe("old");

      rerender({ region: "new" });
      expect(regionOf(lastRequest(useQuery))).toBe("old");

      act(() => vi.advanceTimersByTime(SCREENING_DEBOUNCE_MS));

      expect(regionOf(lastRequest(useQuery))).toBe("new");
    } finally {
      vi.useRealTimers();
    }
  });

  function setup(input: { placementName: string; sdl?: string; region?: string; providers?: ScreenedProvider[] }) {
    const useQuery = vi.fn().mockReturnValue(
      mock<UseQueryResult<ScreenedProvidersResponse>>({
        data: { providers: input.providers ?? [] },
        isLoading: false,
        isError: false
      })
    );
    const api = { v1: { screenProviders: { useQuery } } } as unknown as ReturnType<
      NonNullable<NonNullable<NonNullable<Parameters<typeof setupQuery>[1]>["services"]>["api"]>
    >;

    const current = { sdl: input.sdl ?? HELLO_WORLD_SDL, placementName: input.placementName, region: input.region };
    const view = setupQuery(() => useScreenedProviders({ ...current }), { services: { api: () => api } });

    function rerender(next: { sdl?: string; region?: string }) {
      if (next.sdl !== undefined) current.sdl = next.sdl;
      if ("region" in next) current.region = next.region;
      view.rerender();
    }

    return { result: view.result, useQuery, rerender };
  }
});

describe("buildPlacementScreeningRequest", () => {
  it("builds an audited request from the matching placement group spec", () => {
    const request = buildPlacementScreeningRequest(HELLO_WORLD_SDL, "dcloud");

    expect(request).toMatchObject({ requirements: { signedBy: { allOf: [AUDITOR] } } });
    expect(request?.resources[0].resource.cpu.units.val).toBeTruthy();
  });

  it("returns null when the placement is not in the SDL", () => {
    expect(buildPlacementScreeningRequest(HELLO_WORLD_SDL, "missing")).toBeNull();
  });

  it("returns null when the SDL is invalid", () => {
    expect(buildPlacementScreeningRequest("foo: [unclosed", "dcloud")).toBeNull();
  });
});

describe("buildCatalogScreeningRequest", () => {
  it("requests the full audited catalog with no attributes when no region is given (any region)", () => {
    expect(buildCatalogScreeningRequest()).toEqual({
      requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
      resources: []
    });
  });

  it("adds the region as a location-region attribute constraint", () => {
    expect(buildCatalogScreeningRequest("na-ca-central")).toEqual({
      requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [{ key: "location-region", value: "na-ca-central" }] },
      resources: []
    });
  });
});

describe("useScreenedProviders — newest result wins", () => {
  it("never lets a slow response for a superseded spec overwrite the current providers", async () => {
    const newProvider = buildScreenedProvider({ hostUri: "https://new.example:8443" });
    const oldProvider = buildScreenedProvider({ hostUri: "https://old.example:8443" });
    const { result, screenForRegion, rerender } = setup();

    await waitFor(() => expect(screenForRegion("old")).toBeDefined());

    rerender("new");
    await waitFor(() => expect(screenForRegion("new")).toBeDefined());

    act(() => screenForRegion("new")!({ providers: [newProvider] }));
    await waitFor(() => expect(result.current.providers).toEqual([newProvider]));

    act(() => screenForRegion("old")!({ providers: [oldProvider] }));
    await waitFor(() => expect(screenForRegion("old")).toBeDefined());

    expect(result.current.providers).toEqual([newProvider]);
  });

  function setup() {
    const resolvers = new Map<string, (response: ScreenedProvidersResponse) => void>();
    const screenProviders = vi.fn(
      (request: { requirements: { attributes: Array<{ key: string; value: string }> } }) =>
        new Promise<ScreenedProvidersResponse>(resolve => {
          const region = request.requirements.attributes.find(attribute => attribute.key === "location-region")!.value;
          resolvers.set(region, resolve);
        })
    );
    const api = createProxy({ v1: { screenProviders } }) as unknown as ReturnType<
      NonNullable<NonNullable<NonNullable<Parameters<typeof setupQuery>[1]>["services"]>["api"]>
    >;

    const current = { region: "old" };
    const view = setupQuery(() => useScreenedProviders({ sdl: "foo: [unclosed", placementName: "dcloud", region: current.region }), {
      services: { api: () => api }
    });

    return {
      result: view.result,
      rerender(region: string) {
        current.region = region;
        view.rerender();
      },
      screenForRegion: (region: string) => resolvers.get(region)
    };
  }
});

/** The request object handed to react-query on the most recent render. */
function lastRequest(useQuery: ReturnType<typeof vi.fn>) {
  return useQuery.mock.lastCall![0] as { resources: unknown[]; requirements: { attributes: Array<{ key: string; value: string }> } };
}

/** The selected region encoded on a catalog-fallback request, or undefined when unset. */
function regionOf(request: ReturnType<typeof lastRequest>): string | undefined {
  return request.requirements.attributes.find(attribute => attribute.key === "location-region")?.value;
}
