import { describe, expect, it } from "vitest";

import {
  DEFAULT_GPU_REQUEST_ROUTING_POLICY,
  type GpuRequestRoutingPolicy,
  gpuRequestRoutingPolicySchema
} from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestSpec } from "@src/hardware-request/model-schemas";
import { estimateMonthlyUsd, routeHardwareRequest } from "./hardware-request-lane";

import { createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";

const PAYING = { hasPaymentMethod: true };

describe("hardware request lane", () => {
  describe(estimateMonthlyUsd.name, () => {
    it.each([
      { targetPrice: { minUsdPerGpuHour: 2, maxUsdPerGpuHour: 3 }, estimate: 2 * 3 * 730 },
      { targetPrice: { minUsdPerGpuHour: 2 }, estimate: 2 * 2 * 730 },
      { targetPrice: {}, estimate: Math.round(2 * 1.3 * 730) },
      { targetPrice: null, estimate: Math.round(2 * 1.3 * 730) }
    ])("prices 2 GPUs at the target maximum, else the minimum, else the reference price ($targetPrice)", ({ targetPrice, estimate }) => {
      const spec = createHardwareRequestSpec({ gpu: { model: "A100", count: 2, interconnect: "none" }, targetPrice });

      expect(estimateMonthlyUsd({ spec, gpuModel: null, quantity: null }, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toBe(estimate);
    });

    it("matches the reference price on the GPU model in any case and spacing", () => {
      expect(estimateMonthlyUsd({ spec: null, gpuModel: " rtx 5090 ", quantity: 1 }, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toBe(Math.round(0.7 * 730));
    });

    it("prices a legacy request from its GPU model and quantity", () => {
      expect(estimateMonthlyUsd({ spec: null, gpuModel: "H100", quantity: 4 }, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toBe(4 * 2.5 * 730);
    });

    it.each([
      { case: "an unpriced model", request: { spec: null, gpuModel: "Any GPU", quantity: 4 } },
      { case: "no model", request: { spec: null, gpuModel: null, quantity: 4 } },
      { case: "no quantity", request: { spec: null, gpuModel: "H100", quantity: null } }
    ])("leaves the value unknown for $case", ({ request }) => {
      expect(estimateMonthlyUsd(request, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toBeNull();
    });
  });

  describe(routeHardwareRequest.name, () => {
    it("keeps the example small request from the issue in the automated lane", () => {
      const spec = smallSpec({ gpu: { model: "A100", count: 1, interconnect: "none" }, term: "3_months" });

      expect(route(spec)).toEqual({ lane: "automated", laneReason: "below_thresholds", estimatedMonthlyUsd: 949 });
    });

    it("sends the example large request from the issue to sales on its monthly value", () => {
      const spec = createHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "cluster" }, targetPrice: null, term: "12_months" });

      expect(route(spec)).toEqual({ lane: "sales", laneReason: "monthly_value", estimatedMonthlyUsd: 16 * 3.5 * 730 });
    });

    it.each([
      {
        case: "reaches the monthly value",
        spec: smallSpec({ gpu: { model: "RTX 4090", count: 7, interconnect: "none" }, targetPrice: { maxUsdPerGpuHour: 0.98 } }),
        reason: "monthly_value"
      },
      { case: "asks for a cluster of 8 GPUs", spec: smallSpec({ gpu: { model: "RTX 4090", count: 8, interconnect: "cluster" } }), reason: "multi_node" },
      { case: "asks for a cluster under 8 GPUs", spec: smallSpec({ gpu: { model: "RTX 4090", count: 7, interconnect: "cluster" } }), reason: "interconnect" },
      {
        case: "asks for interconnect inside a server",
        spec: smallSpec({ gpu: { model: "RTX 4090", count: 8, interconnect: "server" } }),
        reason: "interconnect"
      },
      {
        case: "asks for 6 months of a data-center GPU",
        spec: smallSpec({ gpu: { model: "l40s", count: 1, interconnect: "none" }, term: "6_months" }),
        reason: "long_term_data_center"
      },
      { case: "says it could grow", spec: smallSpec({ couldGrow: true }), reason: "could_grow" },
      { case: "asks to talk to someone", spec: smallSpec({ wantsToTalk: true }), reason: "wants_to_talk" }
    ] as const)("sends a request to sales when it $case", ({ spec, reason }) => {
      expect(route(spec)).toMatchObject({ lane: "sales", laneReason: reason });
    });

    it.each([
      {
        case: "just under the monthly value",
        spec: smallSpec({ gpu: { model: "RTX 4090", count: 7, interconnect: "none" }, targetPrice: { maxUsdPerGpuHour: 0.97 } })
      },
      { case: "3 months of a data-center GPU", spec: smallSpec({ gpu: { model: "H100", count: 1, interconnect: "none" }, term: "3_months" }) },
      { case: "a year of a consumer GPU", spec: smallSpec({ gpu: { model: "RTX 4090", count: 1, interconnect: "none" }, term: "12_months" }) }
    ])("keeps $case in the automated lane", ({ spec }) => {
      expect(route(spec)).toMatchObject({ lane: "automated", laneReason: "below_thresholds" });
    });

    it("keeps a sales-sized request of an account without a payment method in the automated lane", () => {
      const spec = smallSpec({ wantsToTalk: true });

      expect(routeHardwareRequest({ spec, gpuModel: null, quantity: null }, { hasPaymentMethod: false }, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toMatchObject({
        lane: "automated",
        laneReason: "no_payment_method"
      });
    });

    it("lets an account without a payment method reach sales when the policy no longer requires one", () => {
      const spec = smallSpec({ wantsToTalk: true });

      expect(
        routeHardwareRequest({ spec, gpuModel: null, quantity: null }, { hasPaymentMethod: false }, policyWith({ salesRequiresPaymentMethod: false }))
      ).toMatchObject({ lane: "sales", laneReason: "wants_to_talk" });
    });

    it.each([
      { rule: "monthlyValue", spec: smallSpec({ gpu: { model: "B200", count: 2, interconnect: "none" } }) },
      { rule: "multiNode", spec: smallSpec({ gpu: { model: "RTX 4090", count: 8, interconnect: "cluster" } }), interconnectOff: true },
      { rule: "interconnect", spec: smallSpec({ gpu: { model: "RTX 4090", count: 2, interconnect: "server" } }) },
      { rule: "longTermDataCenter", spec: smallSpec({ gpu: { model: "A100", count: 1, interconnect: "none" }, term: "12_months" }) },
      { rule: "couldGrow", spec: smallSpec({ couldGrow: true }) },
      { rule: "wantsToTalk", spec: smallSpec({ wantsToTalk: true }) }
    ])("ignores the $rule rule once it is turned off", ({ rule, spec, interconnectOff }) => {
      const policy = policyWith({ salesRules: { [rule]: { enabled: false }, ...(interconnectOff ? { interconnect: { enabled: false } } : {}) } });

      expect(route(spec, policy)).toMatchObject({ lane: "automated" });
    });

    it("applies the thresholds of the policy", () => {
      const policy = policyWith({
        salesRules: { monthlyValue: { minUsd: 100 }, multiNode: { minGpus: 16 }, longTermDataCenter: { minTermMonths: 12, gpuModels: ["RTX 4090"] } }
      });

      expect(route(smallSpec({ gpu: { model: "RTX 4090", count: 1, interconnect: "none" } }), policy)).toMatchObject({ laneReason: "monthly_value" });
      expect(
        route(smallSpec({ gpu: { model: "B200", count: 1, interconnect: "none" }, term: "6_months", targetPrice: { maxUsdPerGpuHour: 0.1 } }), policy)
      ).toMatchObject({
        lane: "automated"
      });
      expect(
        route(smallSpec({ gpu: { model: "RTX 4090", count: 1, interconnect: "none" }, term: "12_months", targetPrice: { maxUsdPerGpuHour: 0.1 } }), policy)
      ).toMatchObject({
        laneReason: "long_term_data_center"
      });
    });

    it("counts a request worth exactly the monthly threshold as sales", () => {
      const policy = policyWith({ salesRules: { monthlyValue: { minUsd: 730 } } });

      expect(route(smallSpec({ targetPrice: { maxUsdPerGpuHour: 1 } }), policy)).toMatchObject({ lane: "sales", laneReason: "monthly_value" });
    });

    it("routes a legacy request on its monthly value alone", () => {
      expect(routeHardwareRequest({ spec: null, gpuModel: "H100", quantity: 8 }, PAYING, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toEqual({
        lane: "sales",
        laneReason: "monthly_value",
        estimatedMonthlyUsd: 8 * 2.5 * 730
      });
      expect(routeHardwareRequest({ spec: null, gpuModel: null, quantity: null }, PAYING, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toEqual({
        lane: "automated",
        laneReason: "below_thresholds",
        estimatedMonthlyUsd: null
      });
    });
  });

  function smallSpec(overrides: Partial<HardwareRequestSpec>) {
    return createHardwareRequestSpec({
      gpu: { model: "RTX 4090", count: 1, interconnect: "none" },
      targetPrice: null,
      term: "month_to_month",
      couldGrow: false,
      wantsToTalk: false,
      ...overrides
    });
  }

  function policyWith(overrides: Record<string, unknown>): GpuRequestRoutingPolicy {
    return gpuRequestRoutingPolicySchema.parse(overrides);
  }

  function route(spec: HardwareRequestSpec, policy = DEFAULT_GPU_REQUEST_ROUTING_POLICY) {
    return routeHardwareRequest({ spec, gpuModel: null, quantity: null }, PAYING, policy);
  }
});
