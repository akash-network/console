import { describe, expect, it } from "vitest";

import { hardwareRequestTitle } from "./hardware-request-title";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

describe(hardwareRequestTitle.name, () => {
  it.each([
    { hardwareRequest: createHardwareRequest({ category: "gpu_model", gpuModel: "B200", quantity: 8 }), title: "GPU request: 8× B200" },
    { hardwareRequest: createHardwareRequest({ category: "capacity", gpuModel: "H100", quantity: 64 }), title: "Capacity request: 64× H100" },
    { hardwareRequest: createHardwareRequest({ category: "capacity", gpuModel: null, quantity: 32 }), title: "Capacity request: 32 GPUs" },
    {
      hardwareRequest: createHardwareRequest({ category: "region", gpuModel: null, quantity: null, region: "Frankfurt" }),
      title: "Region request: Frankfurt"
    },
    { hardwareRequest: createHardwareRequest({ category: "other", gpuModel: null, quantity: null }), title: "Hardware request" }
  ])("titles a $hardwareRequest.category request '$title'", ({ hardwareRequest, title }) => {
    expect(hardwareRequestTitle(hardwareRequest)).toBe(title);
  });
});
