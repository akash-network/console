import { generateManifest } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import { buildGpuCheckSdl, type GpuCheck, toPlacementName } from "./gpu-check-sdl";

describe(buildGpuCheckSdl.name, () => {
  it("builds a valid SDL with one group per check, in the order the checks came in", () => {
    const checks: GpuCheck[] = Array.from({ length: 12 }, (_, index) => ({ model: `model${index}`, shape: index % 2 ? "typical" : "pricing" }));

    const manifest = generateManifest(buildGpuCheckSdl(checks));

    expect(manifest.ok).toBe(true);
    const { groupSpecs } = (manifest as Extract<typeof manifest, { ok: true }>).value;
    expect(groupSpecs.map(group => group.resources[0].resource!.gpu!.attributes.map(attribute => attribute.key))).toEqual(
      checks.map(({ model }) => [`vendor/nvidia/model/${model}`])
    );
  });

  it("asks a pricing check for one gpu with tiny cpu, memory and storage, at a ceiling price no provider would refuse", () => {
    const sdl = buildGpuCheckSdl([{ model: "h100", shape: "pricing" }]);

    expect(sdl.services.gpu00).toEqual({
      image: "ubuntu:22.04",
      command: ["sh", "-c"],
      args: ["uptime; nvidia-smi; sleep infinity"],
      expose: [{ port: 8080, as: 80, to: [{ global: true }] }]
    });
    expect(sdl.profiles.compute.gpu00.resources).toEqual({
      cpu: { units: 0.1 },
      memory: { size: "256Mi" },
      storage: { size: "256Mi" },
      gpu: { units: 1, attributes: { vendor: { nvidia: [{ model: "h100" }] } } }
    });
    expect(sdl.profiles.placement.gpu00.pricing).toEqual({ gpu00: { denom: "uact", amount: 100_000 } });
    expect(sdl.deployment.gpu00).toEqual({ gpu00: { profile: "gpu00", count: 1 } });
  });

  it("asks a typical check for one gpu with the cpu, memory and storage gpu deployments usually ask for", () => {
    const sdl = buildGpuCheckSdl([{ model: "h100", shape: "typical" }]);

    expect(sdl.profiles.compute.gpu00.resources).toEqual({
      cpu: { units: 4 },
      memory: { size: "16Gi" },
      storage: { size: "40Gi" },
      gpu: { units: 1, attributes: { vendor: { nvidia: [{ model: "h100" }] } } }
    });
  });
});

describe(toPlacementName.name, () => {
  it("pads the index so names sort in index order", () => {
    expect([toPlacementName(0), toPlacementName(9), toPlacementName(19)]).toEqual(["gpu00", "gpu09", "gpu19"]);
  });
});
