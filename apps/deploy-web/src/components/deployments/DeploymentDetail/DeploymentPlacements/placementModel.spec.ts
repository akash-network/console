import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus } from "@src/queries/useLeaseQuery";
import type { DeploymentGroup, DetectedLeaseGpus } from "@src/types/deployment";
import {
  describeGpus,
  foldDetectedGpus,
  foldDetectedGpusOfLeases,
  formatGpuLabel,
  formatReplicaCount,
  getDeploymentGpuModels,
  getPlacementGpuModels,
  getPlacementName,
  getProviderRegion,
  getServiceStatus,
  parseManifestServices,
  parseServicesByPlacement
} from "./placementModel";

describe("placementModel", () => {
  describe("parseManifestServices", () => {
    it("returns image and compute resources keyed by service name", () => {
      const manifest = buildManifest({
        services: { web: { image: "nginx:latest" } },
        compute: { web: { cpu: 2, memorySize: "512Mi", storageSize: "1Gi" } }
      });

      const result = parseManifestServices(manifest);

      expect(result.web.image).toBe("nginx:latest");
      expect(result.web.resources).toEqual({ cpu: 2, gpuUnits: 0, memory: 512 * 1024 ** 2, storage: 1024 ** 3 });
    });

    it("reads gpu units from the compute profile", () => {
      const manifest = buildManifest({
        services: { ml: { image: "vllm" } },
        compute: { ml: { cpu: 6, gpuUnits: 1, memorySize: "36Gi", storageSize: "56Gi" } }
      });

      expect(parseManifestServices(manifest).ml.resources?.gpuUnits).toBe(1);
    });

    it("parses env vars and the joined command", () => {
      const manifest = yaml.dump({
        services: { web: { image: "nginx", env: ["KEY=value", "FLAG"], command: ["sh", "-c"], args: ["echo hi"] } }
      });

      const result = parseManifestServices(manifest);

      expect(result.web.env).toEqual([{ key: "KEY", value: "value" }, { key: "FLAG" }]);
      expect(result.web.command).toBe("sh -c echo hi");
    });

    it("keeps the image when the compute profile is missing", () => {
      const manifest = yaml.dump({ services: { web: { image: "nginx" } } });

      const result = parseManifestServices(manifest);

      expect(result.web.image).toBe("nginx");
      expect(result.web.resources).toBeUndefined();
    });

    it("resolves resources through the deployment profile pointer when it differs from the service name", () => {
      const manifest = yaml.dump({
        services: { web: { image: "nginx" } },
        profiles: { compute: { "shared-small": { resources: { cpu: { units: 1 }, memory: { size: "256Mi" }, storage: { size: "1Gi" } } } } },
        deployment: { web: { dcloud: { profile: "shared-small", count: 1 } } }
      });

      expect(parseManifestServices(manifest).web.resources).toEqual({
        cpu: 1,
        gpuUnits: 0,
        memory: 256 * 1024 ** 2,
        storage: 1024 ** 3
      });
    });

    it("returns an empty map for missing or malformed manifests", () => {
      expect(parseManifestServices(undefined)).toEqual({});
      expect(parseManifestServices("")).toEqual({});
      expect(parseManifestServices(":::not-yaml:::\n\t- broken")).toEqual({});
      expect(parseManifestServices(yaml.dump({ version: "2.0" }))).toEqual({});
    });

    it("keeps a service named after an Object prototype member as an own entry", () => {
      const manifest = "services:\n  __proto__:\n    image: nginx\n  web:\n    image: node\n";

      const result = parseManifestServices(manifest);

      expect(Object.keys(result)).toEqual(["__proto__", "web"]);
      expect(Object.values(result).map(service => service.image)).toEqual(["nginx", "node"]);
    });
  });

  describe("parseServicesByPlacement", () => {
    it("groups each service's detail under the placement it deploys to", () => {
      const manifest = yaml.dump({
        services: { web: { image: "nginx" }, api: { image: "node" } },
        profiles: {
          compute: {
            web: { resources: { cpu: { units: 1 }, memory: { size: "512Mi" }, storage: { size: "1Gi" } } },
            api: { resources: { cpu: { units: 2 }, memory: { size: "1Gi" }, storage: { size: "2Gi" } } }
          }
        },
        deployment: { web: { dcloud: { profile: "web" } }, api: { dcloud: { profile: "api" } } }
      });

      const result = parseServicesByPlacement(manifest);

      expect(Object.keys(result.dcloud)).toEqual(["web", "api"]);
      expect(result.dcloud.web.image).toBe("nginx");
      expect(result.dcloud.api.resources?.cpu).toBe(2);
    });

    it("resolves the same service to a different profile in each placement", () => {
      const manifest = yaml.dump({
        services: { web: { image: "nginx" } },
        profiles: {
          compute: {
            small: { resources: { cpu: { units: 1 }, memory: { size: "512Mi" }, storage: { size: "1Gi" } } },
            large: { resources: { cpu: { units: 4 }, memory: { size: "4Gi" }, storage: { size: "8Gi" } } }
          }
        },
        deployment: { web: { edge: { profile: "small" }, core: { profile: "large" } } }
      });

      const result = parseServicesByPlacement(manifest);

      expect(result.edge.web.resources?.cpu).toBe(1);
      expect(result.core.web.resources?.cpu).toBe(4);
    });

    it("handles a placement named after an Object prototype member without throwing", () => {
      const manifest = yaml.dump({ services: { web: { image: "nginx" } }, deployment: { web: { constructor: {} } } });

      const result = parseServicesByPlacement(manifest);

      expect(Object.keys(result)).toEqual(["constructor"]);
      expect(Object.values(result)[0].web.image).toBe("nginx");
    });

    it("returns an empty map when the manifest has no deployment block", () => {
      expect(parseServicesByPlacement(yaml.dump({ services: { web: {} } }))).toEqual({});
      expect(parseServicesByPlacement(undefined)).toEqual({});
      expect(parseServicesByPlacement(":::not-yaml:::")).toEqual({});
    });
  });

  describe("getPlacementName", () => {
    it("uses the group name when present", () => {
      expect(getPlacementName(buildGroup({ name: "dcloud" }), 0)).toBe("dcloud");
    });

    it("falls back to a positional name when the group has no name", () => {
      expect(getPlacementName(buildGroup({ name: "" }), 1)).toBe("placement-2");
      expect(getPlacementName(undefined, 0)).toBe("placement-1");
    });
  });

  describe("getProviderRegion", () => {
    it("reads the region from the region attribute", () => {
      expect(getProviderRegion({ attributes: [{ key: "region", value: "us-east" }] })).toBe("us-east");
    });

    it("also accepts the location-region attribute key", () => {
      expect(getProviderRegion({ attributes: [{ key: "location-region", value: "us-west" }] })).toBe("us-west");
    });

    it("falls back to the parsed locationRegion field", () => {
      expect(getProviderRegion({ attributes: [], locationRegion: "eu-central" })).toBe("eu-central");
    });

    it("returns undefined when the provider has not declared a region", () => {
      expect(getProviderRegion({ attributes: [], locationRegion: null })).toBeUndefined();
      expect(getProviderRegion(undefined)).toBeUndefined();
    });
  });

  describe("getPlacementGpuModels", () => {
    it("extracts unique gpu models from resource attributes", () => {
      const group = buildGroup({
        gpuAttributes: [
          { key: "vendor/nvidia/model/a100", value: "true" },
          { key: "vendor/nvidia/model/a100", value: "true" }
        ]
      });

      expect(getPlacementGpuModels(group)).toEqual(["a100"]);
    });

    it("returns an empty list when no gpu is requested", () => {
      expect(getPlacementGpuModels(buildGroup({}))).toEqual([]);
    });

    it("ignores a wildcard model when no gpu type is specified", () => {
      expect(getPlacementGpuModels(buildGroup({ gpuAttributes: [{ key: "vendor/nvidia/model/*", value: "true" }] }))).toEqual([]);
    });
  });

  describe("getDeploymentGpuModels", () => {
    it("unions unique models from every group", () => {
      expect(
        getDeploymentGpuModels([
          buildGroup({ gpuAttributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] }),
          buildGroup({ gpuAttributes: [{ key: "vendor/nvidia/model/h100", value: "true" }] }),
          buildGroup({ gpuAttributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] })
        ])
      ).toEqual(["h100", "a100"]);
    });

    it("returns an empty list when no groups declare a gpu", () => {
      expect(getDeploymentGpuModels([buildGroup({})])).toEqual([]);
      expect(getDeploymentGpuModels(undefined)).toEqual([]);
    });
  });

  describe("formatGpuLabel", () => {
    it("counts the gpus asked for in front of the declared model", () => {
      expect(formatGpuLabel(1, ["h100"])).toBe("1× H100");
      expect(formatGpuLabel(2, ["a100"])).toBe("2× A100");
    });

    it("puts every declared model under the one count, since how the gpus split between them is unknown", () => {
      expect(formatGpuLabel(2, ["h100", "a100"])).toBe("2× H100 / A100");
    });

    it("falls back to the count when no model is declared", () => {
      expect(formatGpuLabel(1, [])).toBe("1");
      expect(formatGpuLabel(1, ["*"])).toBe("1");
    });

    it("shows an em dash when the deployment has no gpu", () => {
      expect(formatGpuLabel(0, ["h100"])).toBe("—");
    });

    it("shows what the console read where it has looked, over what was asked for", () => {
      expect(formatGpuLabel(1, ["*"], [{ displayName: "H100", count: 1 }])).toBe("1× H100");
      expect(formatGpuLabel(1, ["a100"], [{ displayName: "H100", count: 1 }])).toBe("1× H100");
    });

    it("counts identical cards rather than repeating them", () => {
      expect(formatGpuLabel(8, ["*"], [{ displayName: "H100", count: 8 }])).toBe("8× H100");
    });

    it("counts each of unlike cards", () => {
      expect(
        formatGpuLabel(
          3,
          [],
          [
            { displayName: "H100", count: 2 },
            { displayName: "L40S", count: 1 }
          ]
        )
      ).toBe("2× H100, 1× L40S");
    });

    it("keeps to what was asked for while the reading accounts for fewer gpus, since part of the lease went unread", () => {
      expect(formatGpuLabel(2, ["h100"], [{ displayName: "H100", count: 1 }])).toBe("2× H100");
      expect(formatGpuLabel(2, ["*"], [{ displayName: "H100", count: 1 }])).toBe("2");
    });

    it("keeps to what was asked for when the reading holds more gpus than that", () => {
      expect(formatGpuLabel(1, ["*"], [{ displayName: "H100", count: 2 }])).toBe("1");
    });

    it("falls back to what was asked for when nothing has been read", () => {
      expect(formatGpuLabel(1, ["h100"], [])).toBe("1× H100");
      expect(formatGpuLabel(1, ["*"], [])).toBe("1");
      expect(formatGpuLabel(1, ["*"], undefined)).toBe("1");
    });

    it("still shows an em dash for a deployment with no gpu, whatever was read", () => {
      expect(formatGpuLabel(0, [], [{ displayName: "H100", count: 1 }])).toBe("—");
    });
  });

  describe("describeGpus", () => {
    it("counts each card the console read under its own model", () => {
      expect(
        describeGpus(
          3,
          ["*"],
          [
            { displayName: "H100", count: 2 },
            { displayName: "L40S", count: 1 }
          ]
        )
      ).toEqual([
        { count: 2, model: "H100" },
        { count: 1, model: "L40S" }
      ]);
    });

    it("puts every declared model under the one count asked for while no reading covers it", () => {
      expect(describeGpus(2, ["h100", "a100"], [{ displayName: "H100", count: 1 }])).toEqual([{ count: 2, model: "H100 / A100" }]);
    });

    it("leaves the model out when none is declared", () => {
      expect(describeGpus(1, ["*"])).toEqual([{ count: 1, model: null }]);
    });

    it("describes nothing for a deployment with no gpu", () => {
      expect(describeGpus(0, ["h100"], [{ displayName: "H100", count: 1 }])).toEqual([]);
    });
  });

  describe("foldDetectedGpus", () => {
    it("counts identical cards across a lease's services as one entry", () => {
      const detected = buildDetectedLeaseGpus([
        { service: "web", gpus: [{ displayName: "H100", count: 2 }] },
        { service: "trainer", gpus: [{ displayName: "H100", count: 1 }] }
      ]);

      expect(foldDetectedGpus(detected)).toEqual([{ displayName: "H100", count: 3 }]);
    });

    it("keeps unlike cards apart", () => {
      const detected = buildDetectedLeaseGpus([
        {
          service: "web",
          gpus: [
            { displayName: "H100", count: 1 },
            { displayName: "L40S", count: 2 }
          ]
        }
      ]);

      expect(foldDetectedGpus(detected)).toEqual([
        { displayName: "H100", count: 1 },
        { displayName: "L40S", count: 2 }
      ]);
    });

    it("reads nothing from a lease the console has not looked inside", () => {
      expect(foldDetectedGpus(undefined)).toEqual([]);
    });
  });

  describe("foldDetectedGpusOfLeases", () => {
    it("counts a deployment's cards across every lease read", () => {
      const leases = [
        { state: "active", detectedGpus: buildDetectedLeaseGpus([{ service: "web", gpus: [{ displayName: "H100", count: 1 }] }]) },
        { state: "active", detectedGpus: buildDetectedLeaseGpus([{ service: "web", gpus: [{ displayName: "H100", count: 2 }] }]) }
      ];

      expect(foldDetectedGpusOfLeases(leases)).toEqual([{ displayName: "H100", count: 3 }]);
    });

    it("counts only the leases still running, since a lease that was replaced keeps the reading it had", () => {
      const leases = [
        { state: "closed", detectedGpus: buildDetectedLeaseGpus([{ service: "web", gpus: [{ displayName: "H100", count: 1 }] }]) },
        { state: "active", detectedGpus: buildDetectedLeaseGpus([{ service: "web", gpus: [{ displayName: "H100", count: 1 }] }]) },
        { state: "reclaiming", detectedGpus: buildDetectedLeaseGpus([{ service: "web", gpus: [{ displayName: "L40S", count: 1 }] }]) }
      ];

      expect(foldDetectedGpusOfLeases(leases)).toEqual([
        { displayName: "H100", count: 1 },
        { displayName: "L40S", count: 1 }
      ]);
    });

    it("ignores the leases nothing has been read for", () => {
      const leases = [
        { state: "active", detectedGpus: undefined },
        { state: "active", detectedGpus: buildDetectedLeaseGpus([{ service: "web", gpus: [{ displayName: "L40S", count: 1 }] }]) }
      ];

      expect(foldDetectedGpusOfLeases(leases)).toEqual([{ displayName: "L40S", count: 1 }]);
    });

    it("reads nothing from a deployment with no leases", () => {
      expect(foldDetectedGpusOfLeases(undefined)).toEqual([]);
      expect(foldDetectedGpusOfLeases(null)).toEqual([]);
      expect(foldDetectedGpusOfLeases([])).toEqual([]);
    });
  });

  describe("getServiceStatus", () => {
    it("reports running when the service has an available replica", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "active")).toEqual({ label: "Running", tone: "running" });
    });

    it("reports starting when no replica is available yet", () => {
      expect(getServiceStatus(buildService({ available: 0 }), "active")).toEqual({ label: "Starting", tone: "pending" });
    });

    it("reports loading until lease status arrives", () => {
      expect(getServiceStatus(undefined, "active")).toEqual({ label: "Loading", tone: "loading" });
    });

    it("reports closed when the lease is closed", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "closed")).toEqual({ label: "Closed", tone: "closed" });
    });

    it("reports closed when the lease has been reclaimed even while its state still reads active", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "active", true)).toEqual({ label: "Closed", tone: "closed" });
    });

    it("reports closed for any non-live lease state, including insufficient funds", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "insufficient_funds")).toEqual({ label: "Closed", tone: "closed" });
    });

    it("keeps a lease in the reclamation grace period non-terminal until it is reclaimed", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "reclaiming")).toEqual({ label: "Running", tone: "running" });
    });
  });

  describe("formatReplicaCount", () => {
    it("formats available against total", () => {
      expect(formatReplicaCount(buildService({ available: 1, total: 1 }))).toBe("1/1 replicas");
      expect(formatReplicaCount(buildService({ available: 0, total: 3 }))).toBe("0/3 replicas");
    });

    it("is omitted when lease status has not arrived", () => {
      expect(formatReplicaCount(undefined)).toBeUndefined();
    });

    it("is omitted when replica totals are not numeric", () => {
      expect(formatReplicaCount(mock<LeaseServiceStatus>({ available: 1 }))).toBeUndefined();
    });
  });
});

function buildManifest(input: {
  services: Record<string, { image: string }>;
  compute: Record<string, { cpu: number; gpuUnits?: number; memorySize: string; storageSize: string }>;
}) {
  return yaml.dump({
    services: input.services,
    profiles: {
      compute: Object.fromEntries(
        Object.entries(input.compute).map(([name, c]) => [
          name,
          {
            resources: {
              cpu: { units: c.cpu },
              ...(c.gpuUnits ? { gpu: { units: c.gpuUnits } } : {}),
              memory: { size: c.memorySize },
              storage: { size: c.storageSize }
            }
          }
        ])
      )
    }
  });
}

function buildGroup(input: { name?: string; attributes?: { key: string; value: string }[]; gpuAttributes?: { key: string; value: string }[] }) {
  return mock<DeploymentGroup>({
    group_spec: {
      name: input.name ?? "",
      requirements: { attributes: input.attributes ?? [] },
      resources: [{ resource: { gpu: { attributes: input.gpuAttributes ?? [] } } }]
    }
  } as Partial<DeploymentGroup>);
}

function buildService(input: { available: number; total?: number; ready_replicas?: number }) {
  return mock<LeaseServiceStatus>({ available: input.available, total: input.total ?? 1, ready_replicas: input.ready_replicas ?? input.available });
}

function buildDetectedLeaseGpus(services: Array<{ service: string; gpus: Array<{ displayName: string; count: number }> }>): DetectedLeaseGpus {
  return {
    services: services.map(entry => ({
      service: entry.service,
      gpus: entry.gpus.map(gpu => ({ vendor: "nvidia", model: null, displayName: gpu.displayName, memoryMb: 0, interface: null, count: gpu.count }))
    })),
    driverVersion: null,
    detectedAt: "2026-09-21T10:00:00.000Z"
  };
}
