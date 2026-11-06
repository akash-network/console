import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import type { ServiceResources } from "../serviceResourcesFormat/serviceResourcesFormat";
import { SharedComputeProfileError, withServiceResources } from "./withServiceResources";

const SDL = `
version: "2.0"
services:
  web:
    image: vllm/vllm-openai:v0.6.3
    env:
      - HF_TOKEN=ac-secret://HF_TOKEN
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 500m
        memory:
          size: 16Gi
        storage:
          - size: 50Gi
          - name: models
            size: 100Gi
            attributes:
              persistent: true
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: rtx4090
                  ram: 24Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 10000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const BEFORE: ServiceResources = { cpu: 0.5, memory: "16Gi", storage: ["50Gi", "100Gi"], gpu: { units: 1, models: ["nvidia/rtx4090"] }, count: 1 };

describe(withServiceResources.name, () => {
  it("changes only the fields that differ and keeps pricing, env and other attributes", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: { ...BEFORE, memory: "32Gi", storage: ["50Gi", "200Gi"], count: 2 } }]);

    const document = parse(sdl);
    expect(document.profiles.compute.web.resources).toEqual({
      cpu: { units: "500m" },
      memory: { size: "32Gi" },
      storage: [{ size: "50Gi" }, { name: "models", size: "200Gi", attributes: { persistent: true } }],
      gpu: { units: 1, attributes: { vendor: { nvidia: [{ model: "rtx4090", ram: "24Gi" }] } } }
    });
    expect(document.deployment.web.dcloud).toEqual({ profile: "web", count: 2 });
    expect(document.profiles.placement.dcloud.pricing).toEqual({ web: { denom: "uact", amount: 10000 } });
    expect(document.services.web.env).toEqual(["HF_TOKEN=ac-secret://HF_TOKEN"]);
  });

  it("changes the CPU units", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: { ...BEFORE, cpu: 4 } }]);

    expect(parse(sdl).profiles.compute.web.resources.cpu).toEqual({ units: 4 });
  });

  it("changes the GPU count while keeping the model's attributes", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: { ...BEFORE, gpu: { units: 2, models: ["nvidia/rtx4090"] } } }]);

    expect(parse(sdl).profiles.compute.web.resources.gpu).toEqual({ units: 2, attributes: { vendor: { nvidia: [{ model: "rtx4090", ram: "24Gi" }] } } });
  });

  it("switches the GPU model, defaulting a bare model to nvidia", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: { ...BEFORE, gpu: { units: 1, models: ["nvidia/a100", "h100"] } } }]);

    expect(parse(sdl).profiles.compute.web.resources.gpu.attributes).toEqual({ vendor: { nvidia: [{ model: "a100" }, { model: "h100" }] } });
  });

  it("accepts any model of the current vendor when no model is listed", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: { ...BEFORE, gpu: { units: 1, models: [] } } }]);

    expect(parse(sdl).profiles.compute.web.resources.gpu.attributes).toEqual({ vendor: { nvidia: null } });
  });

  it("adds a GPU to a CPU-only service as any nvidia model", () => {
    const cpuOnly = SDL.replace(/ {8}gpu:[\s\S]*?ram: 24Gi\n/, "");
    const before = { ...BEFORE, gpu: null };
    const sdl = withServiceResources(cpuOnly, [{ service: "web", before, after: { ...before, gpu: { units: 1, models: [] } } }]);

    expect(parse(sdl).profiles.compute.web.resources.gpu).toEqual({ units: 1, attributes: { vendor: { nvidia: null } } });
  });

  it("removes the GPU", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: { ...BEFORE, gpu: null } }]);

    expect(parse(sdl).profiles.compute.web.resources.gpu).toBeUndefined();
  });

  it("resizes a single storage volume", () => {
    const singleVolume = SDL.replace(/ {8}storage:[\s\S]*?persistent: true\n/, "        storage:\n          size: 50Gi\n");
    const before = { ...BEFORE, storage: ["50Gi"] };
    const sdl = withServiceResources(singleVolume, [{ service: "web", before, after: { ...before, storage: ["80Gi"] } }]);

    expect(parse(sdl).profiles.compute.web.resources.storage).toEqual({ size: "80Gi" });
  });

  it("leaves the SDL as it was when nothing differs", () => {
    const sdl = withServiceResources(SDL, [{ service: "web", before: BEFORE, after: BEFORE }]);

    expect(parse(sdl)).toEqual(parse(SDL));
  });

  it("refuses a service without a compute profile", () => {
    expect(() => withServiceResources(SDL, [{ service: "worker", before: BEFORE, after: BEFORE }])).toThrow(
      "The SDL has no compute profile for service worker."
    );
  });

  it("refuses a compute profile another service shares", () => {
    const shared = `${SDL}  worker:\n    dcloud:\n      profile: web\n      count: 1\n`;

    expect(() => withServiceResources(shared, [{ service: "web", before: BEFORE, after: { ...BEFORE, memory: "32Gi" } }])).toThrow(SharedComputeProfileError);
  });

  function parse(sdl: string) {
    return yaml.load(sdl) as {
      services: Record<string, { env: string[] }>;
      profiles: { compute: Record<string, { resources: Record<string, any> }>; placement: Record<string, { pricing: unknown }> };
      deployment: Record<string, Record<string, unknown>>;
    };
  }
});
