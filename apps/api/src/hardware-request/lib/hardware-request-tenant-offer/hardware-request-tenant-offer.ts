import { HOURS_PER_MONTH } from "@src/hardware-request/lib/hardware-request-lane/hardware-request-lane";
import type { HardwareRequestOfferStatus, HardwareRequestOfferTerms } from "@src/hardware-request/model-schemas";
import type { HardwareRequestOfferOutput } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";

export const TENANT_VISIBLE_OFFER_STATUSES = ["published", "accepted", "declined", "closed"] as const satisfies HardwareRequestOfferStatus[];

export type TenantHardwareRequestOffer = {
  id: string;
  status: (typeof TENANT_VISIBLE_OFFER_STATUSES)[number];
  expired: boolean;
  providerAudited: boolean;
  providerUptime7d: number | null;
  usdPerGpuHour: number;
  estimatedMonthlyUsd: number;
  terms: HardwareRequestOfferTerms;
  expiresAt: string;
  publishedAt: string | null;
};

export type TenantVisibleOffer = HardwareRequestOfferOutput & { status: TenantHardwareRequestOffer["status"] };

export function isVisibleToTenant(offer: HardwareRequestOfferOutput): offer is TenantVisibleOffer {
  return (TENANT_VISIBLE_OFFER_STATUSES as readonly HardwareRequestOfferStatus[]).includes(offer.status);
}

/** Leaves the provider's address out, since the tenant deals with Akash rather than with the provider. */
export function toTenantOffer(offer: TenantVisibleOffer, now: Date): TenantHardwareRequestOffer {
  const { id, status, providerAudited, providerUptime7d, usdPerGpuHour, terms, expiresAt, publishedAt } = offer;

  return {
    id,
    status,
    expired: status === "published" && new Date(expiresAt) <= now,
    providerAudited,
    providerUptime7d,
    usdPerGpuHour,
    estimatedMonthlyUsd: Math.round(usdPerGpuHour * terms.gpu.count * HOURS_PER_MONTH),
    terms,
    expiresAt,
    publishedAt
  };
}
