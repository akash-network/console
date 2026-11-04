import { describe, expect, it } from "vitest";

import type { GpuRequestOffer } from "./gpuOfferComparison";
import { describeOfferAttributes, describeOfferState, labelOffers, listShownOffers, sortOffers } from "./gpuOfferComparison";

import { buildGpuRequestOffer, buildGpuRequestOfferTerms, buildHardwareRequestSpec } from "@tests/seeders/hardwareRequest";

const TODAY = "2026-11-04";

describe("gpuOfferComparison", () => {
  describe(describeOfferAttributes.name, () => {
    it("shows the request next to an offer that matches it", () => {
      const spec = buildHardwareRequestSpec({
        gpu: { model: "H100", count: 8, interconnect: "server" },
        region: { mode: "only", areas: ["eu"] },
        uplinkGbps: 10,
        storage: { tbPerNode: 4, nvme: true },
        sla: "99.5",
        targetPrice: { maxUsdPerGpuHour: 2.5 },
        term: "6_months",
        start: { kind: "date", date: "2026-11-20" }
      });
      const offer = buildGpuRequestOffer({
        usdPerGpuHour: 2.4,
        estimatedMonthlyUsd: 14016,
        providerAudited: true,
        providerUptime7d: 0.998,
        terms: buildGpuRequestOfferTerms({
          gpu: { model: "h100", count: 8, interconnect: "cluster" },
          location: "Frankfurt, DE",
          availableFrom: "2026-11-20",
          term: "6_months",
          sla: "99.9",
          storage: { tbPerNode: 8, nvme: true },
          uplinkGbps: 25
        })
      });

      expect(compare(spec, offer)).toEqual([
        { label: "Price per GPU-hour", request: "Up to $2.50 per GPU-hour", offer: { main: "$2.40", sub: "≈ $14,016 a month", mismatch: undefined } },
        { label: "GPUs", request: "8× H100", offer: { main: "8× h100", mismatch: undefined } },
        { label: "Location", request: "Europe", offer: { main: "Frankfurt, DE" } },
        { label: "Available", request: "From Nov 20", offer: { main: "Nov 20", mismatch: undefined } },
        { label: "Term", request: "6 months", offer: { main: "6 months", mismatch: undefined } },
        { label: "Uptime SLA", request: "99.5%", offer: { main: "99.9%", mismatch: undefined } },
        { label: "Interconnect", request: "Inside each server", offer: { main: "Across servers", mismatch: undefined } },
        { label: "Storage per server", request: "4 TB NVMe", offer: { main: "8 TB NVMe", mismatch: undefined } },
        { label: "Internet", request: "10 Gbps", offer: { main: "25 Gbps", mismatch: undefined } },
        { label: "Provider", request: "Any", offer: { main: "Audited", sub: "99.8% uptime, last 7 days" } }
      ]);
    });

    it("flags each value that falls short of the request", () => {
      const spec = buildHardwareRequestSpec({
        gpu: { model: "H100", count: 8, interconnect: "cluster" },
        uplinkGbps: 10,
        storage: { tbPerNode: 4, nvme: true },
        sla: "99.9",
        targetPrice: { minUsdPerGpuHour: 1, maxUsdPerGpuHour: 2 },
        term: "12_months",
        start: { kind: "date", date: "2026-11-20" }
      });
      const offer = buildGpuRequestOffer({
        usdPerGpuHour: 2.25,
        providerAudited: false,
        providerUptime7d: null,
        terms: buildGpuRequestOfferTerms({
          gpu: { model: "H200", count: 8, interconnect: "server" },
          availableFrom: "2026-11-21",
          term: "month_to_month",
          sla: "99.5",
          storage: { tbPerNode: 2, nvme: true },
          uplinkGbps: 1
        })
      });

      expect(compare(spec, offer).map(attribute => [attribute.label, attribute.offer.mismatch])).toEqual([
        ["Price per GPU-hour", "$0.25 over your range"],
        ["GPUs", "You asked for 8× H100"],
        ["Location", undefined],
        ["Available", "After your start date"],
        ["Term", "You asked for 1 year"],
        ["Uptime SLA", "Below your 99.9%"],
        ["Interconnect", "You asked for across servers"],
        ["Storage per server", "Less than your 4 TB"],
        ["Internet", "Slower than your 10 Gbps"],
        ["Provider", undefined]
      ]);
      expect(valueOf(spec, offer, "Provider")).toEqual({ main: "Not audited", sub: undefined });
    });

    it("flags fewer GPUs than asked, best-effort uptime, no stated internet and storage without NVMe", () => {
      const spec = buildHardwareRequestSpec({
        gpu: { model: "H100", count: 8, interconnect: "none" },
        sla: "99",
        uplinkGbps: 1,
        storage: { tbPerNode: 2, nvme: true }
      });
      const offer = buildGpuRequestOffer({
        terms: buildGpuRequestOfferTerms({
          gpu: { model: "H100", count: 4, interconnect: "none" },
          sla: null,
          uplinkGbps: null,
          storage: { tbPerNode: 2, nvme: false }
        })
      });

      expect(valueOf(spec, offer, "GPUs").mismatch).toBe("You asked for 8× H100");
      expect(valueOf(spec, offer, "Uptime SLA")).toEqual({ main: "Best effort", mismatch: "Below your 99%" });
      expect(valueOf(spec, offer, "Internet")).toEqual({ main: "Not stated", mismatch: "Slower than your 1 Gbps" });
      expect(valueOf(spec, offer, "Storage per server")).toEqual({ main: "2 TB", mismatch: "Not NVMe" });
    });

    it("accepts more GPUs than asked and any value the request left open", () => {
      const spec = buildHardwareRequestSpec({
        gpu: { model: "H100", count: 2, interconnect: "none" },
        sla: null,
        uplinkGbps: null,
        storage: { tbPerNode: 0, nvme: false },
        targetPrice: { minUsdPerGpuHour: 1 },
        start: { kind: "asap" }
      });
      const offer = buildGpuRequestOffer({
        usdPerGpuHour: 9,
        terms: buildGpuRequestOfferTerms({ gpu: { model: "H100", count: 4, interconnect: "none" }, availableFrom: "2026-12-01", sla: null, uplinkGbps: null })
      });

      expect(compare(spec, offer).filter(attribute => attribute.offer.mismatch)).toEqual([]);
      expect(requestOf(spec, "Uptime SLA")).toBe("No requirement");
      expect(requestOf(spec, "Internet")).toBe("No preference");
      expect(requestOf(spec, "Storage per server")).toBe("None");
      expect(requestOf(spec, "Available")).toBe("As soon as possible");
      expect(valueOf(spec, offer, "Available").main).toBe("Dec 1");
    });

    it("shows hardware that is ready by today as available now", () => {
      const offer = buildGpuRequestOffer({ terms: buildGpuRequestOfferTerms({ availableFrom: TODAY }) });

      expect(valueOf(buildHardwareRequestSpec({ start: { kind: "flexible" } }), offer, "Available").main).toBe("Now");
      expect(requestOf(buildHardwareRequestSpec({ start: { kind: "flexible" } }), "Available")).toBe("Flexible");
    });

    it("compares nothing for a request from the old form", () => {
      const offer = buildGpuRequestOffer({ usdPerGpuHour: 50, terms: buildGpuRequestOfferTerms({ term: "24_months", sla: null }) });

      expect(compare(null, offer).map(attribute => attribute.request)).toEqual(["—", "—", "—", "—", "—", "—", "—", "—", "—", "Any"]);
      expect(compare(null, offer).filter(attribute => attribute.offer.mismatch)).toEqual([]);
    });
  });

  describe(labelOffers.name, () => {
    it("numbers offers in the order they were published", () => {
      const [first, second] = [buildGpuRequestOffer(), buildGpuRequestOffer()];

      expect(labelOffers([first, second])).toEqual(
        new Map([
          [first.id, "Offer 1"],
          [second.id, "Offer 2"]
        ])
      );
    });
  });

  describe(listShownOffers.name, () => {
    it("shows open, expired and declined offers but not closed ones", () => {
      const open = buildGpuRequestOffer();
      const declined = buildGpuRequestOffer({ status: "declined" });
      const expired = buildGpuRequestOffer({ expired: true });

      expect(listShownOffers([open, declined, buildGpuRequestOffer({ status: "closed" }), expired])).toEqual([open, declined, expired]);
    });

    it("shows only the accepted offer once one is accepted", () => {
      const accepted = buildGpuRequestOffer({ status: "accepted" });

      expect(listShownOffers([buildGpuRequestOffer({ status: "closed" }), accepted, buildGpuRequestOffer({ status: "declined" })])).toEqual([accepted]);
    });
  });

  describe(sortOffers.name, () => {
    const cheapLate = buildGpuRequestOffer({
      usdPerGpuHour: 1,
      expiresAt: "2026-11-20T00:00:00.000Z",
      terms: buildGpuRequestOfferTerms({ availableFrom: "2026-12-01" })
    });
    const priceySoon = buildGpuRequestOffer({
      usdPerGpuHour: 3,
      expiresAt: "2026-11-06T00:00:00.000Z",
      terms: buildGpuRequestOfferTerms({ availableFrom: "2026-11-05" })
    });
    const middle = buildGpuRequestOffer({
      usdPerGpuHour: 2,
      expiresAt: "2026-11-10T00:00:00.000Z",
      terms: buildGpuRequestOfferTerms({ availableFrom: "2026-11-05" })
    });

    it.each([
      ["price", [cheapLate, middle, priceySoon]],
      ["available", [middle, priceySoon, cheapLate]],
      ["expires", [priceySoon, middle, cheapLate]]
    ] as const)("sorts by %s, breaking ties on price, without changing the list", (sort, expected) => {
      const offers = [priceySoon, cheapLate, middle];

      expect(sortOffers(offers, sort)).toEqual(expected);
      expect(offers).toEqual([priceySoon, cheapLate, middle]);
    });
  });

  describe(describeOfferState.name, () => {
    const NOW = new Date("2026-11-04T12:00:00.000Z");

    it.each([
      [{ status: "accepted" }, "Accepted"],
      [{ status: "declined" }, "Declined"],
      [{ status: "closed" }, "Closed"],
      [{ expired: true }, "Expired"],
      [{ expiresAt: "2026-11-05T11:59:00.000Z" }, "Expires today"],
      [{ expiresAt: "2026-11-05T12:00:00.000Z" }, "Expires in 1 day"],
      [{ expiresAt: "2026-11-07T13:00:00.000Z" }, "Expires in 3 days"]
    ] as const)("describes %o as %s", (overrides, expected) => {
      expect(describeOfferState(buildGpuRequestOffer(overrides as Partial<GpuRequestOffer>), NOW)).toBe(expected);
    });
  });

  function compare(spec: ReturnType<typeof buildHardwareRequestSpec> | null, offer: GpuRequestOffer) {
    return describeOfferAttributes(spec, TODAY).map(attribute => ({ label: attribute.label, request: attribute.request.main, offer: attribute.offer(offer) }));
  }

  function valueOf(spec: ReturnType<typeof buildHardwareRequestSpec>, offer: GpuRequestOffer, label: string) {
    return compare(spec, offer).find(attribute => attribute.label === label)!.offer;
  }

  function requestOf(spec: ReturnType<typeof buildHardwareRequestSpec>, label: string) {
    return describeOfferAttributes(spec, TODAY).find(attribute => attribute.label === label)!.request.main;
  }
});
