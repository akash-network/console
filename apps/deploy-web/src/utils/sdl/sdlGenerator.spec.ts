import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { buildCommand, generateSdl } from "./sdlGenerator";

describe("sdlGenerator", () => {
  describe(generateSdl.name, () => {
    it("includes permissions params for log-collector services", () => {
      const result = generateSdl(buildFormValues(buildLogCollectorService()));
      const parsed = yaml.load(result) as { services: Record<string, ServiceType> };

      expect(parsed.services["web-log-collector"].params).toEqual({
        permissions: {
          read: ["deployment", "logs", "events"]
        }
      });
    });

    it("does not include permissions params for non-log-collector services", () => {
      const result = generateSdl(buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" })));
      const parsed = yaml.load(result) as { services: Record<string, { params?: unknown }> };

      expect(parsed.services["web"].params).toBeUndefined();
    });

    it("preserves params.tee carried on the service model", () => {
      const result = generateSdl(buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest", params: { tee: "cpu" } })));
      const parsed = yaml.load(result) as { services: Record<string, { params?: { tee?: string } }> };

      expect(parsed.services.web.params?.tee).toBe("cpu");
    });

    it("merges params.tee alongside log-collector permissions", () => {
      const result = generateSdl(buildFormValues(buildLogCollectorService({ params: { tee: "cpu-gpu" } })));
      const parsed = yaml.load(result) as { services: Record<string, { params?: { tee?: string; permissions?: unknown } }> };

      expect(parsed.services["web-log-collector"].params).toEqual({
        permissions: { read: ["deployment", "logs", "events"] },
        tee: "cpu-gpu"
      });
    });

    it("emits gpu.attributes.interconnect as an empty array for an implicit opt-in", () => {
      const result = generateSdl(buildFormValues(buildGpuService({ interconnect: {} })));

      expect(gpuAttributesOf(result).interconnect).toEqual([]);
    });

    it("emits gpu.attributes.interconnect with the group for an explicit opt-in", () => {
      const result = generateSdl(buildFormValues(buildGpuService({ interconnect: { group: "pair0" } })));

      expect(gpuAttributesOf(result).interconnect).toEqual({ group: "pair0" });
    });

    it("preserves an explicitly empty group rather than collapsing it to an implicit opt-in", () => {
      const result = generateSdl(buildFormValues(buildGpuService({ interconnect: { group: "" } })));

      expect(gpuAttributesOf(result).interconnect).toEqual({ group: "" });
    });

    it("does not emit an interconnect attribute when the gpu profile did not opt in", () => {
      const result = generateSdl(buildFormValues(buildGpuService({ interconnect: undefined })));

      expect(gpuAttributesOf(result)).not.toHaveProperty("interconnect");
    });

    it("emits the interconnect attribute before vendor to match the canonical key order", () => {
      const result = generateSdl(buildFormValues(buildGpuService({ interconnect: {} })));

      expect(Object.keys(gpuAttributesOf(result))).toEqual(["interconnect", "vendor"]);
    });

    it("injects location-region attribute when placement.region is set", () => {
      const formValues = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValues.placements[0].region = "us-west";
      const result = generateSdl(formValues);
      const parsed = yaml.load(result) as { profiles: { placement: Record<string, { attributes?: Record<string, string> }> } };

      expect(parsed.profiles.placement["dcloud"].attributes).toMatchObject({ "location-region": "us-west" });
    });

    it("does not inject location-region when placement.region is undefined or 'any'", () => {
      const formValuesNoRegion = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      const parsedNoRegion = yaml.load(generateSdl(formValuesNoRegion)) as {
        profiles: { placement: Record<string, { attributes?: Record<string, string> }> };
      };
      expect(parsedNoRegion.profiles.placement["dcloud"].attributes?.["location-region"]).toBeUndefined();

      const formValuesAny = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValuesAny.placements[0].region = "any";
      const parsedAny = yaml.load(generateSdl(formValuesAny)) as { profiles: { placement: Record<string, { attributes?: Record<string, string> }> } };
      expect(parsedAny.profiles.placement["dcloud"].attributes?.["location-region"]).toBeUndefined();
    });

    it("emits verification requirements alongside legacy signedBy", () => {
      const formValues = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValues.placements[0].signedBy = { anyOf: [{ value: "akash1legacy" }], allOf: [] };
      formValues.placements[0].verification = {
        minTier: 3,
        capabilities: ["persistent_storage", "bare_metal"],
        auditors: [{ value: "akash1auditor1" }, { value: "akash1auditor2" }],
        auditorMode: "all",
        minAuditorCount: 2
      };

      const parsed = yaml.load(generateSdl(formValues)) as {
        profiles: { placement: Record<string, { signedBy?: unknown; verification?: unknown }> };
      };

      expect(parsed.profiles.placement.dcloud).toMatchObject({
        signedBy: { anyOf: ["akash1legacy"] },
        verification: {
          min_tier: 3,
          capabilities: ["persistent_storage", "bare_metal"],
          auditors: ["akash1auditor1", "akash1auditor2"],
          auditor_mode: "all",
          min_auditor_count: 2
        }
      });
    });

    it("omits verification when the placement has no requirement", () => {
      const parsed = yaml.load(generateSdl(buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" })))) as {
        profiles: { placement: Record<string, { verification?: unknown }> };
      };

      expect(parsed.profiles.placement.dcloud.verification).toBeUndefined();
    });

    it("omits empty optional verification collections", () => {
      const formValues = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValues.placements[0].verification = { minTier: 1, capabilities: [], auditors: [] };
      const parsed = yaml.load(generateSdl(formValues)) as {
        profiles: { placement: Record<string, { verification: Record<string, unknown> }> };
      };

      expect(parsed.profiles.placement.dcloud.verification).toEqual({ min_tier: 1 });
    });

    it("throws when a service references a placementId that does not exist", () => {
      const formValues = {
        placements: [{ id: "p-1", name: "dcloud" }],
        services: [buildLogCollectorService({ title: "web", image: "nginx:latest", placementId: "p-MISSING" })]
      } as SdlBuilderFormValuesType;

      expect(() => generateSdl(formValues)).toThrow(/unknown placementId/);
    });

    it("emits a placement profile for a placement without services", () => {
      const formValues = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValues.placements.push({ id: "p-2", name: "placement-1", region: "eu-west" } as PlacementType);
      const result = generateSdl(formValues);
      const parsed = yaml.load(result) as { profiles: { placement: Record<string, { attributes?: Record<string, string> }> }; deployment: object };

      expect(Object.keys(parsed.profiles.placement)).toEqual(["dcloud", "placement-1"]);
      expect(parsed.profiles.placement["placement-1"].attributes).toMatchObject({ "location-region": "eu-west" });
      expect(Object.keys(parsed.deployment)).toEqual(["web"]);
    });

    it("deduplicates placement profiles when multiple services share a placementId", () => {
      const formValues = buildFormValues(
        buildLogCollectorService({ title: "web", image: "nginx:latest" }),
        buildLogCollectorService({ title: "api", image: "node:18-alpine" })
      );
      const result = generateSdl(formValues);
      const parsed = yaml.load(result) as { profiles: { placement: Record<string, { pricing: Record<string, unknown> }> } };

      expect(Object.keys(parsed.profiles.placement)).toEqual(["dcloud"]);
      expect(Object.keys(parsed.profiles.placement["dcloud"].pricing)).toEqual(["web", "api"]);
    });

    it("drops a declared endpoint that no port references", () => {
      const formValues = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValues.endpoints = [{ id: "e-1", name: "endpoint-1" }];
      const result = generateSdl(formValues);
      const parsed = yaml.load(result) as { endpoints?: Record<string, { kind: string }> };

      expect(parsed.endpoints).toBeUndefined();
    });

    it("emits an endpoint referenced by a port's ipName with kind ip", () => {
      const service = buildLogCollectorService({ title: "web", image: "nginx:latest" });
      service.expose[0].ipName = "endpoint-1";
      const formValues = buildFormValues(service);
      formValues.endpoints = [{ id: "e-1", name: "endpoint-1" }];
      const result = generateSdl(formValues);
      const parsed = yaml.load(result) as { endpoints?: Record<string, { kind: string }> };

      expect(parsed.endpoints).toEqual({ "endpoint-1": { kind: "ip" } });
    });

    it("omits reclamation when reclamationMinWindow is unset", () => {
      const result = generateSdl(buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" })));
      const parsed = yaml.load(result) as { reclamation?: unknown };

      expect(parsed.reclamation).toBeUndefined();
    });

    it.each([["1h"], ["4h"], ["24h"], ["72h"]] as const)("emits reclamation.min_window %s when reclamationMinWindow is set", minWindow => {
      const formValues = buildFormValues(buildLogCollectorService({ title: "web", image: "nginx:latest" }));
      formValues.reclamationMinWindow = minWindow;
      const result = generateSdl(formValues);
      const parsed = yaml.load(result) as { reclamation?: { min_window?: string } };

      expect(parsed.reclamation).toEqual({ min_window: minWindow });
    });

    it("emits every args token as its own array element", () => {
      const service = buildLogCollectorService({
        title: "web",
        image: "nginx:latest",
        command: { command: "/tini\n-s\n--", arg: "bash\n-c\nmkdir -p /data; apt update; sleep infinity;" }
      });
      const parsed = yaml.load(generateSdl(buildFormValues(service))) as { services: Record<string, { command?: string[]; args?: string[] }> };

      expect(parsed.services.web.command).toEqual(["/tini", "-s", "--"]);
      expect(parsed.services.web.args).toEqual(["bash", "-c", "mkdir -p /data; apt update; sleep infinity;"]);
    });

    it("emits args without a command when only args are set", () => {
      const service = buildLogCollectorService({ title: "web", image: "nginx:latest", command: { command: "", arg: "--port\n8080" } });
      const parsed = yaml.load(generateSdl(buildFormValues(service))) as { services: Record<string, { command?: string[]; args?: string[] }> };

      expect(parsed.services.web).not.toHaveProperty("command");
      expect(parsed.services.web.args).toEqual(["--port", "8080"]);
    });

    it("does not emit args when the arg field is blank", () => {
      const service = buildLogCollectorService({ title: "web", image: "nginx:latest", command: { command: "nginx", arg: "" } });
      const parsed = yaml.load(generateSdl(buildFormValues(service))) as { services: Record<string, { command?: string[]; args?: string[] }> };

      expect(parsed.services.web.command).toEqual(["nginx"]);
      expect(parsed.services.web).not.toHaveProperty("args");
    });

    function buildLogCollectorService(overrides?: Partial<ServiceType>): ServiceType {
      return {
        id: overrides?.title ? `${overrides.title}-id` : "web-log-collector",
        title: "web-log-collector",
        image: LOG_COLLECTOR_IMAGE,
        profile: {
          cpu: 0.1,
          ram: 256,
          ramUnit: "Mi",
          storage: [{ size: 512, unit: "Mi", isPersistent: false }],
          hasGpu: false,
          gpu: 0
        },
        expose: [{ port: 80, as: 80, global: true, to: [] }],
        placementId: "p-1",
        pricing: { amount: 1000, denom: "uakt" },
        count: 1,
        ...overrides
      } as ServiceType;
    }

    function buildFormValues(...services: ServiceType[]): SdlBuilderFormValuesType {
      const placement: PlacementType = { id: "p-1", name: "dcloud" };
      return {
        placements: [placement],
        services
      } as SdlBuilderFormValuesType;
    }

    function buildGpuService(opts: { interconnect?: { group?: string } }): ServiceType {
      return {
        id: "web-id",
        title: "web",
        image: "tensorflow/tensorflow:latest-gpu",
        profile: {
          cpu: 1,
          ram: 2,
          ramUnit: "Gi",
          storage: [{ size: 10, unit: "Gi", isPersistent: false }],
          hasGpu: true,
          gpu: 1,
          gpuModels: [{ vendor: "nvidia", name: "a100", memory: "80Gi", interface: "sxm" }],
          interconnect: opts.interconnect
        },
        expose: [{ port: 8080, as: 80, global: true, to: [] }],
        placementId: "p-1",
        pricing: { amount: 1000, denom: "uakt" },
        count: 1
      } as ServiceType;
    }

    function gpuAttributesOf(sdl: string): Record<string, unknown> {
      const parsed = yaml.load(sdl) as { profiles: { compute: Record<string, { resources: { gpu: { attributes: Record<string, unknown> } } }> } };
      return parsed.profiles.compute.web.resources.gpu.attributes;
    }
  });

  describe(buildCommand.name, () => {
    it("returns an empty array for an empty string", () => {
      expect(buildCommand("")).toEqual([]);
    });

    it("returns a single-element array for a single line", () => {
      expect(buildCommand("echo 'foo'")).toEqual(["echo 'foo'"]);
    });

    it("splits newline-separated tokens into an array", () => {
      expect(buildCommand("sh\n-c")).toEqual(["sh", "-c"]);
    });

    it("keeps a script token as its own array element", () => {
      expect(buildCommand("sh\n-c\nfoo")).toEqual(["sh", "-c", "foo"]);
    });

    it("does not force a sh -c wrapper for multi-token commands", () => {
      expect(buildCommand("bash\n-lc")).toEqual(["bash", "-lc"]);
    });

    it("drops empty lines and trailing newlines", () => {
      expect(buildCommand("foo\nbar\n")).toEqual(["foo", "bar"]);
      expect(buildCommand("foo\nbar\n\n")).toEqual(["foo", "bar"]);
    });

    it("trims whitespace around each token", () => {
      expect(buildCommand(" foo \n bar ")).toEqual(["foo", "bar"]);
    });
  });
});
