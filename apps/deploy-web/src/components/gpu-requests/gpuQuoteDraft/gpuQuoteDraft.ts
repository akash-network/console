import type {
  Fabric,
  FabricGbps,
  Interconnect,
  QuoteRequestData,
  QuoteRequestSource,
  RegionArea,
  RegionMode,
  RequestTerm,
  StartKind,
  UplinkGbps,
  UptimeSla
} from "./gpuQuoteCatalog";
import { FABRICS, GPU_CATALOG, GPUS_PER_NODE, MAX_USD_PER_GPU_HOUR, OTHER_GPU_MODEL, REGION_AREAS, SMALL_GPU_COUNTS, TERMS, UPLINKS } from "./gpuQuoteCatalog";

export type StartingPointId = "configuration" | "full_server" | "training_cluster" | "inference_fleet" | "custom";

export type GpuQuoteDraft = {
  startingPoint: StartingPointId | null;
  gpuModel: string | null;
  otherGpuModel: string;
  gpuCount: number;
  interconnect: Interconnect;
  fabric: Fabric;
  fabricGbps: FabricGbps;
  regionMode: RegionMode;
  areas: RegionArea[];
  uplinkGbps: UplinkGbps | null;
  storageTbPerNode: number;
  nvme: boolean;
  sla: UptimeSla | null;
  minUsdPerGpuHour: string;
  maxUsdPerGpuHour: string;
  term: RequestTerm;
  start: StartKind;
  startDate: string;
  couldGrow: boolean;
  wantsToTalk: boolean;
  email: string;
  phone: string;
  company: string;
  notes: string;
};

export type DraftAnswers = Partial<
  Pick<
    GpuQuoteDraft,
    "gpuModel" | "otherGpuModel" | "gpuCount" | "interconnect" | "fabric" | "fabricGbps" | "uplinkGbps" | "storageTbPerNode" | "nvme" | "regionMode" | "areas"
  >
>;

export type StartingPoint = { id: StartingPointId; name: string; use: string; answers: DraftAnswers };

export const STARTER_PACKAGES: StartingPoint[] = [
  {
    id: "full_server",
    name: "Full server",
    use: "Fine-tuning and large models",
    answers: { gpuModel: "h200", gpuCount: 8, interconnect: "server", storageTbPerNode: 8, nvme: true, uplinkGbps: 10 }
  },
  {
    id: "training_cluster",
    name: "Training cluster",
    use: "Multi-node training",
    answers: {
      gpuModel: "b200",
      gpuCount: 32,
      interconnect: "cluster",
      fabric: "infiniband",
      fabricGbps: 400,
      storageTbPerNode: 30,
      nvme: true,
      uplinkGbps: 25
    }
  },
  {
    id: "inference_fleet",
    name: "Inference fleet",
    use: "Serving models at scale",
    answers: { gpuModel: "l40s", gpuCount: 16, interconnect: "none", storageTbPerNode: 4, nvme: true, uplinkGbps: 10 }
  }
];

export const CUSTOM_STARTING_POINT: StartingPoint = { id: "custom", name: "Custom", use: "Pick every detail yourself", answers: {} };

export type QuoteStepId = "start" | "gpu" | "interconnect" | "region" | "storage" | "sla" | "price" | "timing" | "extras" | "contact" | "review";

export type MissingAnswer = { step: QuoteStepId; label: string };

export type ReviewLine = { step: QuoteStepId; label: string; value: string | null };

export type ConfigurationHardware = { gpuCount: number; gpuModels: string[]; storageBytes: number; regions: string[] };

export type RequestLane = "sales" | "automated";

const BYTES_PER_TB = 1024 ** 4;

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
    interconnect: "none",
    fabric: "any",
    fabricGbps: 400,
    regionMode: "any",
    areas: [],
    uplinkGbps: null,
    storageTbPerNode: 1,
    nvme: true,
    sla: null,
    minUsdPerGpuHour: "",
    maxUsdPerGpuHour: "",
    term: "month_to_month",
    start: "asap",
    startDate: "",
    couldGrow: false,
    wantsToTalk: false,
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

export function configurationStartingPoint(hardware: ConfigurationHardware): StartingPoint {
  const areas = [...new Set(hardware.regions.flatMap(region => areaOfRegion(region) ?? []))];

  return {
    id: "configuration",
    name: "Your configuration",
    use: "What you set up on the Configure page",
    answers: {
      ...(hardware.gpuCount > 0 ? { gpuCount: snapGpuCount(hardware.gpuCount) } : {}),
      ...(hardware.gpuModels.length > 0 ? gpuModelAnswers(hardware.gpuModels[0]) : {}),
      storageTbPerNode: Math.max(1, Math.ceil(hardware.storageBytes / BYTES_PER_TB)),
      ...(areas.length > 0 ? { regionMode: "only", areas } : {})
    }
  };
}

/** A search from the GPU menu names a model, matched to the catalog when it can be; an empty search answers nothing. */
export function answersForGpuModel(search: string): DraftAnswers | undefined {
  const model = search.trim();
  return model ? gpuModelAnswers(model) : undefined;
}

export function applyStartingPoint(draft: GpuQuoteDraft, startingPoint: StartingPoint): GpuQuoteDraft {
  return { ...draft, ...startingPoint.answers, startingPoint: startingPoint.id };
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
    "price",
    "timing",
    "extras",
    "contact",
    "review"
  ];

  return steps.filter((step): step is QuoteStepId => step !== false);
}

export function asksUplink(answers: DraftAnswers): boolean {
  return answers.uplinkGbps === undefined;
}

/** An answer that came with the starting point has no step of its own, so changing it means picking another starting point. */
export function stepToChange(steps: QuoteStepId[], step: QuoteStepId): QuoteStepId {
  return steps.includes(step) ? step : "start";
}

export function listMissingAnswers(draft: GpuQuoteDraft, today: string): MissingAnswer[] {
  const minPrice = parsePrice(draft.minUsdPerGpuHour);
  const maxPrice = parsePrice(draft.maxUsdPerGpuHour);
  const missing: (MissingAnswer | false)[] = [
    !describeGpuModel(draft) && { step: "gpu", label: "a GPU model" },
    draft.regionMode !== "any" && draft.areas.length === 0 && { step: "region", label: "at least one region" },
    draft.regionMode === "except" && draft.areas.length >= REGION_AREAS.length && { step: "region", label: "a region to leave open" },
    (!minPrice.isValid || !maxPrice.isValid) && { step: "price", label: `a price between $0 and $${MAX_USD_PER_GPU_HOUR} per GPU-hour` },
    !!minPrice.value && !!maxPrice.value && minPrice.value > maxPrice.value && { step: "price", label: "a lowest price under the highest" },
    draft.start === "date" && !draft.startDate && { step: "timing", label: "a start date" },
    draft.start === "date" && !!draft.startDate && draft.startDate < today && { step: "timing", label: "a start date from today on" },
    !draft.email.trim() && { step: "contact", label: "an email address" }
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
  const minUsdPerGpuHour = parsePrice(draft.minUsdPerGpuHour).value;
  const maxUsdPerGpuHour = parsePrice(draft.maxUsdPerGpuHour).value;

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
        ...(interconnect === "cluster" ? { fabric: draft.fabric, fabricGbps: draft.fabricGbps } : {})
      },
      region: { mode: draft.regionMode, areas: draft.regionMode === "any" ? [] : draft.areas },
      uplinkGbps: draft.uplinkGbps,
      storage: { tbPerNode: draft.storageTbPerNode, nvme: draft.nvme },
      sla: draft.sla,
      targetPrice: minUsdPerGpuHour || maxUsdPerGpuHour ? { minUsdPerGpuHour, maxUsdPerGpuHour } : null,
      term: draft.term,
      start: draft.start === "date" ? { kind: "date", date: draft.startDate } : { kind: draft.start },
      couldGrow: draft.couldGrow,
      wantsToTalk: draft.wantsToTalk,
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
    { step: "region", label: "Internet", value: UPLINKS.find(uplink => uplink.value === draft.uplinkGbps)?.label ?? null },
    { step: "storage", label: "Storage", value: describeStorage(draft) },
    { step: "sla", label: "Uptime", value: draft.sla ? `${draft.sla}%` : "No requirement" },
    { step: "price", label: "Target price", value: describeTargetPrice(draft) },
    { step: "timing", label: "Term", value: TERMS.find(term => term.value === draft.term)?.label ?? null },
    { step: "timing", label: "Start", value: describeStart(draft) },
    {
      step: "extras",
      label: "Also",
      value: [draft.couldGrow && "Could grow", draft.wantsToTalk && "Wants to talk to someone"].filter(Boolean).join(", ") || "Nothing else"
    },
    { step: "contact", label: "Contact", value: [draft.email.trim(), draft.phone.trim(), draft.company.trim()].filter(Boolean).join(" · ") || null }
  ];

  return lines.filter((line): line is ReviewLine => line !== false);
}

/** The card line for a starting point, naming only what it answers. */
export function describeStartingPoint({ answers }: StartingPoint): string {
  const model = answers.gpuModel === undefined ? "any GPU" : describeGpuModel({ gpuModel: answers.gpuModel, otherGpuModel: answers.otherGpuModel ?? "" });
  const interconnectNames: Record<Interconnect, string> = { none: "PCIe only", server: "Linked in each server", cluster: "Linked across servers" };

  return [
    answers.gpuCount !== undefined && `${answers.gpuCount}× ${model}`,
    answers.interconnect && interconnectNames[answers.interconnect],
    answers.storageTbPerNode !== undefined && `${answers.storageTbPerNode} TB${answers.nvme ? " NVMe" : ""}`,
    answers.areas &&
      REGION_AREAS.filter(area => answers.areas?.includes(area.value))
        .map(area => area.label)
        .join(", ")
  ]
    .filter(Boolean)
    .join(" · ");
}

export function describeNextStep(lane: RequestLane | undefined): string {
  return lane === "sales" ? "Our team will reply within 4 business hours." : "We'll get back to you within one business day.";
}

function describeGpus(draft: GpuQuoteDraft): string | null {
  const model = describeGpuModel(draft);
  if (!model) return null;
  if (!isWholeNodes(draft.gpuCount)) return `${draft.gpuCount}× ${model}`;

  const nodes = draft.gpuCount / GPUS_PER_NODE;
  return `${draft.gpuCount}× ${model} · ${nodes} ${nodes === 1 ? "server" : "servers"}`;
}

function describeInterconnect(draft: GpuQuoteDraft): string {
  switch (draft.interconnect) {
    case "none":
      return "Not needed";
    case "server":
      return "Linked inside each server";
    case "cluster":
      return `${draft.fabric === "any" ? "InfiniBand or RoCE" : FABRICS.find(fabric => fabric.value === draft.fabric)?.label} between servers at ${draft.fabricGbps} Gb/s`;
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

function describeTargetPrice(draft: GpuQuoteDraft): string | null {
  const min = parsePrice(draft.minUsdPerGpuHour);
  const max = parsePrice(draft.maxUsdPerGpuHour);
  if (!min.isValid || !max.isValid) return null;

  if (min.value && max.value) return `$${min.value.toFixed(2)}–$${max.value.toFixed(2)} per GPU-hour`;
  if (max.value) return `Up to $${max.value.toFixed(2)} per GPU-hour`;
  if (min.value) return `From $${min.value.toFixed(2)} per GPU-hour`;
  return "Open to offers";
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

function parsePrice(text: string): { value?: number; isValid: boolean } {
  if (!text.trim()) return { isValid: true };

  const value = Number(text);
  return { value, isValid: Number.isFinite(value) && value > 0 && value <= MAX_USD_PER_GPU_HOUR };
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
