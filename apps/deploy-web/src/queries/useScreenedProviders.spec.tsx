import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AUDITOR } from "@src/utils/deploymentData/v1beta3";
import { setupQuery } from "../../tests/unit/query-client";
import type { ScreenedProvider, ScreenedProvidersResponse } from "./useScreenedProviders";
import { buildCatalogScreeningRequest, buildPlacementScreeningRequest, useScreenedProviders } from "./useScreenedProviders";

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
      })
    );
  });

  it("falls back to the full audited catalog (empty resources) when the SDL is invalid", () => {
    const { useQuery } = setup({ sdl: "foo: [unclosed", placementName: "dcloud" });

    expect(useQuery).toHaveBeenCalledWith({
      requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
      resources: [],
      timezone: expect.any(String)
    });
  });

  it("keeps the selected region as a location-region filter on the catalog fallback when the SDL is invalid", () => {
    const { useQuery } = setup({ sdl: "foo: [unclosed", placementName: "dcloud", region: "na-us-west" });

    expect(useQuery).toHaveBeenCalledWith({
      requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [{ key: "location-region", value: "na-us-west" }] },
      resources: [],
      timezone: expect.any(String)
    });
  });

  it("returns the screened providers from the query result", () => {
    const providers = [buildScreenedProvider()];
    const { result } = setup({ placementName: "dcloud", providers });

    expect(result.current.providers).toEqual(providers);
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

    const { result } = setupQuery(() => useScreenedProviders({ sdl: input.sdl ?? HELLO_WORLD_SDL, placementName: input.placementName, region: input.region }), {
      services: { api: () => api }
    });
    return { result, useQuery };
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
