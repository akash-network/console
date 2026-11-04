import { describe, expect, it } from "vitest";

import { describeAccount, describeLane, type HardwareRequestAlertContext, salesOwnerOf } from "./hardware-request-alert-summary";

import { createHardwareRequest } from "@test/seeders/hardware-request.seeder";

const CONTEXT: HardwareRequestAlertContext = { organizationName: "Acme", accountType: "paying", owner: { name: "Remington" } };

describe("hardware request alert summary", () => {
  describe(describeLane.name, () => {
    it.each([
      { laneReason: "monthly_value", text: "monthly value" },
      { laneReason: "multi_node", text: "multi-node" },
      { laneReason: "interconnect", text: "interconnect" },
      { laneReason: "long_term_data_center", text: "long term on data-center GPUs" },
      { laneReason: "could_grow", text: "could grow" },
      { laneReason: "wants_to_talk", text: "wants to talk" }
    ] as const)("names the $laneReason rule of a sales-lane request", ({ laneReason, text }) => {
      expect(describeLane(createHardwareRequest({ lane: "sales", laneReason, estimatedMonthlyUsd: 1_234_567 }))).toBe(
        `Sales lane (${text}) · est. $1,234,567/month`
      );
    });

    it.each([
      { laneReason: "no_payment_method", text: "no card on file" },
      { laneReason: "below_thresholds", text: "below sales thresholds" },
      { laneReason: "manual", text: "moved by hand" }
    ] as const)("names the $laneReason reason of an automated-lane request", ({ laneReason, text }) => {
      expect(describeLane(createHardwareRequest({ lane: "automated", laneReason, estimatedMonthlyUsd: 0 }))).toBe(`Automated lane (${text}) · est. $0/month`);
    });

    it("describes a request routed before lanes existed", () => {
      expect(describeLane(createHardwareRequest({ lane: null, laneReason: null, estimatedMonthlyUsd: null }))).toBe("Automated lane · value unknown");
    });
  });

  describe(describeAccount.name, () => {
    it.each([
      { source: "reserve_capacity", text: "Reserve capacity" },
      { source: "configure_reserve", text: "Configure › Reserve capacity" },
      { source: "no_fit", text: "No fitting provider" },
      { source: "no_bids", text: "No bids" },
      { source: "gpu_menu", text: "GPU menu" },
      { source: "requests_page", text: "Requests page" },
      { source: null, text: "the request form" }
    ] as const)("names the $source entry point", ({ source, text }) => {
      expect(describeAccount(createHardwareRequest({ source }), CONTEXT)).toBe(`Acme · Paying · via ${text}`);
    });

    it.each([
      { accountType: "trial", text: "Trial" },
      { accountType: "no_card", text: "No card on file" },
      { accountType: "no_account", text: "No account yet" }
    ] as const)("names the $accountType account type and leaves out a missing organization", ({ accountType, text }) => {
      expect(describeAccount(createHardwareRequest({ source: "gpu_menu" }), { ...CONTEXT, organizationName: undefined, accountType })).toBe(
        `${text} · via GPU menu`
      );
    });
  });

  describe(salesOwnerOf.name, () => {
    it("gives the owner of a sales-lane request", () => {
      expect(salesOwnerOf(createHardwareRequest({ lane: "sales" }), CONTEXT)).toEqual({ name: "Remington" });
    });

    it.each(["automated", null] as const)("gives no owner to a %s lane request", lane => {
      expect(salesOwnerOf(createHardwareRequest({ lane }), CONTEXT)).toBeUndefined();
    });
  });
});
