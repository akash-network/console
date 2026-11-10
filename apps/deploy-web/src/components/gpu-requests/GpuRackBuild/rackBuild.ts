import { findCatalogGpu, REGION_AREAS, STARTS, TERMS, unitOfGpu } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { GpuQuoteDraft, QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import { countUnits, describeGpuModel, formatDate, pluralize } from "../gpuQuoteDraft/gpuQuoteDraft";

export type RackPart = "rack" | "servers" | "network" | "storage" | "floor" | "power" | "cage";

/** An 8U HGX server, a 4U PCIe server, or a rack-scale NVL72 system. */
export type RackKind = "8u" | "4u" | "nvl";

export type RackCallout = { part: Exclude<RackPart, "rack">; side: "left" | "right"; label: string; value: string };

export type RackBuild = {
  kind: RackKind;
  serversInRack: number;
  sleds: number;
  powerStrips: number;
  hasUps: boolean;
  isPowered: boolean;
  isReview: boolean;
  isBuilt: Record<RackPart, boolean>;
  currentPart: RackPart | null;
  stepOfPart: Record<RackPart, QuoteStepId>;
  callouts: RackCallout[];
  title: string;
  readout: string;
};

const SERVERS_PER_RACK: Record<RackKind, number> = { "8u": 4, "4u": 8, nvl: 1 };

const MAX_SLEDS = 8;

/** NVMe sleds hold 3.84 TB each, so the drawing seats one per that much storage. */
const TB_PER_SLED = 3.84;

const PART_OF_STEP: Partial<Record<QuoteStepId, RackPart>> = {
  interconnect: "network",
  storage: "storage",
  region: "floor",
  sla: "power",
  timing: "cage"
};

const FABRIC_CALLOUTS = { infiniband: "InfiniBand", roce: "RoCE", any: "IB or RoCE" } as const;

const MAX_CALLOUT_AREAS = 2;

/** The room fills in as questions are reached: answered hardware arrives with the starting point, everything else with its own step. */
export function describeRackBuild({
  steps,
  draft,
  setupName,
  reachedSteps,
  currentStep
}: {
  steps: QuoteStepId[];
  draft: GpuQuoteDraft;
  setupName: string | undefined;
  reachedSteps: ReadonlySet<QuoteStepId>;
  currentStep: QuoteStepId;
}): RackBuild {
  const isReview = currentStep === "review";
  const hasReached = (step: QuoteStepId) => isReview || reachedSteps.has(step);
  const stepOfPart: Record<RackPart, QuoteStepId> = {
    rack: "start",
    servers: steps.includes("gpu") ? "gpu" : "start",
    network: steps.includes("interconnect") ? "interconnect" : "start",
    storage: steps.includes("storage") ? "storage" : "start",
    floor: "region",
    power: "sla",
    cage: "timing"
  };
  const hasServers = !!draft.gpuModel && hasReached(stepOfPart.servers);
  const isBuilt: Record<RackPart, boolean> = {
    rack: true,
    servers: hasServers,
    network: hasReached(stepOfPart.network),
    storage: hasServers && hasReached(stepOfPart.storage) && draft.storageTbPerNode > 0,
    floor: hasReached("region"),
    power: hasReached("sla"),
    cage: hasReached("timing")
  };
  const kind = kindOfGpu(draft.gpuModel);
  const units = hasServers ? countUnits(draft).count : 0;
  const racks = Math.max(1, Math.ceil(units / SERVERS_PER_RACK[kind]));

  return {
    kind,
    serversInRack: Math.min(SERVERS_PER_RACK[kind], units),
    sleds: draft.storageTbPerNode > 0 ? Math.min(MAX_SLEDS, Math.ceil(draft.storageTbPerNode / TB_PER_SLED)) : 0,
    powerStrips: draft.sla === "99.5" || draft.sla === "99.9" ? 2 : 1,
    hasUps: isBuilt.power && draft.sla === "99.9",
    isPowered: isReview || isBuilt.power,
    isReview,
    isBuilt,
    currentPart: currentPartOf(currentStep, hasServers),
    stepOfPart,
    callouts: describeCallouts(draft, isBuilt),
    title: setupName ?? "GPU request",
    readout: hasServers ? `${pluralize(draft.gpuCount, "GPU")}${racks > 1 ? ` · ${racks} racks` : ""}` : "Empty rack"
  };
}

function kindOfGpu(gpuModel: string | null): RackKind {
  if (unitOfGpu(gpuModel).name === "rack") return "nvl";
  return findCatalogGpu(gpuModel)?.serverLink === null ? "4u" : "8u";
}

function currentPartOf(step: QuoteStepId, hasServers: boolean): RackPart | null {
  if (step === "start" || step === "gpu") return hasServers ? "servers" : "rack";
  return PART_OF_STEP[step] ?? null;
}

function describeCallouts(draft: GpuQuoteDraft, isBuilt: Record<RackPart, boolean>): RackCallout[] {
  const callouts: (RackCallout | false)[] = [
    isBuilt.network && { part: "network", side: "left", label: "Network", value: FABRIC_CALLOUTS[draft.fabric] },
    isBuilt.storage && { part: "storage", side: "left", label: "Storage", value: `${draft.storageTbPerNode} TB/${unitOfGpu(draft.gpuModel).name}` },
    isBuilt.servers && { part: "servers", side: "left", label: "GPUs", value: `${draft.gpuCount}× ${shortGpuName(draft)}` },
    isBuilt.cage && { part: "cage", side: "right", label: "Term", value: `${TERMS.find(term => term.value === draft.term)?.shortLabel ?? "—"} · ${shortStart(draft)}` },
    isBuilt.power && { part: "power", side: "right", label: "Uptime", value: draft.sla ? `${draft.sla}%` : "No SLA" },
    isBuilt.floor && { part: "floor", side: "right", label: "Region", value: shortRegion(draft) }
  ];

  return callouts.filter((callout): callout is RackCallout => callout !== false);
}

function shortGpuName(draft: GpuQuoteDraft): string {
  const gpu = findCatalogGpu(draft.gpuModel);
  return gpu ? gpu.shortLabel ?? gpu.label : describeGpuModel(draft) ?? "GPU";
}

function shortStart(draft: GpuQuoteDraft): string {
  if (draft.start !== "date") return STARTS.find(start => start.value === draft.start)!.shortLabel;
  return draft.startDate ? formatDate(draft.startDate, { month: "short", day: "numeric" }) : "—";
}

function shortRegion(draft: GpuQuoteDraft): string {
  if (draft.regionMode === "any") return "Anywhere";

  const codes = REGION_AREAS.filter(area => draft.areas.includes(area.value)).map(area => area.code);
  if (codes.length === 0) return "—";

  const list = codes.length > MAX_CALLOUT_AREAS ? `${codes.slice(0, MAX_CALLOUT_AREAS).join(", ")} +${codes.length - MAX_CALLOUT_AREAS}` : codes.join(", ");
  return draft.regionMode === "only" ? list : `Not ${list}`;
}
