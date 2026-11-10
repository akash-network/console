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
      dataCenterGpuModels: ["GB300", "B300", "B200", "H200", "H100", "A100", "L40S", "RTX PRO 6000 Server Edition", "MI355X", "MI325X", "MI300X"],
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
      fallbackOwner: { name: "Sales" },
      businessHours: { timeZone: "America/New_York", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 },
      responseTargets: {
        sales: { firstReplyBusinessHours: 4, firstOfferBusinessHours: 16 },
        automated: { firstReplyBusinessHours: 8, firstOfferBusinessHours: 8 },
        reminderLeadBusinessHours: 1
      }
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
    { payload: { fallbackOwner: { name: "Sales", email: "not-an-email" } } },
    { payload: { salesLead: { name: "" } } },
    { payload: { businessHours: { timeZone: "Mars/Olympus_Mons" } } },
    { payload: { businessHours: { days: [] } } },
    { payload: { businessHours: { days: [0] } } },
    { payload: { businessHours: { days: [8] } } },
    { payload: { businessHours: { startHour: -1 } } },
    { payload: { businessHours: { startHour: 24, endHour: 24 } } },
    { payload: { businessHours: { endHour: 25 } } },
    { payload: { businessHours: { endHour: 0 } } },
    { payload: { businessHours: { startHour: 9.5 } } },
    { payload: { businessHours: { startHour: 17, endHour: 17 } } },
    { payload: { responseTargets: { sales: { firstReplyBusinessHours: 0, firstOfferBusinessHours: 16 } } } },
    { payload: { responseTargets: { automated: { firstReplyBusinessHours: 8, firstOfferBusinessHours: -1 } } } },
    { payload: { responseTargets: { reminderLeadBusinessHours: 0 } } },
    { payload: { responseTargets: { sales: { firstReplyBusinessHours: 41, firstOfferBusinessHours: 16 } } } },
    { payload: { responseTargets: { automated: { firstReplyBusinessHours: 8, firstOfferBusinessHours: 2300 } } } },
    { payload: { responseTargets: { reminderLeadBusinessHours: 41 } } },
    { payload: { salesRulez: {} } },
    { payload: { salesRules: { monthlyValu: {} } } },
    { payload: { salesRules: { monthlyValue: { minUSD: 1 } } } },
    { payload: { salesRules: { couldGrow: { enable: false } } } },
    { payload: { owners: [{ name: "Ada", slackId: "U1" }] } },
    { payload: { owners: [{ name: "Ada", match: { gpuClas: "other" } }] } },
    { payload: { businessHours: { timezone: "Europe/Berlin" } } },
    { payload: { responseTargets: { sales: { firstReplyBusinessHours: 4, firstOfferBusinessHours: 16, firstOffer: 1 } } } },
    { payload: { responseTargets: { reminderLead: 1 } } }
  ])("rejects $payload", ({ payload }) => {
    expect(gpuRequestRoutingPolicySchema.safeParse(payload).success).toBe(false);
  });

  it.each([
    { owner: "an owner rule", payload: { owners: [{ name: "R".repeat(65), match: {} }] } },
    { owner: "the fallback owner", payload: { fallbackOwner: { name: "S".repeat(65) } } }
  ])("rejects $owner named longer than the request's owner column holds", ({ payload }) => {
    expect(gpuRequestRoutingPolicySchema.safeParse(payload).success).toBe(false);
  });

  it("takes owner names as long as the request's owner column holds", () => {
    const payload = { owners: [{ name: "R".repeat(64), match: {} }], fallbackOwner: { name: "S".repeat(64) } };

    expect(gpuRequestRoutingPolicySchema.parse(payload)).toMatchObject(payload);
  });

  it("takes business hours, targets and a sales lead the team sets", () => {
    const payload = {
      salesLead: { name: "Lead", slackUserId: "U123", email: "lead@akash.network" },
      businessHours: { timeZone: "Europe/Berlin", days: [1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 },
      responseTargets: {
        sales: { firstReplyBusinessHours: 2, firstOfferBusinessHours: 8 },
        automated: { firstReplyBusinessHours: 0.5, firstOfferBusinessHours: 1 },
        reminderLeadBusinessHours: 0.25
      }
    };

    expect(gpuRequestRoutingPolicySchema.parse(payload)).toMatchObject(payload);
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
