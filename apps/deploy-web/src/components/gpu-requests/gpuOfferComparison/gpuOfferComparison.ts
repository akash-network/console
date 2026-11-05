import type { paths } from "@akashnetwork/console-api-types";
import { addDays, format } from "date-fns";

import { TERMS } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { describeSpecPrice, describeSpecRegion } from "../gpuRequestStatus/gpuRequestStatus";

export type GpuRequestOffer = paths["/v1/hardware-requests/{id}/offers"]["get"]["responses"][200]["content"]["application/json"]["data"][number];
type RequestSpec = NonNullable<HardwareRequest["spec"]>;
type Interconnect = RequestSpec["gpu"]["interconnect"];

export type OfferValue = { main: string; sub?: string; mismatch?: string };

export type OfferAttribute = { id: string; label: string; request: OfferValue; offer: (offer: GpuRequestOffer) => OfferValue };

export type OfferSort = "price" | "available" | "expires";

export const OFFER_SORTS: { value: OfferSort; label: string }[] = [
  { value: "price", label: "Lowest price" },
  { value: "available", label: "Soonest available" },
  { value: "expires", label: "Expiring soonest" }
];

const SORT_KEYS: Record<OfferSort, (offer: GpuRequestOffer) => string | number> = {
  price: offer => offer.usdPerGpuHour,
  available: offer => offer.terms.availableFrom,
  expires: offer => offer.expiresAt
};

const INTERCONNECT_LABELS: Record<Interconnect, string> = { none: "None", server: "Inside each server", cluster: "Across servers" };

const INTERCONNECT_RANKS: Record<Interconnect, number> = { none: 0, server: 1, cluster: 2 };

const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_ASAP_LEAD_DAYS = 7;

const usd = (amount: number) => `$${amount.toFixed(2)}`;

const termLabel = (term: RequestSpec["term"]) => TERMS.find(candidate => candidate.value === term)?.label ?? term;

const describeGpus = ({ count, model }: { count: number; model: string }) => `${count}× ${model}`;

const describeStorage = ({ tbPerNode, nvme }: RequestSpec["storage"]) => (tbPerNode > 0 ? `${tbPerNode} TB${nvme ? " NVMe" : ""}` : "None");

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function describeStart(start: RequestSpec["start"]): string {
  if (start.kind === "date") return `From ${formatDate(start.date)}`;
  return start.kind === "asap" ? "As soon as possible" : "Flexible";
}

/** Offers are numbered in the order they were published, so a number stays put while sorting. */
export function labelOffers(offers: GpuRequestOffer[]): Map<string, string> {
  return new Map(offers.map((offer, index) => [offer.id, `Offer ${index + 1}`]));
}

/** Once one offer is accepted the others are closed, so only the accepted one stays worth showing. */
export function listShownOffers(offers: GpuRequestOffer[]): GpuRequestOffer[] {
  const accepted = offers.filter(offer => offer.status === "accepted");
  return accepted.length > 0 ? accepted : offers.filter(offer => offer.status !== "closed");
}

export function sortOffers(offers: GpuRequestOffer[], sort: OfferSort): GpuRequestOffer[] {
  const key = SORT_KEYS[sort];
  return [...offers].sort((first, second) => compare(key(first), key(second)) || first.usdPerGpuHour - second.usdPerGpuHour);
}

function compare(first: string | number, second: string | number): number {
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

export function describeOfferState(offer: GpuRequestOffer, now: Date): string {
  if (offer.status === "accepted") return "Accepted";
  if (offer.status === "declined") return "Declined";
  if (offer.status === "closed") return "Closed";
  if (offer.expired) return "Expired";

  const daysLeft = Math.floor((new Date(offer.expiresAt).getTime() - now.getTime()) / DAY_MS);
  if (daysLeft < 1) return "Expires today";
  return `Expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
}

/** Lists what an offer is compared on, flagging each value that falls short of the request; a request from the old form has no answers to compare. */
export function describeOfferAttributes(spec: RequestSpec | null, today: string): OfferAttribute[] {
  return [
    {
      id: "price",
      label: "Price per GPU-hour",
      request: { main: spec ? describeSpecPrice(spec) : "—" },
      offer: offer => ({
        main: usd(offer.usdPerGpuHour),
        sub: `≈ $${offer.estimatedMonthlyUsd.toLocaleString("en-US")} a month`,
        mismatch: priceMismatch(offer, spec)
      })
    },
    {
      id: "gpus",
      label: "GPUs",
      request: { main: spec ? describeGpus(spec.gpu) : "—" },
      offer: offer => ({ main: describeGpus(offer.terms.gpu), mismatch: gpuMismatch(offer, spec) })
    },
    { id: "location", label: "Location", request: { main: spec ? describeSpecRegion(spec) : "—" }, offer: offer => ({ main: offer.terms.location }) },
    {
      id: "available",
      label: "Available",
      request: { main: spec ? describeStart(spec.start) : "—" },
      offer: ({ terms: { availableFrom } }) => ({
        main: availableFrom <= today ? "Now" : formatDate(availableFrom),
        mismatch: availabilityMismatch(availableFrom, spec, today)
      })
    },
    {
      id: "term",
      label: "Term",
      request: { main: spec ? termLabel(spec.term) : "—" },
      offer: ({ terms }) => ({
        main: termLabel(terms.term),
        mismatch: spec && terms.term !== spec.term ? `You asked for ${termLabel(spec.term).toLowerCase()}` : undefined
      })
    },
    {
      id: "sla",
      label: "Uptime SLA",
      request: { main: spec?.sla ? `${spec.sla}%` : spec ? "No requirement" : "—" },
      offer: ({ terms: { sla } }) => ({
        main: sla ? `${sla}%` : "Best effort",
        mismatch: spec?.sla && (!sla || Number(sla) < Number(spec.sla)) ? `Below your ${spec.sla}%` : undefined
      })
    },
    {
      id: "interconnect",
      label: "Interconnect",
      request: { main: spec ? INTERCONNECT_LABELS[spec.gpu.interconnect] : "—" },
      offer: ({ terms: { gpu } }) => ({
        main: INTERCONNECT_LABELS[gpu.interconnect],
        mismatch:
          spec && INTERCONNECT_RANKS[gpu.interconnect] < INTERCONNECT_RANKS[spec.gpu.interconnect]
            ? `You asked for ${INTERCONNECT_LABELS[spec.gpu.interconnect].toLowerCase()}`
            : undefined
      })
    },
    {
      id: "storage",
      label: "Storage per server",
      request: { main: spec ? describeStorage(spec.storage) : "—" },
      offer: ({ terms: { storage } }) => ({ main: describeStorage(storage), mismatch: storageMismatch(storage, spec) })
    },
    {
      id: "internet",
      label: "Internet",
      request: { main: spec?.uplinkGbps ? `${spec.uplinkGbps} Gbps` : spec ? "No preference" : "—" },
      offer: ({ terms: { uplinkGbps } }) => ({
        main: uplinkGbps ? `${uplinkGbps} Gbps` : "Not stated",
        mismatch: spec?.uplinkGbps && (uplinkGbps ?? 0) < spec.uplinkGbps ? `Slower than your ${spec.uplinkGbps} Gbps` : undefined
      })
    },
    {
      id: "provider",
      label: "Provider",
      request: { main: "Any" },
      offer: offer => ({
        main: offer.providerAudited ? "Audited" : "Not audited",
        sub: offer.providerUptime7d === null ? undefined : `${(offer.providerUptime7d * 100).toFixed(1)}% uptime, last 7 days`
      })
    }
  ];
}

function priceMismatch(offer: GpuRequestOffer, spec: RequestSpec | null): string | undefined {
  const max = spec?.targetPrice?.maxUsdPerGpuHour;
  return max && offer.usdPerGpuHour > max ? `${usd(offer.usdPerGpuHour - max)} over your range` : undefined;
}

function availabilityMismatch(availableFrom: string, spec: RequestSpec | null, today: string): string | undefined {
  if (spec?.start.kind === "date") return availableFrom > spec.start.date ? "After your start date" : undefined;
  if (spec?.start.kind !== "asap") return undefined;

  const latestAsapDate = format(addDays(new Date(`${today}T00:00:00`), MAX_ASAP_LEAD_DAYS), "yyyy-MM-dd");
  return availableFrom > latestAsapDate ? `More than ${MAX_ASAP_LEAD_DAYS} days away` : undefined;
}

function gpuMismatch({ terms: { gpu } }: GpuRequestOffer, spec: RequestSpec | null): string | undefined {
  if (!spec) return undefined;

  const isOtherModel = gpu.model.toLowerCase() !== spec.gpu.model.toLowerCase();
  return isOtherModel || gpu.count < spec.gpu.count ? `You asked for ${describeGpus(spec.gpu)}` : undefined;
}

function storageMismatch(storage: RequestSpec["storage"], spec: RequestSpec | null): string | undefined {
  if (!spec) return undefined;
  if (storage.tbPerNode < spec.storage.tbPerNode) return `Less than your ${spec.storage.tbPerNode} TB`;
  return spec.storage.nvme && !storage.nvme ? "Not NVMe" : undefined;
}
