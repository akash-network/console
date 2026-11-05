import { faker } from "@faker-js/faker";

import type { GpuRequestOffer } from "@src/components/gpu-requests/gpuOfferComparison/gpuOfferComparison";
import type { HardwareRequest } from "@src/components/gpu-requests/gpuRequestStatus/gpuRequestStatus";

type HardwareRequestSpec = NonNullable<HardwareRequest["spec"]>;

export function buildHardwareRequestSpec(overrides: Partial<HardwareRequestSpec> = {}): HardwareRequestSpec {
  return {
    gpu: { model: "H100", count: 1, interconnect: "none" },
    region: { mode: "any", areas: [] },
    uplinkGbps: null,
    storage: { tbPerNode: 1, nvme: true },
    sla: null,
    targetPrice: null,
    term: "month_to_month",
    start: { kind: "asap" },
    couldGrow: false,
    wantsToTalk: false,
    ...overrides
  };
}

export function buildHardwareRequest(overrides: Partial<HardwareRequest> = {}): HardwareRequest {
  const createdAt = faker.date.recent().toISOString();

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    organizationId: faker.string.uuid(),
    category: "quote",
    status: "submitted",
    source: "requests_page",
    gpuModel: null,
    quantity: null,
    region: null,
    details: null,
    contactEmail: faker.internet.email(),
    spec: buildHardwareRequestSpec(),
    createdAt,
    updatedAt: createdAt,
    ...overrides
  };
}

type OfferTerms = GpuRequestOffer["terms"];

export function buildGpuRequestOfferTerms(overrides: Partial<OfferTerms> = {}): OfferTerms {
  return {
    gpu: { model: "H100", count: 1, interconnect: "none" },
    location: "Frankfurt, DE",
    availableFrom: "2026-11-01",
    term: "month_to_month",
    sla: null,
    storage: { tbPerNode: 1, nvme: true },
    uplinkGbps: null,
    ...overrides
  };
}

export function buildGpuRequestOffer(overrides: Partial<GpuRequestOffer> = {}): GpuRequestOffer {
  return {
    id: faker.string.uuid(),
    status: "published",
    expired: false,
    providerAudited: true,
    providerUptime7d: 0.998,
    usdPerGpuHour: 2,
    estimatedMonthlyUsd: 1460,
    terms: buildGpuRequestOfferTerms(),
    expiresAt: "2026-11-11T12:00:00.000Z",
    publishedAt: "2026-11-04T12:00:00.000Z",
    ...overrides
  };
}
