import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { AUDITOR } from "@src/utils/deploymentData/v1beta3";
import { setupQuery } from "../../tests/unit/query-client";
import type { ScreenedProvider, ScreenedProvidersResponse } from "./useScreenedProviders";
import { buildPlacementScreeningRequest, useScreenedProviders } from "./useScreenedProviders";

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
        name: "dcloud",
        requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
        resources: expect.arrayContaining([expect.objectContaining({ count: 1 })])
      })
    );
  });

  it("falls back to the full audited catalog (empty resources) when the SDL is invalid", () => {
    const { useQuery } = setup({ sdl: "foo: [unclosed", placementName: "dcloud" });

    expect(useQuery).toHaveBeenCalledWith({
      name: "screening",
      requirements: { signedBy: { allOf: [AUDITOR] }, attributes: [] },
      resources: []
    });
  });

  it("returns the screened providers from the query result", () => {
    const providers = [makeProvider()];
    const { result } = setup({ placementName: "dcloud", providers });

    expect(result.current.providers).toEqual(providers);
  });

  function makeProvider(): ScreenedProvider {
    return { owner: "akash1a", hostUri: "https://a.example:8443", isAudited: true, location: "us-west", createdAt: "2026-01-01T00:00:00.000Z" };
  }

  function setup(input: { placementName: string; sdl?: string; providers?: ScreenedProvider[] }) {
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

    const { result } = setupQuery(() => useScreenedProviders({ sdl: input.sdl ?? HELLO_WORLD_SDL, placementName: input.placementName }), {
      services: { api: () => api }
    });
    return { result, useQuery };
  }
});

describe("buildPlacementScreeningRequest", () => {
  it("builds an audited request from the matching placement group spec", () => {
    const request = buildPlacementScreeningRequest(HELLO_WORLD_SDL, "dcloud");

    expect(request).toMatchObject({ name: "dcloud", requirements: { signedBy: { allOf: [AUDITOR] } } });
    expect(request?.resources[0].resource.cpu.units.val).toBeTruthy();
  });

  it("returns null when the placement is not in the SDL", () => {
    expect(buildPlacementScreeningRequest(HELLO_WORLD_SDL, "missing")).toBeNull();
  });

  it("returns null when the SDL is invalid", () => {
    expect(buildPlacementScreeningRequest("foo: [unclosed", "dcloud")).toBeNull();
  });
});
