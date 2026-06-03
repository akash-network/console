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

  describe("buildCommand", () => {
    it("returns empty string for an empty string", () => {
      expect(buildCommand("")).toEqual("");
    });

    it("returns string if command is a single line string", () => {
      expect(buildCommand("echo 'foo'")).toEqual("echo 'foo'");
    });

    it("returns array starting with sh -c when it starts with sh -c", () => {
      expect(buildCommand("sh -c foo")).toEqual(["sh", "-c", "foo\n"]);
    });

    it("returns array containing only sh -c when it is only with sh -c", () => {
      expect(buildCommand("sh -c")).toEqual(["sh", "-c"]);
    });

    it("returns array starting with sh -c for a multi-line string", () => {
      expect(buildCommand("foo\nbar")).toEqual(["sh", "-c", "foo\nbar\n"]);
    });

    it("returns array starting with sh -c for a multi-line string with a newline at the end", () => {
      expect(buildCommand("foo\nbar\n")).toEqual(["sh", "-c", "foo\nbar\n"]);
    });

    it("returns array starting with sh -c for a multi-line string with multiple newlines at the end", () => {
      expect(buildCommand("foo\nbar\n\n")).toEqual(["sh", "-c", "foo\nbar\n"]);
    });
  });
});
