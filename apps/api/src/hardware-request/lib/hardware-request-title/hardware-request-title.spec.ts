import { describe, expect, it } from "vitest";

import { hardwareRequestTitle } from "./hardware-request-title";

import { createHardwareRequest, createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";

describe(hardwareRequestTitle.name, () => {
  it.each([
    { hardwareRequest: createHardwareRequest({ category: "gpu_model", gpuModel: "B200", quantity: 8 }), title: "GPU request: 8× B200" },
    { hardwareRequest: createHardwareRequest({ category: "capacity", gpuModel: "H100", quantity: 64 }), title: "Capacity request: 64× H100" },
    { hardwareRequest: createHardwareRequest({ category: "capacity", gpuModel: null, quantity: 32 }), title: "Capacity request: 32 GPUs" },
    {
      hardwareRequest: createHardwareRequest({ category: "region", gpuModel: null, quantity: null, region: "Frankfurt" }),
      title: "Region request: Frankfurt"
    },
    { hardwareRequest: createHardwareRequest({ category: "other", gpuModel: null, quantity: null }), title: "Hardware request" },
    {
      hardwareRequest: createHardwareRequest({
        category: "quote",
        spec: createHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "cluster" } })
      }),
      title: "Quote request: 16× H200 (2 nodes)"
    },
    { hardwareRequest: createHardwareRequest({ category: "quote", spec: null, gpuModel: "L40S", quantity: 4 }), title: "Quote request: 4× L40S" }
  ])("titles a $hardwareRequest.category request '$title'", ({ hardwareRequest, title }) => {
    expect(hardwareRequestTitle(hardwareRequest)).toBe(title);
  });
});
