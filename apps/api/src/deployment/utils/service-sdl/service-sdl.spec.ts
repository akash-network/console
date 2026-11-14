import { generateManifest } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import type { CreateDeploymentService } from "@src/deployment/http-schemas/deployment.schema";
import { buildServiceSdl } from "./service-sdl";

describe(buildServiceSdl.name, () => {
  it("writes one service named app with its image, env and public ports", () => {
    const sdl = buildServiceSdl(
      serviceWith({ image: "ghcr.io/acme/api:1.4.0", ports: [{ port: 3000, as: 80 }, { port: 9090 }], env: { LOG_LEVEL: "info", TOKEN: "a=b" } })
    );

    expect(sdl.version).toBe("2.0");
    expect(sdl.services).toEqual({
      app: {
        image: "ghcr.io/acme/api:1.4.0",
        env: ["LOG_LEVEL=info", "TOKEN=a=b"],
        expose: [
          { port: 3000, as: 80, to: [{ global: true }] },
          { port: 9090, as: 9090, to: [{ global: true }] }
        ]
      }
    });
  });

  it("declares no env for a service that sets no variable", () => {
    expect(buildServiceSdl(serviceWith({})).services.app).not.toHaveProperty("env");
    expect(buildServiceSdl(serviceWith({ env: {} })).services.app).not.toHaveProperty("env");
  });

  it("asks for the resources it was given, one replica, at the console's default price ceiling", () => {
    const sdl = buildServiceSdl(serviceWith({ resources: { cpu: 0.5, memory: "512Mi", storage: "1Gi" } }));

    expect(sdl.profiles.compute).toEqual({ app: { resources: { cpu: { units: 0.5 }, memory: { size: "512Mi" }, storage: { size: "1Gi" } } } });
    expect(sdl.profiles.placement).toEqual({ dcloud: { pricing: { app: { denom: "uact", amount: 100_000 } } } });
    expect(sdl.deployment).toEqual({ app: { dcloud: { profile: "app", count: 1 } } });
  });

  it("asks for the named gpu model", () => {
    const sdl = buildServiceSdl(serviceWith({ resources: { cpu: 4, memory: "16Gi", storage: "40Gi", gpu: { units: 2, model: "h100" } } }));

    expect(sdl.profiles.compute.app.resources.gpu).toEqual({ units: 2, attributes: { vendor: { nvidia: [{ model: "h100" }] } } });
  });

  it("asks for any nvidia gpu when no model is named", () => {
    const sdl = buildServiceSdl(serviceWith({ resources: { cpu: 4, memory: "16Gi", storage: "40Gi", gpu: { units: 1 } } }));

    expect(sdl.profiles.compute.app.resources.gpu).toEqual({ units: 1, attributes: { vendor: { nvidia: null } } });
  });

  it.each<[string, Partial<CreateDeploymentService>]>([
    ["a cpu-only service", {}],
    ["a service with env and two ports", { ports: [{ port: 3000, as: 80 }, { port: 9090 }], env: { LOG_LEVEL: "info" } }],
    ["a service on a named gpu model", { resources: { cpu: 4, memory: "16Gi", storage: "40Gi", gpu: { units: 1, model: "h100" } } }],
    ["a service on any gpu", { resources: { cpu: 4, memory: "16Gi", storage: "40Gi", gpu: { units: 1 } } }]
  ])("builds an SDL the manifest generator accepts for %s", (_, overrides) => {
    const manifest = generateManifest(buildServiceSdl(serviceWith(overrides)));

    expect(manifest.ok).toBe(true);
    const { groupSpecs } = (manifest as Extract<typeof manifest, { ok: true }>).value;
    expect(groupSpecs).toHaveLength(1);
    expect(groupSpecs[0].resources[0].resource!.endpoints.length).toBeGreaterThan(0);
  });

  function serviceWith(overrides: Partial<CreateDeploymentService>): CreateDeploymentService {
    return { image: "nginx:1.27.2", resources: { cpu: 0.5, memory: "512Mi", storage: "1Gi" }, ports: [{ port: 80 }], ...overrides };
  }
});
