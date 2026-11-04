import type { SalesOwner } from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { HardwareRequestLaneReason, HardwareRequestSource } from "@src/hardware-request/model-schemas";
import type { HardwareRequestOutput } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import type { HardwareRequestAccountType } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";

export type HardwareRequestAlertContext = {
  organizationName: string | undefined;
  accountType: HardwareRequestAccountType;
  owner: SalesOwner | undefined;
};

const LANE_REASON_NAMES: Record<HardwareRequestLaneReason, string> = {
  monthly_value: "monthly value",
  multi_node: "multi-node",
  interconnect: "interconnect",
  long_term_data_center: "long term on data-center GPUs",
  could_grow: "could grow",
  wants_to_talk: "wants to talk",
  no_payment_method: "no card on file",
  below_thresholds: "below sales thresholds",
  manual: "moved by hand"
};

const ACCOUNT_TYPE_NAMES: Record<HardwareRequestAccountType, string> = {
  paying: "Paying",
  trial: "Trial",
  no_card: "No card on file"
};

const SOURCE_NAMES: Record<HardwareRequestSource, string> = {
  reserve_capacity: "Reserve capacity",
  configure_reserve: "Configure › Reserve capacity",
  no_fit: "No fitting provider",
  no_bids: "No bids",
  gpu_menu: "GPU menu",
  requests_page: "Requests page"
};

export function describeLane({ lane, laneReason, estimatedMonthlyUsd }: HardwareRequestOutput): string {
  const laneName = lane === "sales" ? "Sales lane" : "Automated lane";
  const value = estimatedMonthlyUsd === null ? "value unknown" : `est. $${estimatedMonthlyUsd.toLocaleString("en-US")}/month`;

  return `${laneName}${laneReason ? ` (${LANE_REASON_NAMES[laneReason]})` : ""} · ${value}`;
}

export function describeAccount({ source }: HardwareRequestOutput, { organizationName, accountType }: HardwareRequestAlertContext): string {
  return [organizationName, ACCOUNT_TYPE_NAMES[accountType], `via ${source ? SOURCE_NAMES[source] : "the request form"}`].filter(Boolean).join(" · ");
}

/** Automated-lane requests name no owner, so nobody is pinged for them. */
export function salesOwnerOf({ lane }: HardwareRequestOutput, { owner }: HardwareRequestAlertContext): SalesOwner | undefined {
  return lane === "sales" ? owner : undefined;
}
