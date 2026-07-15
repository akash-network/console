import { DeploymentReclamation } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { applyTrialGpuPolicy, hasTrialBlockedGpu, isTrialBlockedGpuModel, isTrialBlockedGpuSelection, NewDeploymentData, replaceSdlDenom } from "./v1beta3";

describe(replaceSdlDenom.name, () => {
  it("replaces denom in a single placement pricing entry", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(parsePricing(result, "dcloud", "web").denom).toBe("uact");
  });

  it("replaces denom across multiple services in the same placement", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt", api: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(parsePricing(result, "dcloud", "web").denom).toBe("uact");
    expect(parsePricing(result, "dcloud", "api").denom).toBe("uact");
  });

  it("replaces denom across multiple placements", () => {
    const ibcDenom = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
    const { sdl } = setup({ placements: { us: { web: "uakt" }, eu: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, ibcDenom);

    expect(parsePricing(result, "us", "web").denom).toBe(ibcDenom);
    expect(parsePricing(result, "eu", "web").denom).toBe(ibcDenom);
  });

  it("preserves non-pricing SDL fields", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.version).toBe("2.0");
    expect(parsed.services.web.image).toBe("nginx");
    expect(parsePricing(result, "dcloud", "web").amount).toBe(1000);
    expect(parsed.deployment.web.dcloud.profile).toBe("web");
  });

  it("handles SDL with empty placement gracefully", () => {
    const { sdl } = setup({ placements: {} });

    const result = replaceSdlDenom(sdl, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement).toEqual({});
  });

  it("returns valid YAML prefixed with document separator", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(result).toMatch(/^---\n/);
    expect(() => yaml.load(result)).not.toThrow();
  });

  interface ParsedSdl {
    version: string;
    services: Record<string, { image: string }>;
    profiles: {
      compute: Record<string, unknown>;
      placement: Record<string, { pricing: Record<string, { denom: string; amount: number }> }>;
    };
    deployment: Record<string, Record<string, { profile: string; count: number }>>;
  }

  function parsePricing(resultYaml: string, placement: string, service: string) {
    const parsed = yaml.load(resultYaml) as ParsedSdl;
    return parsed.profiles.placement[placement].pricing[service];
  }

  function setup(input: { placements: Record<string, Record<string, string>> }) {
    const placements: Record<string, { pricing: Record<string, { denom: string; amount: number }> }> = {};
    const services: Record<string, { image: string }> = {};
    const compute: Record<string, { resources: Record<string, never> }> = {};
    const deployment: Record<string, Record<string, { profile: string; count: number }>> = {};

    for (const [placementName, pricing] of Object.entries(input.placements)) {
      placements[placementName] = { pricing: {} };
      for (const [serviceName, denom] of Object.entries(pricing)) {
        placements[placementName].pricing[serviceName] = { denom, amount: 1000 };
        services[serviceName] = services[serviceName] || { image: "nginx" };
        compute[serviceName] = compute[serviceName] || { resources: {} };
        deployment[serviceName] = deployment[serviceName] || {};
        deployment[serviceName][placementName] = { profile: serviceName, count: 1 };
      }
    }

    const sdl = yaml.dump({
      version: "2.0",
      services,
      profiles: { compute, placement: placements },
      deployment
    });

    return { sdl };
  }
});

describe(applyTrialGpuPolicy.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/h200", "nvidia/rtxa6000"];

  it("returns the SDL unchanged when no GPU section is present", () => {
    const sdl = buildSdl({});

    expect(applyTrialGpuPolicy(sdl, BLOCKED)).toBe(sdl);
  });

  it("returns the SDL unchanged when blocked list is empty", () => {
    const sdl = buildSdl({ nvidia: [{ model: "h100" }] });

    expect(applyTrialGpuPolicy(sdl, [])).toBe(sdl);
  });

  it("clears vendor.nvidia to any-model when its model list is empty", () => {
    const sdl = buildSdl({ nvidia: [] });

    const result = applyTrialGpuPolicy(sdl, BLOCKED);

    expect(getNvidiaValue(result)).toBeNull();
  });

  it("strips blocked models from the requested list", () => {
    const sdl = buildSdl({ nvidia: [{ model: "h100" }, { model: "a100" }, { model: "rtxa4000" }] });

    const result = applyTrialGpuPolicy(sdl, BLOCKED);

    expect(getNvidiaValue(result)).toEqual([{ model: "a100" }, { model: "rtxa4000" }]);
  });

  it("strips rtxa6000 when present in the blocked list", () => {
    const sdl = buildSdl({ nvidia: [{ model: "rtxa6000" }, { model: "rtxa4000" }] });

    const result = applyTrialGpuPolicy(sdl, BLOCKED);

    expect(getNvidiaValue(result)).toEqual([{ model: "rtxa4000" }]);
  });

  it("clears vendor.nvidia to any-model when every requested model is blocked", () => {
    const sdl = buildSdl({ nvidia: [{ model: "h100" }, { model: "h200" }] });

    const result = applyTrialGpuPolicy(sdl, BLOCKED);

    expect(getNvidiaValue(result)).toBeNull();
  });

  it("returns the SDL unchanged when every requested model is already allowed", () => {
    const sdl = buildSdl({ nvidia: [{ model: "rtxa4000" }] });

    expect(applyTrialGpuPolicy(sdl, BLOCKED)).toBe(sdl);
  });

  function buildSdl(input: { nvidia?: Array<{ model?: string; ram?: string }> }): string {
    const gpu = input.nvidia ? { units: 1, attributes: { vendor: { nvidia: input.nvidia } } } : undefined;
    return yaml.dump({
      version: "2.0",
      services: { app: { image: "nginx" } },
      profiles: {
        compute: {
          app: {
            resources: {
              cpu: { units: 0.5 },
              memory: { size: "512Mi" },
              storage: { size: "512Mi" },
              ...(gpu ? { gpu } : {})
            }
          }
        },
        placement: { dcloud: { pricing: { app: { denom: "uact", amount: 1000 } } } }
      },
      deployment: { app: { dcloud: { profile: "app", count: 1 } } }
    });
  }

  function getNvidiaValue(yamlStr: string): Array<{ model?: string }> | null | undefined {
    const sdl = yaml.load(yamlStr) as {
      profiles: { compute: Record<string, { resources: { gpu?: { attributes?: { vendor?: { nvidia?: Array<{ model?: string }> | null } } } } }> };
    };
    const profile = Object.values(sdl.profiles.compute)[0];
    return profile.resources.gpu?.attributes?.vendor?.nvidia;
  }
});

describe(isTrialBlockedGpuModel.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/a100"];

  it("blocks a listed vendor/model case-insensitively", () => {
    expect(isTrialBlockedGpuModel("nvidia", "h100", BLOCKED)).toBe(true);
    expect(isTrialBlockedGpuModel("NVIDIA", "H100", BLOCKED)).toBe(true);
  });

  it("allows a model that is not on the blocked list", () => {
    expect(isTrialBlockedGpuModel("nvidia", "t4", BLOCKED)).toBe(false);
  });

  it("never blocks when the vendor or model is missing", () => {
    expect(isTrialBlockedGpuModel(undefined, "h100", BLOCKED)).toBe(false);
    expect(isTrialBlockedGpuModel("nvidia", "", BLOCKED)).toBe(false);
  });

  it("never blocks when the blocked list is empty", () => {
    expect(isTrialBlockedGpuModel("nvidia", "h100", [])).toBe(false);
  });
});

describe(isTrialBlockedGpuSelection.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/a100"];

  it("blocks an empty model when the vendor exposes any blocked model", () => {
    expect(isTrialBlockedGpuSelection("nvidia", "", BLOCKED)).toBe(true);
    expect(isTrialBlockedGpuSelection("NVIDIA", undefined, BLOCKED)).toBe(true);
  });

  it("allows an empty model when the vendor exposes no blocked model", () => {
    expect(isTrialBlockedGpuSelection("amd", "", BLOCKED)).toBe(false);
  });

  it("does not treat a prefix-colliding vendor as blocked", () => {
    expect(isTrialBlockedGpuSelection("nvidiax", "", BLOCKED)).toBe(false);
  });

  it("defers a specific model to isTrialBlockedGpuModel", () => {
    expect(isTrialBlockedGpuSelection("nvidia", "h100", BLOCKED)).toBe(true);
    expect(isTrialBlockedGpuSelection("nvidia", "t4", BLOCKED)).toBe(false);
  });

  it("never blocks when the vendor is missing", () => {
    expect(isTrialBlockedGpuSelection(undefined, "", BLOCKED)).toBe(false);
    expect(isTrialBlockedGpuSelection(null, "h100", BLOCKED)).toBe(false);
  });

  it("never blocks when the blocked list is empty", () => {
    expect(isTrialBlockedGpuSelection("nvidia", "", [])).toBe(false);
    expect(isTrialBlockedGpuSelection("nvidia", "h100", [])).toBe(false);
  });
});

describe(hasTrialBlockedGpu.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/a100"];

  it("flags a GPU-enabled service left on the empty (any) model", () => {
    const values = buildValues([{ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(true);
  });

  it("flags a GPU-enabled service on a specific blocked model", () => {
    const values = buildValues([{ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "h100" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(true);
  });

  it("does not flag a GPU-enabled service on a specific allowed model", () => {
    const values = buildValues([{ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "t4" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(false);
  });

  it("ignores services with GPU turned off even if the model is blocked", () => {
    const values = buildValues([{ hasGpu: false, gpuModels: [{ vendor: "nvidia", name: "" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(false);
  });

  it("flags when any one of multiple services has a blocked GPU selection", () => {
    const values = buildValues([
      { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "t4" }] },
      { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] }
    ]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(true);
  });

  function buildValues(services: Array<{ hasGpu: boolean; gpuModels: Array<{ vendor: string; name?: string }> }>): SdlBuilderFormValuesType {
    const base = defaultServiceWithPlacement();
    const placementId = base.placements[0].id;
    return {
      ...base,
      services: services.map((service, index) =>
        defaultService(placementId, {
          title: `service-${index + 1}`,
          profile: { ...base.services[0].profile, hasGpu: service.hasGpu, gpuModels: service.gpuModels }
        })
      )
    };
  }
});

describe(NewDeploymentData.name, () => {
  it("forwards the reclamation block when the SDL declares one", async () => {
    const sdl = setup({ version: "2.1", reclamation: { min_window: "24h" } });

    const result = await NewDeploymentData(sdl, null, "akash1abc", 5);

    expect(result.reclamation).toEqual(DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400 } }));
  });

  it("omits reclamation for an SDL without a reclamation block", async () => {
    const sdl = setup({ version: "2.0" });

    const result = await NewDeploymentData(sdl, null, "akash1abc", 5);

    expect(result.reclamation).toBeUndefined();
  });

  function setup(input: { version: "2.0" | "2.1"; reclamation?: { min_window: string } }) {
    return yaml.dump({
      version: input.version,
      services: { web: { image: "nginx", expose: [{ port: 80, as: 80, to: [{ global: true }] }] } },
      profiles: {
        compute: { web: { resources: { cpu: { units: 0.5 }, memory: { size: "512Mi" }, storage: { size: "1Gi" } } } },
        placement: { dcloud: { pricing: { web: { denom: "uakt", amount: 1000 } } } }
      },
      deployment: { web: { dcloud: { profile: "web", count: 1 } } },
      ...(input.reclamation ? { reclamation: input.reclamation } : {})
    });
  }
});
