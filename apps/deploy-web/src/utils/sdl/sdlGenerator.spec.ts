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
