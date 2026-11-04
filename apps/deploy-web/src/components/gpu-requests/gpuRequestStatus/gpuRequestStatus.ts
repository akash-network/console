import type { paths } from "@akashnetwork/console-api-types";

import { GPUS_PER_NODE, REGION_AREAS, TERMS } from "../gpuQuoteDraft/gpuQuoteCatalog";

export type HardwareRequest = paths["/v1/hardware-requests"]["get"]["responses"][200]["content"]["application/json"]["data"][number];
export type HardwareRequestStatus = HardwareRequest["status"];
type RequestSpec = NonNullable<HardwareRequest["spec"]>;

export type TrackerStage = { status: HardwareRequestStatus; label: string; state: "done" | "current" | "upcoming" };

const TRACKED_STATUSES: { status: HardwareRequestStatus; label: string }[] = [
  { status: "submitted", label: "Submitted" },
  { status: "in_review", label: "In review" },
  { status: "sourcing", label: "Sourcing" },
  { status: "offers", label: "Offers" },
  { status: "accepted", label: "Accepted" }
];

const END_STATE_LABELS: Partial<Record<HardwareRequestStatus, string>> = { withdrawn: "Withdrawn", closed: "Closed" };

/** Withdrawn and closed requests left the track, so they show an end state instead of a tracker; a fulfilled one completed it. */
export function describeTracker(status: HardwareRequestStatus): TrackerStage[] | null {
  if (END_STATE_LABELS[status]) return null;

  const currentIndex = status === "fulfilled" ? TRACKED_STATUSES.length : TRACKED_STATUSES.findIndex(stage => stage.status === status);
  return TRACKED_STATUSES.map((stage, index) => ({
    ...stage,
    state: index < currentIndex || (index === currentIndex && status === "accepted") ? "done" : index === currentIndex ? "current" : "upcoming"
  }));
}

const STATUSES_WITH_OFFERS: HardwareRequestStatus[] = ["offers", "accepted", "fulfilled"];

export function hasOffers(status: HardwareRequestStatus): boolean {
  return STATUSES_WITH_OFFERS.includes(status);
}

export function describeEndState(status: HardwareRequestStatus): string | null {
  return END_STATE_LABELS[status] ?? null;
}

export function describeStatusMessage(request: Pick<HardwareRequest, "status" | "spec">): string {
  switch (request.status) {
    case "submitted":
      return "Got it. We'll start reviewing your request shortly.";
    case "in_review":
      return `We're reviewing your request. If anything's unclear, we'll reach out by ${request.spec?.phone ? "email or phone" : "email"}.`;
    case "sourcing":
      return "We're talking to providers who can supply this hardware.";
    case "offers":
      return "We have offers for you and will email you to go over them.";
    case "accepted":
      return "You accepted an offer. We're getting it ready with the provider.";
    case "fulfilled":
      return "Your GPUs are ready.";
    case "withdrawn":
      return "You withdrew this request.";
    case "closed":
      return "This request is closed.";
  }
}

export function describeRequestTitle(request: Pick<HardwareRequest, "spec" | "gpuModel" | "quantity" | "region">): string {
  if (request.spec) return describeSpecGpus(request.spec);
  if (request.gpuModel) return `${request.quantity ?? 1}× ${request.gpuModel}`;
  if (request.region) return `Region: ${request.region}`;
  return "Hardware request";
}

/** One line of the answers beyond the GPUs, in the order the request form asks them; a request from the old form has its details instead. */
export function describeRequestSummary(request: Pick<HardwareRequest, "spec" | "details">): string {
  const { spec } = request;
  if (!spec) return request.details ?? "";

  return [
    describeSpecRegion(spec),
    spec.storage.tbPerNode > 0 && `${spec.storage.tbPerNode} TB${spec.storage.nvme ? " NVMe" : ""}`,
    spec.sla && `${spec.sla}% uptime`,
    TERMS.find(term => term.value === spec.term)?.label,
    describeSpecPrice(spec)
  ]
    .filter(Boolean)
    .join(" · ");
}

function describeSpecGpus({ gpu }: RequestSpec): string {
  if (gpu.count < GPUS_PER_NODE) return `${gpu.count}× ${gpu.model}`;

  const servers = Math.ceil(gpu.count / GPUS_PER_NODE);
  return `${gpu.count}× ${gpu.model} · ${servers} ${servers === 1 ? "server" : "servers"}`;
}

export function describeSpecRegion({ region }: RequestSpec): string {
  const areaNames = REGION_AREAS.filter(area => region.areas.includes(area.value))
    .map(area => area.label)
    .join(", ");

  switch (region.mode) {
    case "any":
      return "Anywhere";
    case "only":
      return areaNames;
    case "except":
      return `Anywhere except ${areaNames}`;
  }
}

export function describeSpecPrice({ targetPrice }: RequestSpec): string {
  const min = targetPrice?.minUsdPerGpuHour;
  const max = targetPrice?.maxUsdPerGpuHour;

  if (min && max) return `$${min.toFixed(2)}–$${max.toFixed(2)} per GPU-hour`;
  if (max) return `Up to $${max.toFixed(2)} per GPU-hour`;
  if (min) return `From $${min.toFixed(2)} per GPU-hour`;
  return "Open to offers";
}
