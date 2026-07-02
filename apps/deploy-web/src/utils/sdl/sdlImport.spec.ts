import yaml from "js-yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

import { SdlBuilderFormValuesSchema } from "@src/types/sdlBuilder/sdlBuilder";
import { defaultServiceWithPlacement } from "./data";
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

    it("imports a reserved SSH_PUBKEY env var as a managed entry (id equals key) so the schema exempts it", () => {
      const yml = sshPubKeySdl("ssh-rsa AAAAimported");

      const { services } = importSimpleSdl(yml);

      const sshEnv = services[0].env?.find(e => e.key === "SSH_PUBKEY");
      expect(sshEnv).toMatchObject({ id: "SSH_PUBKEY", key: "SSH_PUBKEY", value: "ssh-rsa AAAAimported" });
    });

    it("validates a deployment imported with an SSH_PUBKEY env var without flagging the reserved key", () => {
      const values = importSimpleSdl(sshPubKeySdl("ssh-rsa AAAAimported"));

      const result = SdlBuilderFormValuesSchema.safeParse(values);

      const envIssue = result.success ? undefined : result.error.issues.find(issue => issue.message.includes("reserved variable name"));
      expect(envIssue).toBeUndefined();
    });

    it("preserves env values that contain '=' instead of truncating at the first one", () => {
      const yml = envSdl(["DB_URL=postgres://u:p@h/db?a=1&b=2", "TOKEN=YWJjZGVm=="]);

      const { services } = importSimpleSdl(yml);

      expect(services[0].env).toContainEqual(expect.objectContaining({ key: "DB_URL", value: "postgres://u:p@h/db?a=1&b=2" }));
      expect(services[0].env).toContainEqual(expect.objectContaining({ key: "TOKEN", value: "YWJjZGVm==" }));
    });

    function sshPubKeySdl(sshPubKey: string) {
      return envSdl([`SSH_PUBKEY=${sshPubKey}`]);
    }

    function envSdl(envLines: string[]) {
      return [
        "version: '2.0'",
        "services:",
        "  web:",
        "    image: nginx:1.0",
        "    env:",
        ...envLines.map(line => `      - ${line}`),
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
    }
    it("captures params.tee onto the service model", () => {
      const { services } = importSimpleSdl(teeSdl("cpu-gpu"));

      expect(services[0].params?.tee).toBe("cpu-gpu");
    });

    it("leaves params undefined when the service has no tee param", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const { services } = importSimpleSdl(yml);

      expect(services[0].params).toBeUndefined();
    });
  });

  describe("SDL roundtrip", () => {
    it("preserves params.tee when importing then regenerating the SDL", () => {
      const regenerated = generateSdl(importSimpleSdl(teeSdl("cpu")));
      const parsed = yaml.load(regenerated) as { services: Record<string, { params?: { tee?: string } }> };

      expect(parsed.services.web.params?.tee).toBe("cpu");
    });

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

const teeSdl = (tee: "cpu" | "cpu-gpu") =>
  [
    "version: '2.1'",
    "services:",
    "  web:",
    "    image: nginx:latest",
    "    expose:",
    "      - port: 80",
    "        as: 80",
    "        to:",
    "          - global: true",
    "    params:",
    `      tee: ${tee}`,
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
    "          denom: uakt",
    "          amount: 1000",
    "deployment:",
    "  web:",
    "    dcloud:",
    "      profile: web",
    "      count: 1"
  ].join("\n");

describe("importSimpleSdl endpoints", () => {
  it("round-trips an endpoint referenced by a service back into the form model", () => {
    const formValues = defaultServiceWithPlacement({ image: "nginx:latest" });
    formValues.endpoints = [{ id: "e-1", name: "endpoint-1" }];
    formValues.services[0].expose[0].ipName = "endpoint-1";
    const sdl = generateSdl(formValues);

    const imported = importSimpleSdl(sdl);

    expect(imported.endpoints?.map(endpoint => endpoint.name)).toEqual(["endpoint-1"]);
    expect(imported.services[0].expose[0].ipName).toBe("endpoint-1");
  });
});

const reclamationSdl = (minWindow: string) =>
  [
    "version: '2.0'",
    "reclamation:",
    `  min_window: ${minWindow}`,
    "services:",
    "  web:",
    "    image: nginx:latest",
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
    "          denom: uakt",
    "          amount: 1000",
    "deployment:",
    "  web:",
    "    dcloud:",
    "      profile: web",
    "      count: 1"
  ].join("\n");

describe("importSimpleSdl reclamation", () => {
  it.each([["1h"], ["4h"], ["24h"], ["72h"]] as const)("imports reclamation.min_window %s into reclamationMinWindow", minWindow => {
    expect(importSimpleSdl(reclamationSdl(minWindow)).reclamationMinWindow).toBe(minWindow);
  });

  it("leaves reclamationMinWindow undefined when there is no reclamation block", () => {
    const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

    expect(importSimpleSdl(yml).reclamationMinWindow).toBeUndefined();
  });

  it("ignores a reclamation window the builder cannot represent", () => {
    expect(importSimpleSdl(reclamationSdl("30m")).reclamationMinWindow).toBeUndefined();
  });

  it.each([["1h"], ["24h"]] as const)("round-trips reclamation.min_window %s through import then regeneration", minWindow => {
    const regenerated = generateSdl(importSimpleSdl(reclamationSdl(minWindow)));
    const parsed = yaml.load(regenerated) as { reclamation?: { min_window?: string } };

    expect(parsed.reclamation).toEqual({ min_window: minWindow });
  });
});
