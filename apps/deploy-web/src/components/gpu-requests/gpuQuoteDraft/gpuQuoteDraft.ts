import { differenceInCalendarDays } from "date-fns";
import { z } from "zod";

import type {
  CatalogGpu,
  Fabric,
  Interconnect,
  QuoteRequestData,
  QuoteRequestReceipt,
  QuoteRequestSource,
  RegionArea,
  RegionMode,
  RequestTerm,
  StartKind,
  UptimeSla
} from "./gpuQuoteCatalog";
import {
  FABRICS,
  GPU_CATALOG,
  GPUS_PER_NODE,
  OTHER_GPU_MODEL,
  RECOMMENDED_STORAGE_TB_PER_NODE,
  REGION_AREAS,
  SERVER_LINKS,
  SMALL_GPU_COUNTS,
  TERMS
} from "./gpuQuoteCatalog";

export type StartingPointId = "configuration" | "full_server" | "training_cluster" | "inference_fleet" | "custom";

export type GpuQuoteDraft = {
  startingPoint: StartingPointId | null;
  gpuModel: string | null;
  otherGpuModel: string;
  gpuCount: number;
  interconnect: Interconnect;
  fabric: Fabric;
  regionMode: RegionMode;
  areas: RegionArea[];
  storageTbPerNode: number;
  nvme: boolean;
  sla: UptimeSla | null;
  term: RequestTerm;
  start: StartKind;
  startDate: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
};

export type DraftAnswers = Partial<
  Pick<
    GpuQuoteDraft,
    "gpuModel" | "otherGpuModel" | "gpuCount" | "interconnect" | "fabric" | "storageTbPerNode" | "nvme" | "regionMode" | "areas"
  >
>;

export type StartingPoint = { id: StartingPointId; name: string; use: string; answers: DraftAnswers; detail?: string };

export const STARTER_PACKAGES: StartingPoint[] = [
  {
    id: "inference_fleet",
    name: "Inference fleet",
    use: "Serving models at scale",
    answers: { gpuModel: "b300", gpuCount: 16, interconnect: "server", storageTbPerNode: 4, nvme: true }
  },
  {
    id: "training_cluster",
    name: "Training cluster",
    use: "Multi-node training",
    answers: { gpuModel: "gb300", gpuCount: 72, interconnect: "server", storageTbPerNode: 30, nvme: true }
  },
  {
    id: "full_server",
    name: "Full server",
    use: "Fine-tuning and large models",
    answers: { gpuModel: "pro6000se", gpuCount: 8, interconnect: "none", storageTbPerNode: 8, nvme: true }
  }
];

export const CUSTOM_STARTING_POINT: StartingPoint = { id: "custom", name: "Custom", use: "Pick every detail yourself", answers: {} };

export type QuoteStepId = "start" | "gpu" | "interconnect" | "region" | "storage" | "sla" | "timing" | "contact" | "review";

export type MissingAnswer = { step: QuoteStepId; label: string };

export type ReviewLine = { step: QuoteStepId; label: string; value: string | null };

export type StartingPointSpec = { label: "Nodes" | "Link" | "Storage"; value: string };

export type StartingPointCard = { gpuCount?: number; model: string; memory: string | null; specs: StartingPointSpec[] };

export type ConfigurationHardware = { gpuCount: number; gpuModels: string[]; storageBytes: number; regions: string[] };

const BYTES_PER_TB = 1024 ** 4;

const UNANSWERED_SPEC = "—";

const FABRIC_SHORT_NAMES: Record<Fabric, string> = { any: "InfiniBand or RoCE", infiniband: "InfiniBand", roce: "RoCE" };

const AREA_PATTERNS: [RegionArea, RegExp][] = [
  ["us", /^(na-)?us/],
  ["ca", /^(na-)?ca/],
  ["uk", /^(eu-)?(uk|gb)/],
  ["eu", /^eu/],
  ["apac", /^(ap|as)/],
  ["me", /^me/],
  ["latam", /^(sa|latam)/]
];

export function createBlankDraft(email: string): GpuQuoteDraft {
  return {
    startingPoint: null,
    gpuModel: null,
    otherGpuModel: "",
    gpuCount: 1,
    interconnect: "cluster",
    fabric: "infiniband",
    regionMode: "any",
    areas: [],
    storageTbPerNode: RECOMMENDED_STORAGE_TB_PER_NODE,
    nvme: true,
    sla: null,
    term: "month_to_month",
    start: "asap",
    startDate: "",
    email,
    phone: "",
    company: "",
    notes: ""
  };
}

/** Requests come in single GPUs up to 4, then in whole servers of 8, so any other count rounds up to the next of those. */
export function snapGpuCount(count: number): number {
  const smallCount = SMALL_GPU_COUNTS.find(size => count <= size);
  return smallCount ?? Math.ceil(count / GPUS_PER_NODE) * GPUS_PER_NODE;
}

export function isWholeNodes(gpuCount: number): boolean {
  return gpuCount >= GPUS_PER_NODE;
}

/** Storage is asked in whole terabytes, so a configuration with less than one leaves the storage question to the user. */
export function configurationStartingPoint(hardware: ConfigurationHardware, summary: string): StartingPoint {
  const areas = [...new Set(hardware.regions.flatMap(region => areaOfRegion(region) ?? []))];

  return {
    id: "configuration",
    name: "Your configuration",
    use: "What you set up on the Configure page",
    detail: summary,
    answers: {
      ...(hardware.gpuCount > 0 ? { gpuCount: snapGpuCount(hardware.gpuCount) } : {}),
      ...(hardware.gpuModels.length > 0 ? gpuModelAnswers(hardware.gpuModels[0]) : {}),
      ...(hardware.storageBytes >= BYTES_PER_TB ? { storageTbPerNode: Math.ceil(hardware.storageBytes / BYTES_PER_TB) } : {}),
      ...(areas.length > 0 ? { regionMode: "only", areas } : {})
    }
  };
}

/** A search from the GPU menu names a model, matched to the catalog when it can be; an empty search answers nothing. */
export function answersForGpuModel(search: string): DraftAnswers | undefined {
  const model = search.trim();
  return model ? gpuModelAnswers(model) : undefined;
}

/** Whole servers whose link is asked are always linked across servers, so a starting point that leaves the link open resets it. */
export function applyStartingPoint(draft: GpuQuoteDraft, startingPoint: StartingPoint): GpuQuoteDraft {
  return { ...draft, interconnect: "cluster", ...startingPoint.answers, startingPoint: startingPoint.id };
}

/** A starting point that answers a question takes its step out of the flow, and the interconnect question only applies to whole servers. */
export function listSteps(draft: GpuQuoteDraft, answers: DraftAnswers): QuoteStepId[] {
  const asksInterconnect = isWholeNodes(draft.gpuCount) && answers.interconnect === undefined;
  const steps: (QuoteStepId | false)[] = [
    "start",
    answers.gpuModel === undefined && "gpu",
    asksInterconnect && "interconnect",
    "region",
    answers.storageTbPerNode === undefined && "storage",
    "sla",
    "timing",
    "contact",
    "review"
  ];

  return steps.filter((step): step is QuoteStepId => step !== false);
}

/** An answer that came with the starting point has no step of its own, so changing it means picking another starting point. */
export function stepToChange(steps: QuoteStepId[], step: QuoteStepId): QuoteStepId {
  return steps.includes(step) ? step : "start";
}

const emailSchema = z.string().email();

export function listMissingAnswers(draft: GpuQuoteDraft, today: string): MissingAnswer[] {
  const missing: (MissingAnswer | false)[] = [
    !describeGpuModel(draft) && { step: "gpu", label: "a GPU model" },
    draft.regionMode !== "any" && draft.areas.length === 0 && { step: "region", label: "at least one region" },
    draft.regionMode === "except" && draft.areas.length >= REGION_AREAS.length && { step: "region", label: "a region to leave open" },
    draft.start === "date" && !draft.startDate && { step: "timing", label: "a start date" },
    draft.start === "date" && !!draft.startDate && draft.startDate < today && { step: "timing", label: "a start date from today on" },
    !draft.email.trim() && { step: "contact", label: "an email address" },
    !!draft.email.trim() && !emailSchema.safeParse(draft.email.trim()).success && { step: "contact", label: "a valid email address" }
  ];

  return missing.filter((answer): answer is MissingAnswer => answer !== false);
}

export function describeMissingAnswers(missing: MissingAnswer[], action: "send" | "continue"): string {
  return `Add ${joinWithAnd([...new Set(missing.map(answer => answer.label))])} to ${action}.`;
}

export function describeGpuModel(draft: Pick<GpuQuoteDraft, "gpuModel" | "otherGpuModel">): string | null {
  if (draft.gpuModel === OTHER_GPU_MODEL) return draft.otherGpuModel.trim() || null;
  return GPU_CATALOG.find(gpu => gpu.id === draft.gpuModel)?.label ?? null;
}

export function toQuoteRequestData(
  draft: GpuQuoteDraft,
  { source, configuration }: { source: QuoteRequestSource; configuration?: QuoteRequestData["configuration"] }
): QuoteRequestData {
  const interconnect = effectiveInterconnect(draft);

  return {
    category: "quote",
    email: draft.email.trim(),
    details: draft.notes.trim() || undefined,
    source,
    configuration,
    spec: {
      gpu: {
        model: describeGpuModel(draft) ?? "",
        count: draft.gpuCount,
        interconnect,
        ...(interconnect === "cluster" ? { fabric: draft.fabric } : {})
      },
      region: { mode: draft.regionMode, areas: draft.regionMode === "any" ? [] : draft.areas },
      uplinkGbps: null,
      storage: { tbPerNode: draft.storageTbPerNode, nvme: draft.nvme },
      sla: draft.sla,
      targetPrice: null,
      term: draft.term,
      start: draft.start === "date" ? { kind: "date", date: draft.startDate } : { kind: draft.start },
      couldGrow: false,
      wantsToTalk: false,
      company: draft.company.trim() || undefined,
      phone: draft.phone.trim() || undefined
    }
  };
}

export function describeReviewLines(draft: GpuQuoteDraft): ReviewLine[] {
  const lines: (ReviewLine | false)[] = [
    { step: "gpu", label: "GPUs", value: describeGpus(draft) },
    isWholeNodes(draft.gpuCount) && { step: "interconnect", label: "Connection", value: describeInterconnect(draft) },
    { step: "region", label: "Region", value: describeRegion(draft) },
    { step: "storage", label: "Storage", value: describeStorage(draft) },
    { step: "sla", label: "Uptime", value: draft.sla ? `${draft.sla}%` : "No requirement" },
    { step: "timing", label: "Term", value: TERMS.find(term => term.value === draft.term)?.label ?? null },
    { step: "timing", label: "Start", value: describeStart(draft) },
    { step: "contact", label: "Contact", value: [draft.email.trim(), draft.phone.trim(), draft.company.trim()].filter(Boolean).join(" · ") || null },
    draft.notes.trim().length > 0 && { step: "contact", label: "Notes", value: draft.notes.trim() }
  ];

  return lines.filter((line): line is ReviewLine => line !== false);
}

/** A spec the starting point leaves open shows a dash, because a later step asks it. */
export function describeStartingPointCard({ answers }: StartingPoint): StartingPointCard {
  const gpu = GPU_CATALOG.find(catalogGpu => catalogGpu.id === answers.gpuModel);

  return {
    gpuCount: answers.gpuCount,
    model: describeGpuModel({ gpuModel: answers.gpuModel ?? null, otherGpuModel: answers.otherGpuModel ?? "" }) ?? "Any GPU",
    memory: gpu ? `${gpu.vendor} · ${gpu.memory}` : null,
    specs: [
      { label: "Nodes", value: answers.gpuCount === undefined ? UNANSWERED_SPEC : describeNodes(answers.gpuCount, gpu) },
      { label: "Link", value: describeStartingPointLink(answers, gpu) },
      { label: "Storage", value: answers.storageTbPerNode === undefined ? UNANSWERED_SPEC : `${answers.storageTbPerNode} TB / node` }
    ]
  };
}

const REPLY_PROMISES: Record<QuoteRequestReceipt["lane"], { replier: string; window: string }> = {
  sales: { replier: "Our team will reply", window: "within 4 business hours" },
  automated: { replier: "We'll get back to you", window: "within one business day" }
};

export function describeNextStep({ lane, firstReplyDueAt }: Pick<QuoteRequestReceipt, "lane" | "firstReplyDueAt">, now: Date): string {
  const { replier, window } = REPLY_PROMISES[lane];
  return `${replier} ${firstReplyDueAt ? `by ${describeReplyTime(new Date(firstReplyDueAt), now)}` : window}.`;
}

function describeReplyTime(dueAt: Date, now: Date): string {
  const time = dueAt.toLocaleTimeString("en-US", dueAt.getMinutes() === 0 ? { hour: "numeric" } : { hour: "numeric", minute: "2-digit" });
  const daysAway = differenceInCalendarDays(dueAt, now);

  if (daysAway === 0) return `${time} today`;
  if (daysAway === 1) return `${time} tomorrow`;
  return `${dueAt.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
}

function describeNodes(gpuCount: number, gpu: CatalogGpu | undefined): string {
  const racks = describeWholeRacks(gpuCount, gpu);
  if (racks) return racks;

  const [nodes, gpusPerNode] = isWholeNodes(gpuCount) ? [gpuCount / GPUS_PER_NODE, GPUS_PER_NODE] : [1, gpuCount];
  return `${nodes} × ${gpusPerNode} ${gpusPerNode === 1 ? "GPU" : "GPUs"}`;
}

function describeStartingPointLink({ gpuCount, interconnect, fabric }: DraftAnswers, gpu: CatalogGpu | undefined): string {
  const serverLink = gpu ? SERVER_LINKS[gpu.vendor] : "NVLink or Infinity Fabric";

  if (interconnect === "server") return serverLink;
  if (interconnect === "cluster") return `${serverLink} + ${FABRIC_SHORT_NAMES[fabric ?? "any"]}`;
  if (interconnect === "none" || (gpuCount !== undefined && !isWholeNodes(gpuCount))) return "PCIe only";
  return UNANSWERED_SPEC;
}

function describeGpus(draft: GpuQuoteDraft): string | null {
  const model = describeGpuModel(draft);
  if (!model) return null;
  if (!isWholeNodes(draft.gpuCount)) return `${draft.gpuCount}× ${model}`;

  const racks = describeWholeRacks(draft.gpuCount, GPU_CATALOG.find(gpu => gpu.id === draft.gpuModel));
  if (racks) return `${draft.gpuCount}× ${model} · ${racks}`;

  const nodes = draft.gpuCount / GPUS_PER_NODE;
  return `${draft.gpuCount}× ${model} · ${nodes} ${nodes === 1 ? "server" : "servers"}`;
}

function describeWholeRacks(gpuCount: number, gpu: CatalogGpu | undefined): string | null {
  if (!gpu?.rack || gpuCount % gpu.rack.gpuCount !== 0) return null;

  const racks = gpuCount / gpu.rack.gpuCount;
  return `${racks} ${gpu.rack.name} ${racks === 1 ? "rack" : "racks"}`;
}

function describeInterconnect(draft: GpuQuoteDraft): string {
  switch (draft.interconnect) {
    case "none":
      return "Not needed";
    case "server":
      return "Linked inside each server";
    case "cluster":
      return `${draft.fabric === "any" ? "InfiniBand or RoCE" : FABRICS.find(fabric => fabric.value === draft.fabric)?.label} between servers`;
  }
}

function describeRegion(draft: GpuQuoteDraft): string | null {
  if (draft.regionMode === "any") return "Anywhere";
  if (draft.areas.length === 0) return null;

  const areaNames = REGION_AREAS.filter(area => draft.areas.includes(area.value))
    .map(area => area.label)
    .join(", ");
  return draft.regionMode === "only" ? areaNames : `Anywhere except ${areaNames}`;
}

function describeStorage(draft: GpuQuoteDraft): string {
  if (draft.storageTbPerNode <= 0) return "None";
  return `${draft.storageTbPerNode} TB${draft.nvme ? " NVMe" : ""}${isWholeNodes(draft.gpuCount) ? " per server" : ""}`;
}

function describeStart(draft: GpuQuoteDraft): string | null {
  switch (draft.start) {
    case "asap":
      return "As soon as possible";
    case "flexible":
      return "Flexible";
    case "date":
      return draft.startDate ? `On ${draft.startDate}` : null;
  }
}

function effectiveInterconnect(draft: GpuQuoteDraft): Interconnect {
  return isWholeNodes(draft.gpuCount) ? draft.interconnect : "none";
}

function gpuModelAnswers(sdlModel: string): DraftAnswers {
  const normalizedModel = normalize(sdlModel);
  const catalogGpu = GPU_CATALOG.find(gpu => normalizedModel.startsWith(gpu.id));
  return catalogGpu ? { gpuModel: catalogGpu.id, otherGpuModel: "" } : { gpuModel: OTHER_GPU_MODEL, otherGpuModel: sdlModel };
}

function areaOfRegion(region: string): RegionArea | undefined {
  const normalizedRegion = region.toLowerCase();
  return AREA_PATTERNS.find(([, pattern]) => pattern.test(normalizedRegion))?.[0];
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
