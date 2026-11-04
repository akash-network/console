import { describe, expect, it } from "vitest";

import { DEFAULT_GPU_REQUEST_ROUTING_POLICY, gpuRequestRoutingPolicySchema, isDataCenterGpu, isSameGpuModel } from "./gpu-request-routing-policy";

describe("GPU request routing policy", () => {
  it("defaults to the rules decided on November 3", () => {
    expect(DEFAULT_GPU_REQUEST_ROUTING_POLICY).toEqual({
      salesRules: {
        monthlyValue: { enabled: true, minUsd: 5000 },
        multiNode: { enabled: true, minGpus: 8 },
        interconnect: { enabled: true },
        longTermDataCenter: { enabled: true, minTermMonths: 6 },
        couldGrow: { enabled: true },
        wantsToTalk: { enabled: true }
      },
      salesRequiresPaymentMethod: true,
      dataCenterGpuModels: ["B300", "B200", "H200", "H100", "A100", "L40S", "MI355X", "MI325X", "MI300X"],
      referenceUsdPerGpuHour: {
        B300: 6,
        B200: 5,
        H200: 3.5,
        H100: 2.5,
        A100: 1.3,
        L40S: 1,
        MI355X: 3,
        MI325X: 2.5,
        MI300X: 2,
        "RTX 5090": 0.7,
        "RTX 4090": 0.45
      },
      owners: [],
      fallbackOwner: { name: "Sales" }
    });
  });

  it("fills the parameters a payload leaves out with their defaults", () => {
    const policy = gpuRequestRoutingPolicySchema.parse({ salesRules: { monthlyValue: { minUsd: 10_000 } }, salesRequiresPaymentMethod: false });

    expect(policy).toEqual({
      ...DEFAULT_GPU_REQUEST_ROUTING_POLICY,
      salesRules: { ...DEFAULT_GPU_REQUEST_ROUTING_POLICY.salesRules, monthlyValue: { enabled: true, minUsd: 10_000 } },
      salesRequiresPaymentMethod: false
    });
  });

  it.each([
    { payload: { salesRules: { monthlyValue: { minUsd: -1 } } } },
    { payload: { salesRules: { multiNode: { minGpus: 0 } } } },
    { payload: { salesRules: { longTermDataCenter: { minTermMonths: 1.5 } } } },
    { payload: { referenceUsdPerGpuHour: { H100: 0 } } },
    { payload: { salesRules: { couldGrow: { enabled: "yes" } } } },
    { payload: { owners: [{ name: "Remington", match: { areas: ["mars"] } }] } },
    { payload: { owners: [{ name: "Remington", match: { areas: [] } }] } },
    { payload: { owners: [{ name: " ", match: {} }] } },
    { payload: { fallbackOwner: { name: "Sales", email: "not-an-email" } } }
  ])("rejects $payload", ({ payload }) => {
    expect(gpuRequestRoutingPolicySchema.safeParse(payload).success).toBe(false);
  });

  describe(isDataCenterGpu.name, () => {
    it.each([
      { model: "h200", dataCenter: true },
      { model: "RTX 5090", dataCenter: false }
    ])("calls $model a data-center GPU: $dataCenter", ({ model, dataCenter }) => {
      expect(isDataCenterGpu(model, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toBe(dataCenter);
    });

    it("reads the data-center list of the policy", () => {
      expect(isDataCenterGpu("RTX 5090", gpuRequestRoutingPolicySchema.parse({ dataCenterGpuModels: ["RTX 5090"] }))).toBe(true);
    });
  });

  describe(isSameGpuModel.name, () => {
    it.each([
      { left: "H100", right: "h100", same: true },
      { left: " RTX 5090", right: "rtx 5090 ", same: true },
      { left: "H100", right: "H200", same: false }
    ])("compares '$left' with '$right' as $same", ({ left, right, same }) => {
      expect(isSameGpuModel(left, right)).toBe(same);
    });
  });
});
