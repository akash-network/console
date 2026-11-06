import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

import type { ServiceResources } from "@src/feedback/http-schemas/assistant-action.schema";
import { sdlWithResources } from "./sdl-with-resources";

const SDL = `version: "2.0"
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
        memory:
          size: 1Gi
        storage:
          - size: 2Gi
          - name: data
            size: 10Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: a100
                  ram: 80Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const BEFORE: ServiceResources = { cpu: 1, memory: "1Gi", storage: ["2Gi", "10Gi"], gpu: { units: 1, models: ["nvidia/a100"] }, count: 1 };

type Document = {
  profiles: { compute: { web: { resources: Record<string, unknown> } }; placement: unknown };
  deployment: { web: { dcloud: { count: number } } };
};

function rewritten(after: Partial<ServiceResources>, sdl = SDL): Document {
  return load(sdlWithResources(sdl, [{ service: "web", before: BEFORE, after: { ...BEFORE, ...after } }]) as string) as Document;
}

describe(sdlWithResources.name, () => {
  it("rewrites cpu, memory, storage sizes and replicas, and leaves pricing alone", () => {
    const document = rewritten({ cpu: 2, memory: "4Gi", storage: ["4Gi", "20Gi"], count: 3 });

    expect(document.profiles.compute.web.resources).toMatchObject({
      cpu: { units: 2 },
      memory: { size: "4Gi" },
      storage: [{ size: "4Gi" }, { name: "data", size: "20Gi" }]
    });
    expect(document.deployment.web.dcloud.count).toBe(3);
    expect(document.profiles.placement).toEqual({ dcloud: { pricing: { web: { denom: "uact", amount: 1000 } } } });
  });

  it("leaves what did not change, including fields it was given as unknown", () => {
    const document = rewritten({ cpu: null, memory: null, count: null, storage: ["2Gi"] });

    expect(document.profiles.compute.web.resources).toMatchObject({ cpu: { units: 1 }, memory: { size: "1Gi" }, storage: [{ size: "2Gi" }, { size: "10Gi" }] });
    expect(document.deployment.web.dcloud.count).toBe(1);
  });

  it("resizes a single storage volume", () => {
    const single = SDL.replace("          - size: 2Gi\n          - name: data\n            size: 10Gi\n", "          size: 2Gi\n");

    expect(rewritten({ storage: ["8Gi"] }, single).profiles.compute.web.resources.storage).toEqual({ size: "8Gi" });
    expect(rewritten({ storage: [] }, single).profiles.compute.web.resources.storage).toEqual({ size: "2Gi" });
  });

  it("keeps a listed model's other attributes and adds new models under their vendor", () => {
    const document = rewritten({ gpu: { units: 2, models: ["nvidia/a100", "h100", "amd/mi300x"] } });

    expect(document.profiles.compute.web.resources.gpu).toEqual({
      units: 2,
      attributes: { vendor: { nvidia: [{ model: "a100", ram: "80Gi" }, { model: "h100" }], amd: [{ model: "mi300x" }] } }
    });
  });

  it("asks for any model of the current vendor, or of nvidia for a new gpu", () => {
    const withoutGpu = SDL.replace(/ {8}gpu:\n(.*\n)*?(?= {2}placement)/, "");

    expect(rewritten({ gpu: { units: 2, models: [] } }).profiles.compute.web.resources.gpu).toEqual({ units: 2, attributes: { vendor: { nvidia: null } } });
    expect(
      load(sdlWithResources(withoutGpu, [{ service: "web", before: { ...BEFORE, gpu: null }, after: { ...BEFORE, gpu: { units: 1, models: [] } } }]) as string)
    ).toMatchObject({ profiles: { compute: { web: { resources: { gpu: { units: 1, attributes: { vendor: { nvidia: null } } } } } } } });
  });

  it("removes the gpu at zero", () => {
    expect(rewritten({ gpu: null }).profiles.compute.web.resources).not.toHaveProperty("gpu");
  });

  it.each([
    ["an unknown service", SDL, "api"],
    ["a service without a compute profile", SDL.replace("      profile: web\n", "      profile: missing\n"), "web"],
    ["a compute profile two services share", SDL.replace("      count: 1\n", "      count: 1\n  api:\n    dcloud:\n      profile: web\n      count: 1\n"), "web"]
  ])("answers null for %s", (_, sdl, service) => {
    expect(sdlWithResources(sdl, [{ service, before: BEFORE, after: { ...BEFORE, cpu: 4 } }])).toBeNull();
  });
});
