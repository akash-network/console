import yaml from "js-yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { buildCommand, generateSdl } from "./sdlGenerator";
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

    it("preserves a leading sh -c instead of stripping it", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'"])).toEqual("sh\n-c\necho 'foo'");
    });

    it("joins every command element with a newline", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "echo 'bar'"])).toEqual("sh\n-c\necho 'foo'\necho 'bar'");
    });

    it("joins every command element with a newline, dropping empty lines", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "", "echo 'bar'"])).toEqual("sh\n-c\necho 'foo'\necho 'bar'");
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

    it("gives each service its own placement when placementPerService is set", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const { placements, services } = importSimpleSdl(yml, { placementPerService: true });

      expect(placements).toHaveLength(2);
      expect(placements.every(placement => placement.name === "dcloud")).toBe(true);
      expect(services.map(service => service.placementId)).toEqual([placements[0].id, placements[1].id]);
      expect(new Set(services.map(service => service.placementId)).size).toBe(2);
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

    it.each([
      { command: ["bash", "-lc"], args: ["./run.sh"] },
      { command: ["sh", "-c"], args: ["echo hi"] },
      { command: ["sh", "-c", "echo foo"], args: undefined },
      { command: ["bash", "-c"], args: ["run"] }
    ])("preserves command $command and args $args without forcing a shell wrapper", ({ command, args }) => {
      const formCommand = parseSvcCommand(command);
      const formArg = args ? args[0] : "";

      const rebuiltCommand = buildCommand(formCommand.trim());
      const rebuiltArgs = formArg ? [formArg] : undefined;

      expect(rebuiltCommand).toEqual(command);
      expect(rebuiltArgs).toEqual(args);
    });

    it("does not emit an args key when a service has a command but no args", () => {
      const yml = [
        "version: '2.0'",
        "services:",
        "  web:",
        "    image: nginx:1.0",
        "    command:",
        "      - sh",
        "      - -c",
        "      - echo hello",
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

      const regenerated = generateSdl(importSimpleSdl(yml));
      const parsed = yaml.load(regenerated) as { services: Record<string, { command?: unknown }> };

      expect(parsed.services.web.command).toEqual(["sh", "-c", "echo hello"]);
      expect(parsed.services.web).not.toHaveProperty("args");
    });
  });
});
