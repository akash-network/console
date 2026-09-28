import { describe, expect, it } from "vitest";

import type { GpuVendor } from "@src/types/gpu";
import { summarizeGpu } from "./gpuSummary";

const CATALOG: GpuVendor[] = [
  {
    name: "nvidia",
    models: [
      { name: "h100", displayName: "H100", memory: [], interface: [] },
      { name: "rtx4090", displayName: "RTX 4090", memory: [], interface: [] },
      { name: "a100", displayName: "A100", memory: [], interface: [] }
    ]
  }
];

describe(summarizeGpu.name, () => {
  it.each([
    { case: "the GPU is off", profile: { hasGpu: false, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "h100" }] }, expected: "None" },
    { case: "the GPU is on with no units", profile: { hasGpu: true, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "h100" }] }, expected: "None" },
    { case: "a single model is pinned", profile: { hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "h100" }] }, expected: "2× H100" },
    { case: "the model has a marketing name", profile: { hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "rtx4090" }] }, expected: "1× RTX 4090" },
    { case: "the catalog does not list the model", profile: { hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "b200" }] }, expected: "1× B200" },
    { case: "any model is accepted", profile: { hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "" }] }, expected: "1× Any GPU" },
    { case: "no model entry exists", profile: { hasGpu: true, gpu: 1, gpuModels: [] }, expected: "1× Any GPU" },
    {
      case: "alternative models are accepted",
      profile: {
        hasGpu: true,
        gpu: 4,
        gpuModels: [
          { vendor: "nvidia", name: "a100" },
          { vendor: "nvidia", name: "h100" }
        ]
      },
      expected: "4× A100 / H100"
    },
    {
      case: "an alternative accepts any model",
      profile: {
        hasGpu: true,
        gpu: 1,
        gpuModels: [
          { vendor: "nvidia", name: "a100" },
          { vendor: "nvidia", name: "" }
        ]
      },
      expected: "1× Any GPU"
    },
    {
      case: "the same model is listed twice",
      profile: {
        hasGpu: true,
        gpu: 1,
        gpuModels: [
          { vendor: "nvidia", name: "h100" },
          { vendor: "nvidia", name: "h100" }
        ]
      },
      expected: "1× H100"
    }
  ])("reads $expected when $case", ({ profile, expected }) => {
    expect(summarizeGpu(profile, CATALOG)).toBe(expected);
  });

  it("falls back to the raw model name while the catalog is unavailable", () => {
    expect(summarizeGpu({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "h100" }] }, undefined)).toBe("1× H100");
  });
});
