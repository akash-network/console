import yaml from "js-yaml";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { ServiceType } from "@src/types";
import { buildCommand, generateSdl } from "./sdlGenerator";

describe("sdlGenerator", () => {
  describe(generateSdl.name, () => {
    it("includes permissions params for log-collector services", () => {
      const result = generateSdl([createLogCollectorService()]);
      const parsed = yaml.load(result) as { services: Record<string, ServiceType> };

      expect(parsed.services["web-log-collector"].params).toEqual({
        permissions: {
          read: ["deployment", "logs"]
        }
      });
    });

    it("does not include permissions params for non-log-collector services", () => {
      const result = generateSdl([createLogCollectorService({ title: "web", image: "nginx:latest" })]);
      const parsed = yaml.load(result) as { services: Record<string, { params?: unknown }> };

      expect(parsed.services["web"].params).toBeUndefined();
    });

    function createLogCollectorService(overrides?: Partial<ServiceType>): ServiceType {
      return {
        id: "web-log-collector",
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
        placement: {
          name: "dcloud",
          pricing: { amount: 1000, denom: "uakt" }
        },
        count: 1,
        ...overrides
      } as ServiceType;
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
