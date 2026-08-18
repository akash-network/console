import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus } from "@src/queries/useLeaseQuery";
import type { DeploymentGroup } from "@src/types/deployment";
import {
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
      expect(result.web.resources).toEqual({ cpu: 2, gpuUnits: 0, memory: { value: 512, unit: "Mi" }, storage: { value: 1, unit: "Gi" } });
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
        memory: { value: 256, unit: "Mi" },
        storage: { value: 1, unit: "Gi" }
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
  });

  describe("getServiceStatus", () => {
    it("reports running when the service has an available replica", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "active")).toEqual({ label: "Running", tone: "running" });
    });

    it("reports starting when no replica is available yet", () => {
      expect(getServiceStatus(buildService({ available: 0 }), "active")).toEqual({ label: "Starting", tone: "pending" });
      expect(getServiceStatus(undefined, "active")).toEqual({ label: "Starting", tone: "pending" });
    });

    it("reports closed when the lease is closed", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "closed")).toEqual({ label: "Closed", tone: "closed" });
    });

    it("reports closed when the lease has been reclaimed even while its state still reads active", () => {
      expect(getServiceStatus(buildService({ available: 1 }), "active", true)).toEqual({ label: "Closed", tone: "closed" });
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
