import { createProxy } from "@akashnetwork/react-query-proxy";
import { keepPreviousData, type QueryObserverBaseResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AUDITOR } from "@src/utils/deploymentData/v1beta3";
import { setupQuery } from "../../tests/unit/query-client";
import type { KeyedScreeningRequest, ScreenedProvider, ScreenedProvidersResponse, ScreeningRequest } from "./useScreenedProviders";
import {
  buildCatalogScreeningRequest,
  buildPlacementScreeningRequest,
  SCREENING_DEBOUNCE_MS,
  toScreeningRequest,
  useScreenedProviderCounts,
  useScreenedProviders
} from "./useScreenedProviders";

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

  it("flags the spec invalid and returns no providers when the SDL can't be screened (no catalog fallback)", () => {
    const { result, useQuery } = setup({ sdl: "foo: [unclosed", placementName: "dcloud" });

    expect(result.current.isInvalid).toBe(true);
    expect(result.current.providers).toEqual([]);
    expect(useQuery.mock.lastCall![1]).toEqual(expect.objectContaining({ enabled: false }));
  });

  it("does not flag a valid spec invalid", () => {
    const { result } = setup({ placementName: "dcloud" });

    expect(result.current.isInvalid).toBe(false);
  });

  it("returns the screened providers from the query result", () => {
    const providers = [buildScreenedProvider()];
    const { result } = setup({ placementName: "dcloud", providers });

    expect(result.current.providers).toEqual(providers);
  });

  it("returns every screened provider when a single region is picked, since the spec already screens by it", () => {
    const providers = [buildScreenedProvider({ location: "eu-west" }), buildScreenedProvider({ location: null })];
    const { result } = setup({ placementName: "dcloud", providers, regions: ["eu-west"] });

    expect(result.current.providers).toEqual(providers);
  });

  it("keeps only the providers located in one of several picked regions", () => {
    const west = buildScreenedProvider({ location: "eu-west" });
    const usWest = buildScreenedProvider({ location: "na-us-west" });
    const providers = [west, buildScreenedProvider({ location: "eu-central" }), usWest, buildScreenedProvider({ location: null })];
    const { result } = setup({ placementName: "dcloud", providers, regions: ["eu-west", "na-us-west"] });

    expect(result.current.providers).toEqual([west, usWest]);
  });

  it("follows the picked regions as they change", () => {
    const west = buildScreenedProvider({ location: "eu-west" });
    const central = buildScreenedProvider({ location: "eu-central" });
    const { result, rerender } = setup({ placementName: "dcloud", providers: [west, central], regions: ["eu-west", "na-us-west"] });

    rerender({ regions: ["eu-central", "na-us-west"] });

    expect(result.current.providers).toEqual([central]);
  });

  it("reports a refresh while it re-screens with the previous providers still shown", () => {
    const { result } = setup({ placementName: "dcloud", isFetching: true, isPlaceholderData: true });

    expect(result.current.isRefreshing).toBe(true);
  });

  it.each([
    ["the first screening", { isFetching: true, isPlaceholderData: false }],
    ["a settled screening", { isFetching: false, isPlaceholderData: false }]
  ])("reports no refresh for %s", (_, state) => {
    const { result } = setup({ placementName: "dcloud", ...state });

    expect(result.current.isRefreshing).toBe(false);
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

  it("enables the screening query by default", () => {
    const { useQuery } = setup({ placementName: "dcloud" });

    expect(useQuery.mock.lastCall![1]).toEqual(expect.objectContaining({ enabled: true }));
  });

  it("disables the screening query when not enabled (locked)", () => {
    const { useQuery } = setup({ placementName: "dcloud", enabled: false });

    expect(useQuery.mock.lastCall![1]).toEqual(expect.objectContaining({ enabled: false }));
  });

  it("paces input changes so rapid edits do not change the screening request until they settle", () => {
    vi.useFakeTimers();
    try {
      const { useQuery, rerender } = setup({ sdl: sdlForRegion("old"), placementName: "dcloud" });
      expect(regionOf(lastRequest(useQuery))).toBe("old");

      rerender({ sdl: sdlForRegion("new") });
      expect(regionOf(lastRequest(useQuery))).toBe("old");

      act(() => vi.advanceTimersByTime(SCREENING_DEBOUNCE_MS));

      expect(regionOf(lastRequest(useQuery))).toBe("new");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a spec fixed mid-edit as loading rather than invalid until the edit is screened", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = setup({
        sdl: "foo: [unclosed",
        placementName: "dcloud",
        providers: [buildScreenedProvider()],
        isError: true,
        isFetching: true,
        isPlaceholderData: true
      });

      rerender({ sdl: HELLO_WORLD_SDL });

      expect(result.current).toEqual(expect.objectContaining({ isInvalid: false, isLoading: true, isError: false, isRefreshing: false, providers: [] }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns the screened providers once a fixed spec settles", () => {
    vi.useFakeTimers();
    try {
      const providers = [buildScreenedProvider()];
      const { result, rerender } = setup({ sdl: "foo: [unclosed", placementName: "dcloud", providers });

      rerender({ sdl: HELLO_WORLD_SDL });
      act(() => vi.advanceTimersByTime(SCREENING_DEBOUNCE_MS));

      expect(result.current).toEqual(expect.objectContaining({ isInvalid: false, isLoading: false, providers }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the previous providers until an edit that breaks the spec settles", () => {
    vi.useFakeTimers();
    try {
      const providers = [buildScreenedProvider()];
      const { result, rerender } = setup({ placementName: "dcloud", providers });

      rerender({ sdl: "foo: [unclosed" });
      expect(result.current).toEqual(expect.objectContaining({ isInvalid: false, providers }));

      act(() => vi.advanceTimersByTime(SCREENING_DEBOUNCE_MS));

      expect(result.current).toEqual(expect.objectContaining({ isInvalid: true, providers: [] }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a failed screening of a valid spec", () => {
    const { result } = setup({ placementName: "dcloud", isError: true });

    expect(result.current.isError).toBe(true);
  });

  it("returns no providers before the first screening answers", () => {
    const { result } = setup({ placementName: "dcloud", hasNoData: true });

    expect(result.current.providers).toEqual([]);
  });

  function setup(input: {
    placementName: string;
    sdl?: string;
    regions?: string[];
    providers?: ScreenedProvider[];
    enabled?: boolean;
    isFetching?: boolean;
    isPlaceholderData?: boolean;
    isError?: boolean;
    hasNoData?: boolean;
  }) {
    const useQuery = vi.fn().mockReturnValue(
      mock<QueryObserverBaseResult<ScreenedProvidersResponse>>({
        data: input.hasNoData ? undefined : { providers: input.providers ?? [] },
        isLoading: false,
        isError: input.isError ?? false,
        isFetching: input.isFetching ?? false,
        isPlaceholderData: input.isPlaceholderData ?? false
      })
    );
    const api = { v1: { screenProviders: { useQuery } } } as unknown as ReturnType<
      NonNullable<NonNullable<NonNullable<Parameters<typeof setupQuery>[1]>["services"]>["api"]>
    >;

    const current = { sdl: input.sdl ?? HELLO_WORLD_SDL, placementName: input.placementName, regions: input.regions, enabled: input.enabled };
    const view = setupQuery(() => useScreenedProviders({ ...current }), { services: { api: () => api } });

    function rerender(next: { sdl?: string; regions?: string[] }) {
      if (next.sdl !== undefined) current.sdl = next.sdl;
      if (next.regions !== undefined) current.regions = next.regions;
      view.rerender();
    }

    return { result: view.result, useQuery, rerender };
  }
});

const SMALL_PRESET_SDL_NO_IMAGE = `---
version: "2.0"
services:
  web:
    image: ""
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
          units: 1
        memory:
          size: 2Gi
        storage:
          size: 10Gi
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

describe("buildPlacementScreeningRequest", () => {
  it("builds an audited request from the matching placement group spec", () => {
    const request = buildPlacementScreeningRequest(HELLO_WORLD_SDL, "dcloud");

    expect(request).toMatchObject({ requirements: { signedBy: { allOf: [AUDITOR] } } });
    expect(request?.resources[0].resource.cpu.units.val).toBeTruthy();
  });

  it("substitutes a placeholder image so an image-less spec still screens its own resources", () => {
    const request = buildPlacementScreeningRequest(SMALL_PRESET_SDL_NO_IMAGE, "dcloud");

    expect(request).not.toBeNull();
    expect(request?.resources[0].resource.cpu.units.val).toBe("1000");
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

describe(toScreeningRequest.name, () => {
  it("adds the client's timezone to the placement's screening request", () => {
    expect(toScreeningRequest(HELLO_WORLD_SDL, "dcloud")).toEqual({
      ...buildPlacementScreeningRequest(HELLO_WORLD_SDL, "dcloud"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
  });

  it("returns null when the SDL can't be screened", () => {
    expect(toScreeningRequest("foo: [unclosed", "dcloud")).toBeNull();
  });
});

describe(useScreenedProviderCounts.name, () => {
  it("counts the providers each request screens to", async () => {
    const { result } = setup({ requests: [keyed("a", "west"), keyed("b", "east")], providersByRegion: { west: 2, east: 0 } });

    await waitFor(() =>
      expect(result.current.counts).toEqual([
        { count: 2, isLoading: false },
        { count: 0, isLoading: false }
      ])
    );
  });

  it("counts only the providers located in one of several picked regions", async () => {
    const { result } = setup({
      requests: [
        { ...keyed("a", "west"), regions: ["eu-west", "na-us-west"] },
        { ...keyed("b", "west"), regions: ["eu-west"] }
      ],
      providersByRegion: { west: 4 },
      providerLocations: ["eu-west", "eu-central", "na-us-west", null]
    });

    await waitFor(() =>
      expect(result.current.counts).toEqual([
        { count: 2, isLoading: false },
        { count: 4, isLoading: false }
      ])
    );
  });

  it("never sends a null request and counts it as unknown", async () => {
    const { result, screenProviders } = setup({ requests: [{ key: "a", request: null }, keyed("b", "west")], providersByRegion: { west: 1 } });

    await waitFor(() => expect(result.current.counts[1].count).toBe(1));
    expect(result.current.counts[0]).toEqual({ count: null, isLoading: false });
    expect(screenProviders).toHaveBeenCalledTimes(1);
  });

  it("reports a request as loading until it is screened", () => {
    const { result } = setup({ requests: [keyed("a", "west")], providersByRegion: {}, pendingRegions: ["west"] });

    expect(result.current.counts).toEqual([{ count: null, isLoading: true }]);
  });

  it("keeps a key's last count while its changed request is screened", async () => {
    const { result, rerender } = setup({ requests: [keyed("a", "west")], providersByRegion: { west: 2 }, pendingRegions: ["east"] });
    await waitFor(() => expect(result.current.counts[0].count).toBe(2));

    rerender([keyed("a", "east")]);

    await waitFor(() => expect(result.current.counts).toEqual([{ count: 2, isLoading: true }]));
  });

  it("gives a new key no count until its request is screened", async () => {
    const { result, rerender } = setup({ requests: [keyed("a", "west")], providersByRegion: { west: 2 }, pendingRegions: ["east"] });
    await waitFor(() => expect(result.current.counts[0].count).toBe(2));

    rerender([keyed("b", "east")]);

    await waitFor(() => expect(result.current.counts).toEqual([{ count: null, isLoading: true }]));
  });

  it("forgets the count of a request that can no longer be screened", async () => {
    const { result, rerender } = setup({ requests: [keyed("a", "west")], providersByRegion: { west: 2 } });
    await waitFor(() => expect(result.current.counts[0].count).toBe(2));

    rerender([{ key: "a", request: null }]);

    expect(result.current.counts).toEqual([{ count: null, isLoading: false }]);
  });

  it("reuses the screening the provider count already ran for the same spec", async () => {
    const { result, screenProviders } = setup({
      requests: [keyed("a", "west")],
      providersByRegion: { west: 3 },
      alongsideHeadline: sdlForRegion("west")
    });

    await waitFor(() => expect(result.current.counts[0].count).toBe(3));
    expect(result.current.headline.providers).toHaveLength(3);
    expect(screenProviders).toHaveBeenCalledTimes(1);
  });

  function setup(input: {
    requests: KeyedScreeningRequest[];
    providersByRegion: Record<string, number>;
    pendingRegions?: string[];
    alongsideHeadline?: string;
    providerLocations?: (string | null)[];
  }) {
    const screenProviders = vi.fn(async (request: ScreeningRequest): Promise<ScreenedProvidersResponse> => {
      const region = (request.requirements?.attributes ?? []).find(attribute => attribute.key === "location-region")!.value;
      if (input.pendingRegions?.includes(region)) return new Promise(() => {});
      return {
        providers: Array.from({ length: input.providersByRegion[region] }, (_, index) =>
          buildScreenedProvider(input.providerLocations ? { location: input.providerLocations[index] } : {})
        )
      };
    });
    const api = createProxy({ v1: { screenProviders } }) as unknown as ReturnType<
      NonNullable<NonNullable<NonNullable<Parameters<typeof setupQuery>[1]>["services"]>["api"]>
    >;

    const current = { requests: input.requests };
    const view = setupQuery(
      () => ({
        counts: useScreenedProviderCounts(current.requests),
        headline: useScreenedProviders({
          sdl: input.alongsideHeadline ?? HELLO_WORLD_SDL,
          placementName: "dcloud",
          enabled: input.alongsideHeadline !== undefined
        })
      }),
      { services: { api: () => api } }
    );

    function rerender(requests: KeyedScreeningRequest[]) {
      current.requests = requests;
      view.rerender();
    }

    return { result: view.result, screenProviders, rerender };
  }

  function keyed(key: string, region: string): KeyedScreeningRequest {
    return { key, request: toScreeningRequest(sdlForRegion(region), "dcloud") };
  }
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
    const view = setupQuery(() => useScreenedProviders({ sdl: sdlForRegion(current.region), placementName: "dcloud" }), {
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

/** The region encoded on a screening request (from the spec's `location-region` attribute), or undefined when unset. */
function regionOf(request: ReturnType<typeof lastRequest>): string | undefined {
  return request.requirements.attributes.find(attribute => attribute.key === "location-region")?.value;
}

/** A valid single-service SDL pinned to `region` via the placement's `location-region` attribute, so its screening request carries that region. */
function sdlForRegion(region: string): string {
  return `---
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
      attributes:
        location-region: ${region}
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
}
