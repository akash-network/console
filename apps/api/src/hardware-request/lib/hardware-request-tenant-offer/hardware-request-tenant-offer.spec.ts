import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HardwareRequestOfferTerms } from "@src/hardware-request/model-schemas";
import type { HardwareRequestOfferOutput } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { isVisibleToTenant, type TenantVisibleOffer, toTenantOffer } from "./hardware-request-tenant-offer";

const NOW = new Date("2026-11-04T12:00:00.000Z");

const TERMS: HardwareRequestOfferTerms = {
  gpu: { model: "H200", count: 16, interconnect: "cluster" },
  location: "Frankfurt, DE",
  availableFrom: "2026-12-01",
  term: "6_months",
  sla: "99.9",
  storage: { tbPerNode: 8, nvme: true },
  uplinkGbps: 10
};

describe("hardware request tenant offer", () => {
  describe(toTenantOffer.name, () => {
    it("shows the offer with its monthly estimate and without the provider's address", () => {
      const offer = anOffer({ status: "published", usdPerGpuHour: 2.35, expiresAt: "2026-11-05T00:00:00.000Z" });

      expect(toTenantOffer(offer, NOW)).toEqual({
        id: offer.id,
        status: "published",
        expired: false,
        providerAudited: true,
        providerUptime7d: 0.99,
        usdPerGpuHour: 2.35,
        estimatedMonthlyUsd: 27_448,
        terms: TERMS,
        expiresAt: "2026-11-05T00:00:00.000Z",
        publishedAt: "2026-11-01T00:00:00.000Z"
      });
    });

    it.each([
      { case: "past its expiry", expiresAt: "2026-11-04T11:59:59.000Z" },
      { case: "expiring this very moment", expiresAt: "2026-11-04T12:00:00.000Z" }
    ])("marks a published offer $case as expired", ({ expiresAt }) => {
      expect(toTenantOffer(anOffer({ status: "published", expiresAt }), NOW).expired).toBe(true);
    });

    it.each(["accepted", "declined", "closed"] as const)("never marks a %s offer as expired", status => {
      expect(toTenantOffer(anOffer({ status, expiresAt: "2026-11-01T00:00:00.000Z" }), NOW).expired).toBe(false);
    });
  });

  describe(isVisibleToTenant.name, () => {
    it.each([
      { status: "published", visible: true },
      { status: "accepted", visible: true },
      { status: "declined", visible: true },
      { status: "closed", visible: true },
      { status: "draft", visible: false },
      { status: "withdrawn", visible: false }
    ] as const)("shows a $status offer: $visible", ({ status, visible }) => {
      expect(isVisibleToTenant(mock<HardwareRequestOfferOutput>({ status }))).toBe(visible);
    });
  });

  function anOffer(overrides: Pick<TenantVisibleOffer, "status" | "expiresAt"> & Partial<TenantVisibleOffer>): TenantVisibleOffer {
    return {
      id: "offer-1",
      hardwareRequestId: "request-1",
      providerAddress: "akash1provider",
      providerAudited: true,
      providerUptime7d: 0.99,
      usdPerGpuHour: 2.4,
      terms: TERMS,
      publishedAt: "2026-11-01T00:00:00.000Z",
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
      ...overrides
    };
  }
});
