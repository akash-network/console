import type { Manifest } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { deriveDeploymentName, MAX_DEPLOYMENT_NAME_LENGTH } from "./deployment-name";

type ManifestGroup = Manifest[number];
type ManifestService = ManifestGroup["services"][number];

describe("deriveDeploymentName", () => {
  it("names a single-service deployment after that service", () => {
    expect(deriveDeploymentName(manifestOf({ dcloud: ["web"] }))).toBe("web");
  });

  it("joins the service names a group declares in the order the manifest holds them", () => {
    expect(deriveDeploymentName(manifestOf({ dcloud: ["db", "web"] }))).toBe("db+web");
  });

  it("joins the service names across groups", () => {
    expect(deriveDeploymentName(manifestOf({ akash: ["api"], dcloud: ["worker"] }))).toBe("api+worker");
  });

  it("names a service placed under two placements once", () => {
    expect(deriveDeploymentName(manifestOf({ akash: ["web"], dcloud: ["web"] }))).toBe("web");
  });

  it("shortens a name longer than a deployment may carry", () => {
    const serviceNames = Array.from({ length: 40 }, (_, index) => `service-${index}`.padEnd(20, "x"));

    const name = deriveDeploymentName(manifestOf({ dcloud: serviceNames }));

    expect(name).toHaveLength(MAX_DEPLOYMENT_NAME_LENGTH);
    expect(name).toBe(serviceNames.join("+").slice(0, MAX_DEPLOYMENT_NAME_LENGTH));
  });

  it("leaves out a service the manifest names with blank space", () => {
    expect(deriveDeploymentName(manifestOf({ dcloud: ["   ", "web"] }))).toBe("web");
  });

  it("derives nothing from a manifest declaring no service at all", () => {
    expect(deriveDeploymentName(manifestOf({ dcloud: [] }))).toBeUndefined();
    expect(deriveDeploymentName([])).toBeUndefined();
  });

  function manifestOf(groups: Record<string, string[]>): Manifest {
    return Object.entries(groups).map(([name, serviceNames]) =>
      mock<ManifestGroup>({ name, services: serviceNames.map(serviceName => mock<ManifestService>({ name: serviceName })) })
    );
  }
});
