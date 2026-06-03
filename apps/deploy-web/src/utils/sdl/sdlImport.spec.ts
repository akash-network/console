import yaml from "js-yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { generateSdl } from "./sdlGenerator";
import { importSimpleSdl, parseSvcCommand } from "./sdlImport";

describe("sdlImport", () => {
  describe("parseSvcCommand", () => {
    it("returns empty string if command is not provided", () => {
      expect(parseSvcCommand()).toEqual("");
    });

    it("returns empty string if command is empty string", () => {
      expect(parseSvcCommand("")).toEqual("");
    });

    it("returns empty string if command is empty array", () => {
      expect(parseSvcCommand([])).toEqual("");
    });

    it("returns command as string if command is string", () => {
      expect(parseSvcCommand("echo 'foo'")).toEqual("echo 'foo'");
    });

    it("returns command as string if command is array of string", () => {
      expect(parseSvcCommand(["echo", "foo"])).toEqual("echo\nfoo");
    });

    it("returns command as string if command is array of string, drops empty lines", () => {
      expect(parseSvcCommand(["echo", "", "foo"])).toEqual("echo\nfoo");
    });

    it("returns command as string if command is array of strings with sh -c", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'"])).toEqual("echo 'foo'");
    });

    it("returns rest of command as string if command is array of strings with sh -c", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "echo 'bar'"])).toEqual("echo 'foo'\necho 'bar'");
    });

    it("returns rest of command as string if command is array of strings with sh -c, drops empty lines", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "", "echo 'bar'"])).toEqual("echo 'foo'\necho 'bar'");
    });
  });

  describe("importSimpleSdl", () => {
    it("returns services in the same order as in the SDL YAML", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const { services } = importSimpleSdl(yml);

      expect(services.map(service => service.title)).toEqual(["web", "service-2"]);
    });

    it("produces a deduplicated placements[] array when multiple services share a placement", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const { placements, services } = importSimpleSdl(yml);

      expect(placements).toHaveLength(1);
      expect(placements[0].name).toBe("dcloud");
      expect(services.every(service => service.placementId === placements[0].id)).toBe(true);
    });

    it("lifts location-region attribute onto placement.region", () => {
      const yml = [
        "version: '2.0'",
        "services:",
        "  web:",
        "    image: nginx:1.0",
        "    expose:",
        "      - port: 80",
        "        as: 80",
        "        to:",
        "          - global: true",
        "profiles:",
        "  compute:",
        "    web:",
        "      resources:",
        "        cpu:",
        "          units: 0.5",
        "        memory:",
        "          size: 512Mi",
        "        storage:",
        "          - size: 512Mi",
        "  placement:",
        "    dcloud:",
        "      attributes:",
        "        location-region: us-west",
        "      pricing:",
        "        web:",
        "          denom: uact",
        "          amount: 1000",
        "deployment:",
        "  web:",
        "    dcloud:",
        "      profile: web",
        "      count: 1"
      ].join("\n");

      const { placements } = importSimpleSdl(yml);

      expect(placements[0].region).toBe("us-west");
      expect(placements[0].attributes?.some(a => a.key === "location-region")).toBe(false);
    });

    it("lifts pricing onto each service", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const { services } = importSimpleSdl(yml);

      expect(services[0].pricing).toEqual({ amount: 1000, denom: "uact" });
      expect(services[1].pricing).toEqual({ amount: 100000, denom: "uact" });
    });
  });

  describe("SDL roundtrip", () => {
    it("imports an SDL, regenerates it, and produces semantically equal output", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");
      const formValues = importSimpleSdl(yml);
      const regenerated = generateSdl(formValues);

      const original = yaml.load(yml) as Record<string, unknown>;
      const roundtripped = yaml.load(regenerated) as Record<string, unknown>;

      expect(roundtripped).toEqual(original);
    });
  });
});
