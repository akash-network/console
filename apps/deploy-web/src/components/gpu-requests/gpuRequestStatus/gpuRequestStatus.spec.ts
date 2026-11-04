import { describe, expect, it } from "vitest";

import type { HardwareRequestStatus } from "./gpuRequestStatus";
import { describeEndState, describeRequestSummary, describeRequestTitle, describeStatusMessage, describeTracker, hasOffers } from "./gpuRequestStatus";

import { buildHardwareRequest, buildHardwareRequestSpec } from "@tests/seeders/hardwareRequest";

describe("gpuRequestStatus", () => {
  describe(hasOffers.name, () => {
    it.each(["offers", "accepted", "fulfilled"] as const)("shows offers on a %s request", status => {
      expect(hasOffers(status)).toBe(true);
    });

    it.each(["submitted", "in_review", "sourcing", "withdrawn", "closed"] as const)("shows no offers on a %s request", status => {
      expect(hasOffers(status)).toBe(false);
    });
  });

  describe(describeTracker.name, () => {
    it("marks the stages before the current one done and the rest upcoming", () => {
      expect(describeTracker("sourcing")).toEqual([
        { status: "submitted", label: "Submitted", state: "done" },
        { status: "in_review", label: "In review", state: "done" },
        { status: "sourcing", label: "Sourcing", state: "current" },
        { status: "offers", label: "Offers", state: "upcoming" },
        { status: "accepted", label: "Accepted", state: "upcoming" }
      ]);
    });

    it("starts on submitted", () => {
      expect(describeTracker("submitted")?.map(stage => stage.state)).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    });

    it("completes the track once accepted or fulfilled", () => {
      expect(describeTracker("accepted")?.map(stage => stage.state)).toEqual(["done", "done", "done", "done", "done"]);
      expect(describeTracker("fulfilled")?.map(stage => stage.state)).toEqual(["done", "done", "done", "done", "done"]);
    });

    it("shows no tracker for a request that left the track", () => {
      expect(describeTracker("withdrawn")).toBeNull();
      expect(describeTracker("closed")).toBeNull();
    });
  });

  describe(describeEndState.name, () => {
    it("names the end states only", () => {
      expect(describeEndState("withdrawn")).toBe("Withdrawn");
      expect(describeEndState("closed")).toBe("Closed");
      expect(describeEndState("offers")).toBeNull();
    });
  });

  describe(describeStatusMessage.name, () => {
    it.each<[HardwareRequestStatus, string]>([
      ["submitted", "Got it. We'll start reviewing your request shortly."],
      ["in_review", "We're reviewing your request. If anything's unclear, we'll reach out by email."],
      ["sourcing", "We're talking to providers who can supply this hardware."],
      ["offers", "We have offers for you. Compare them below and pick the one that fits."],
      ["accepted", "You accepted an offer. Our team is setting up the deployment with the provider and will email you."],
      ["fulfilled", "Your GPUs are ready."],
      ["withdrawn", "You withdrew this request."],
      ["closed", "This request is closed."]
    ])("tells a %s request what happens next", (status, message) => {
      expect(describeStatusMessage(buildHardwareRequest({ status }))).toBe(message);
    });

    it("mentions a call when the request left a phone number", () => {
      const request = buildHardwareRequest({ status: "in_review", spec: buildHardwareRequestSpec({ phone: "+1 555" }) });

      expect(describeStatusMessage(request)).toBe("We're reviewing your request. If anything's unclear, we'll reach out by email or phone.");
    });

    it("mentions email for a request from the old form", () => {
      expect(describeStatusMessage(buildHardwareRequest({ status: "in_review", spec: null }))).toContain("by email.");
    });
  });

  describe(describeRequestTitle.name, () => {
    it("names the GPUs of a quote request, with servers from 8 GPUs on", () => {
      expect(describeRequestTitle(buildHardwareRequest({ spec: buildHardwareRequestSpec({ gpu: { model: "A100", count: 4, interconnect: "none" } }) }))).toBe(
        "4× A100"
      );
      expect(describeRequestTitle(buildHardwareRequest({ spec: buildHardwareRequestSpec({ gpu: { model: "H200", count: 8, interconnect: "server" } }) }))).toBe(
        "8× H200 · 1 server"
      );
      expect(
        describeRequestTitle(buildHardwareRequest({ spec: buildHardwareRequestSpec({ gpu: { model: "B200", count: 32, interconnect: "cluster" } }) }))
      ).toBe("32× B200 · 4 servers");
    });

    it("names a request from the old form by its GPU, region or category", () => {
      expect(describeRequestTitle(buildHardwareRequest({ spec: null, gpuModel: "RTX 5090", quantity: 2 }))).toBe("2× RTX 5090");
      expect(describeRequestTitle(buildHardwareRequest({ spec: null, gpuModel: "RTX 5090", quantity: null }))).toBe("1× RTX 5090");
      expect(describeRequestTitle(buildHardwareRequest({ spec: null, region: "Tokyo" }))).toBe("Region: Tokyo");
      expect(describeRequestTitle(buildHardwareRequest({ spec: null }))).toBe("Hardware request");
    });
  });

  describe(describeRequestSummary.name, () => {
    it("sums up a quote request's answers beyond the GPUs", () => {
      const spec = buildHardwareRequestSpec({
        region: { mode: "only", areas: ["eu", "us"] },
        storage: { tbPerNode: 8, nvme: true },
        sla: "99.5",
        term: "12_months",
        targetPrice: { minUsdPerGpuHour: 2, maxUsdPerGpuHour: 2.5 }
      });

      expect(describeRequestSummary(buildHardwareRequest({ spec }))).toBe(
        "United States, Europe · 8 TB NVMe · 99.5% uptime · 1 year · $2.00–$2.50 per GPU-hour"
      );
    });

    it("leaves out what was not asked for", () => {
      const spec = buildHardwareRequestSpec({ storage: { tbPerNode: 0, nvme: false }, sla: null, targetPrice: null });

      expect(describeRequestSummary(buildHardwareRequest({ spec }))).toBe("Anywhere · Month to month · Open to offers");
    });

    it("describes every region mode and price bound", () => {
      const summary = (overrides: Parameters<typeof buildHardwareRequestSpec>[0]) =>
        describeRequestSummary(buildHardwareRequest({ spec: buildHardwareRequestSpec({ storage: { tbPerNode: 2, nvme: false }, ...overrides }) }));

      expect(summary({ region: { mode: "except", areas: ["apac"] } })).toBe("Anywhere except Asia Pacific · 2 TB · Month to month · Open to offers");
      expect(summary({ targetPrice: { maxUsdPerGpuHour: 3 } })).toContain("Up to $3.00 per GPU-hour");
      expect(summary({ targetPrice: { minUsdPerGpuHour: 1.5 } })).toContain("From $1.50 per GPU-hour");
    });

    it("shows the details of a request from the old form", () => {
      expect(describeRequestSummary(buildHardwareRequest({ spec: null, details: "Need it in Tokyo" }))).toBe("Need it in Tokyo");
      expect(describeRequestSummary(buildHardwareRequest({ spec: null, details: null }))).toBe("");
    });
  });
});
