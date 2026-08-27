import { describe, expect, it, vi } from "vitest";

import type { ScreeningRequestBody } from "@src/queries/useScreenedProviders";
import type { PlacementType } from "@src/types";
import { findUnavailableVerificationPlacements } from "./verificationProviderPreflight";

const REQUEST: ScreeningRequestBody = {
  requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] },
  resources: []
};

describe(findUnavailableVerificationPlacements.name, () => {
  it("checks every placement with a verification requirement", async () => {
    const screenProviders = vi.fn(async request => ({ providers: request.requirements.attributes[0]?.value === "available" ? [{}] : [] }));
    const buildRequest = vi.fn((_: string, placementName: string) => ({
      ...REQUEST,
      requirements: {
        ...REQUEST.requirements,
        attributes: [{ key: "placement", value: placementName === "west" ? "available" : "unavailable" }]
      }
    }));

    const unavailable = await findUnavailableVerificationPlacements(
      {
        sdl: "generated sdl",
        placements: [placement("west", true), placement("east", true), placement("unrestricted", false)],
        timeZone: "UTC"
      },
      { buildRequest, screenProviders }
    );

    expect(unavailable).toEqual(["east"]);
    expect(buildRequest).toHaveBeenCalledTimes(2);
    expect(screenProviders).toHaveBeenCalledTimes(2);
    expect(screenProviders).toHaveBeenCalledWith(expect.objectContaining({ timezone: "UTC" }));
  });

  it("does not call screening when no placement requires verification", async () => {
    const buildRequest = vi.fn(() => REQUEST);
    const screenProviders = vi.fn(async () => ({ providers: [] }));

    const unavailable = await findUnavailableVerificationPlacements(
      { sdl: "generated sdl", placements: [placement("unrestricted", false)], timeZone: "UTC" },
      { buildRequest, screenProviders }
    );

    expect(unavailable).toEqual([]);
    expect(buildRequest).not.toHaveBeenCalled();
    expect(screenProviders).not.toHaveBeenCalled();
  });

  it("fails when a verified placement cannot be converted into a screening request", async () => {
    await expect(
      findUnavailableVerificationPlacements(
        { sdl: "invalid", placements: [placement("west", true)], timeZone: "UTC" },
        { buildRequest: () => null, screenProviders: async () => ({ providers: [] }) }
      )
    ).rejects.toThrow("Unable to screen placement west");
  });
});

function placement(name: string, verified: boolean): Pick<PlacementType, "name" | "verification"> {
  return {
    name,
    verification: verified ? { minTier: 1, capabilities: [], auditors: [] } : undefined
  };
}
