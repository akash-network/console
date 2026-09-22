import type { SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import { findGpuServices } from "./sdl-gpu-services";

describe("findGpuServices", () => {
  it("names the services of the placement whose profile asks for a gpu", () => {
    const sdl = setup({
      deployment: { web: { dcloud: { profile: "gpu" } }, worker: { dcloud: { profile: "plain" } } },
      compute: { gpu: { gpu: 1 }, plain: {} }
    });

    expect(findGpuServices(sdl, "dcloud")).toEqual(["web"]);
  });

  it("names every gpu service rather than only the first", () => {
    const sdl = setup({
      deployment: { web: { dcloud: { profile: "gpu" } }, trainer: { dcloud: { profile: "gpu" } } },
      compute: { gpu: { gpu: 1 } }
    });

    expect(findGpuServices(sdl, "dcloud")).toEqual(["web", "trainer"]);
  });

  it("ignores a service placed somewhere else", () => {
    const sdl = setup({
      deployment: { web: { dcloud: { profile: "gpu" } }, other: { elsewhere: { profile: "gpu" } } },
      compute: { gpu: { gpu: 1 } }
    });

    expect(findGpuServices(sdl, "dcloud")).toEqual(["web"]);
  });

  it("reads a profile named differently from the service it serves", () => {
    const sdl = setup({ deployment: { api: { dcloud: { profile: "inference" } } }, compute: { inference: { gpu: 2 } } });

    expect(findGpuServices(sdl, "dcloud")).toEqual(["api"]);
  });

  it("ignores a profile that asks for no gpu unit", () => {
    const sdl = setup({ deployment: { web: { dcloud: { profile: "gpu" } } }, compute: { gpu: { gpu: 0 } } });

    expect(findGpuServices(sdl, "dcloud")).toEqual([]);
  });

  it("ignores a service whose profile the sdl does not define", () => {
    const sdl = setup({ deployment: { web: { dcloud: { profile: "missing" } } }, compute: { gpu: { gpu: 1 } } });

    expect(findGpuServices(sdl, "dcloud")).toEqual([]);
  });

  it("names nothing for an sdl it was given none of", () => {
    expect(findGpuServices(null, "dcloud")).toEqual([]);
    expect(findGpuServices(undefined, "dcloud")).toEqual([]);
    expect(findGpuServices(setup({ deployment: {}, compute: {} }), "dcloud")).toEqual([]);
  });

  function setup(input: { deployment: Record<string, Record<string, { profile: string }>>; compute: Record<string, { gpu?: number }> }) {
    const compute = Object.fromEntries(
      Object.entries(input.compute).map(([name, profile]) => [name, { resources: profile.gpu === undefined ? {} : { gpu: { units: profile.gpu } } }])
    );

    return { deployment: input.deployment, profiles: { compute } } as unknown as SDLInput;
  }
});
