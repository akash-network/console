import { type GpuRequestRoutingPolicy, isDataCenterGpu, isSameGpuModel } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestLane, HardwareRequestLaneReason, HardwareRequestSpec, SalesLaneReason } from "@src/hardware-request/model-schemas";

const HOURS_PER_MONTH = 730;

const TERM_MONTHS: Record<HardwareRequestSpec["term"], number> = {
  month_to_month: 1,
  "3_months": 3,
  "6_months": 6,
  "12_months": 12,
  "24_months": 24
};

export type LaneRoutedRequest = { spec: HardwareRequestSpec | null; gpuModel: string | null; quantity: number | null };

export type LaneRouting = { lane: HardwareRequestLane; laneReason: HardwareRequestLaneReason; estimatedMonthlyUsd: number | null };

function referencePriceOf(model: string, policy: GpuRequestRoutingPolicy): number | undefined {
  return Object.entries(policy.referenceUsdPerGpuHour).find(([referenceModel]) => isSameGpuModel(referenceModel, model))?.[1];
}

export function estimateMonthlyUsd({ spec, gpuModel, quantity }: LaneRoutedRequest, policy: GpuRequestRoutingPolicy): number | null {
  const model = spec?.gpu.model ?? gpuModel;
  const count = spec?.gpu.count ?? quantity;

  if (!model || !count) return null;

  const usdPerGpuHour = spec?.targetPrice?.maxUsdPerGpuHour ?? spec?.targetPrice?.minUsdPerGpuHour ?? referencePriceOf(model, policy);

  return usdPerGpuHour === undefined ? null : Math.round(count * usdPerGpuHour * HOURS_PER_MONTH);
}

function firstSalesRule(spec: HardwareRequestSpec | null, estimatedMonthlyUsd: number | null, policy: GpuRequestRoutingPolicy): SalesLaneReason | undefined {
  const { monthlyValue, multiNode, interconnect, longTermDataCenter, couldGrow, wantsToTalk } = policy.salesRules;
  const rules: [SalesLaneReason, boolean][] = [
    ["monthly_value", monthlyValue.enabled && estimatedMonthlyUsd !== null && estimatedMonthlyUsd >= monthlyValue.minUsd],
    ["multi_node", multiNode.enabled && spec?.gpu.interconnect === "cluster" && spec.gpu.count >= multiNode.minGpus],
    ["interconnect", interconnect.enabled && !!spec && spec.gpu.interconnect !== "none"],
    [
      "long_term_data_center",
      longTermDataCenter.enabled && !!spec && TERM_MONTHS[spec.term] >= longTermDataCenter.minTermMonths && isDataCenterGpu(spec.gpu.model, policy)
    ],
    ["could_grow", couldGrow.enabled && !!spec?.couldGrow],
    ["wants_to_talk", wantsToTalk.enabled && !!spec?.wantsToTalk]
  ];

  return rules.find(([, fired]) => fired)?.[0];
}

/** A request without a spec predates the structured form, so only its GPU model and quantity can put it in the sales lane. */
export function routeHardwareRequest(request: LaneRoutedRequest, account: { hasPaymentMethod: boolean }, policy: GpuRequestRoutingPolicy): LaneRouting {
  const estimatedMonthlyUsd = estimateMonthlyUsd(request, policy);
  const salesRule = firstSalesRule(request.spec, estimatedMonthlyUsd, policy);

  if (!salesRule) return { lane: "automated", laneReason: "below_thresholds", estimatedMonthlyUsd };

  if (policy.salesRequiresPaymentMethod && !account.hasPaymentMethod) return { lane: "automated", laneReason: "no_payment_method", estimatedMonthlyUsd };

  return { lane: "sales", laneReason: salesRule, estimatedMonthlyUsd };
}
