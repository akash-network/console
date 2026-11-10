import { differenceInCalendarDays } from "date-fns";
import { z } from "zod";

import type {
  CatalogGpu,
  Fabric,
  GpuUnit,
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
  findCatalogGpu,
  GPU_CATALOG,
  GPUS_PER_NODE,
  OTHER_GPU_MODEL,
  RECOMMENDED_STORAGE_TB_PER_NODE,
  REGION_AREAS,
  STARTS,
  TERMS,
  unitOfGpu
} from "./gpuQuoteCatalog";

export type StartingPointId = "configuration" | "full_server" | "training_cluster" | "inference_fleet" | "custom";

export type GpuQuoteDraft = {
  startingPoint: StartingPointId | null;
  gpuModel: string | null;
  otherGpuModel: string;
  gpuCount: number;
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
  Pick<GpuQuoteDraft, "gpuModel" | "otherGpuModel" | "gpuCount" | "fabric" | "storageTbPerNode" | "nvme" | "regionMode" | "areas">
>;

export type StartingPoint = { id: StartingPointId; name: string; use: string; answers: DraftAnswers; detail?: string };

export const STARTER_PACKAGES: StartingPoint[] = [
  {
    id: "inference_fleet",
    name: "Inference fleet",
    use: "Serving models at scale",
    answers: { gpuModel: "b300", gpuCount: 16, fabric: "infiniband", storageTbPerNode: 4, nvme: true }
  },
  {
    id: "training_cluster",
    name: "Training cluster",
    use: "Multi-node training",
    answers: { gpuModel: "gb300", gpuCount: 72, fabric: "infiniband", storageTbPerNode: 30, nvme: true }
  },
  {
    id: "full_server",
    name: "Full server",
    use: "Fine-tuning and large models",
    answers: { gpuModel: "pro6000", gpuCount: 8, fabric: "infiniband", storageTbPerNode: 8, nvme: true }
  }
];

export const CUSTOM_STARTING_POINT: StartingPoint = { id: "custom", name: "Custom", use: "Pick every detail yourself", answers: {} };

export type QuoteStepId = "start" | "gpu" | "interconnect" | "region" | "storage" | "sla" | "timing" | "contact" | "review";

export type MissingAnswer = { step: QuoteStepId; label: string };

export type StartingPointSpec = { label: "Nodes" | "Racks" | "Network" | "Storage"; value: string };

export type StartingPointCard = { gpuCount?: number; model: string; memory: string | null; specs: StartingPointSpec[] };

export type ConfigurationHardware = { gpuCount: number; gpuModels: string[]; storageBytes: number; regions: string[] };

const BYTES_PER_TB = 1024 ** 4;

const UNANSWERED_SPEC = "—";

const FABRIC_NAMES: Record<Fabric, string> = { any: "InfiniBand or RoCE", infiniband: "InfiniBand", roce: "RoCE" };

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
    gpuCount: GPUS_PER_NODE,
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

/** GPUs come in whole nodes, or whole racks for a rack-scale model, so any other count rounds up to the next of those. */
export function snapGpuCount(count: number, gpuModel: string | null | undefined): number {
  const unit = unitOfGpu(gpuModel);
  return Math.max(1, Math.ceil(count / unit.gpuCount)) * unit.gpuCount;
}

export function countUnits({ gpuCount, gpuModel }: Pick<GpuQuoteDraft, "gpuCount" | "gpuModel">): { unit: GpuUnit; count: number } {
  const unit = unitOfGpu(gpuModel);
  return { unit, count: Math.ceil(gpuCount / unit.gpuCount) };
}

/** A model sold in another unit size starts over at one of its units, since a count of nodes means nothing in racks. */
export function withGpuModel(draft: GpuQuoteDraft, gpuModel: string): GpuQuoteDraft {
  const isSameUnit = unitOfGpu(gpuModel).gpuCount === unitOfGpu(draft.gpuModel).gpuCount;
  return { ...draft, gpuModel, gpuCount: isSameUnit ? draft.gpuCount : unitOfGpu(gpuModel).gpuCount };
}

/** Storage is asked in whole terabytes, so a configuration with less than one leaves the storage question to the user. */
export function configurationStartingPoint(hardware: ConfigurationHardware, summary: string): StartingPoint {
  const areas = [...new Set(hardware.regions.flatMap(region => areaOfRegion(region) ?? []))];
  const modelAnswers = hardware.gpuModels.length > 0 ? gpuModelAnswers(hardware.gpuModels[0]) : {};

  return {
    id: "configuration",
    name: "Your configuration",
    use: "What you set up on the Configure page",
    detail: summary,
    answers: {
      ...(hardware.gpuCount > 0 ? { gpuCount: snapGpuCount(hardware.gpuCount, modelAnswers.gpuModel) } : {}),
      ...modelAnswers,
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

export function applyStartingPoint(draft: GpuQuoteDraft, startingPoint: StartingPoint): GpuQuoteDraft {
  const answered = { ...draft, ...startingPoint.answers, startingPoint: startingPoint.id };
  return { ...answered, gpuCount: snapGpuCount(answered.gpuCount, answered.gpuModel) };
}

/** A starting point that answers a question takes its step out of the flow. */
export function listSteps(answers: DraftAnswers): QuoteStepId[] {
  const steps: (QuoteStepId | false)[] = [
    "start",
    answers.gpuModel === undefined && "gpu",
    answers.fabric === undefined && "interconnect",
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
  return findCatalogGpu(draft.gpuModel)?.label ?? null;
}

/** Every request is linked across servers, so the interconnect is always the cluster's and only its network varies. */
export function toQuoteRequestData(
  draft: GpuQuoteDraft,
  { source, configuration }: { source: QuoteRequestSource; configuration?: QuoteRequestData["configuration"] }
): QuoteRequestData {
  return {
    category: "quote",
    email: draft.email.trim(),
    details: draft.notes.trim() || undefined,
    source,
    configuration,
    spec: {
      gpu: { model: describeGpuModel(draft) ?? "", count: draft.gpuCount, interconnect: "cluster", fabric: draft.fabric },
      region: { mode: draft.regionMode, areas: draft.regionMode === "any" ? [] : draft.areas },
      uplinkGbps: null,
      storage: { tbPerNode: toStorageTbPerServer(draft), nvme: draft.nvme },
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

/** The form asks storage per rack for rack-scale GPUs, while the api and offers count it per server of eight. */
function toStorageTbPerServer(draft: Pick<GpuQuoteDraft, "storageTbPerNode" | "gpuModel">): number {
  const serversPerUnit = unitOfGpu(draft.gpuModel).gpuCount / GPUS_PER_NODE;
  return Math.round((draft.storageTbPerNode / serversPerUnit) * 100) / 100;
}

export function describeGpus(draft: Pick<GpuQuoteDraft, "gpuModel" | "otherGpuModel" | "gpuCount">): string | null {
  const model = describeGpuModel(draft);
  if (!model) return null;

  const { unit, count } = countUnits(draft);
  const gpu = findCatalogGpu(draft.gpuModel);
  return `${pluralize(count, unit.name)} × ${unit.gpuCount} ${gpu ? `${gpu.vendor} ${gpu.label}` : model}`;
}

export function describeGpuTotal(gpuCount: number): string {
  return `${pluralize(gpuCount, "GPU")} total`;
}

export function describeNetwork({ gpuModel, fabric }: Pick<GpuQuoteDraft, "gpuModel" | "fabric">): string {
  const serverLink = findCatalogGpu(gpuModel)?.serverLink;
  return serverLink ? `${serverLink} + ${FABRIC_NAMES[fabric]}` : FABRIC_NAMES[fabric];
}

export function describeRegion(draft: Pick<GpuQuoteDraft, "regionMode" | "areas">): string | null {
  if (draft.regionMode === "any") return "Anywhere";
  if (draft.areas.length === 0) return null;

  const areaNames = REGION_AREAS.filter(area => draft.areas.includes(area.value))
    .map(area => area.label)
    .join(", ");
  return draft.regionMode === "only" ? areaNames : `Anywhere except ${areaNames}`;
}

export function describeStorage(draft: Pick<GpuQuoteDraft, "storageTbPerNode" | "nvme" | "gpuModel">): string {
  if (draft.storageTbPerNode <= 0) return "None";
  return `${draft.storageTbPerNode} TB${draft.nvme ? " NVMe" : ""} per ${unitOfGpu(draft.gpuModel).name}`;
}

export function describeStorageTotal(draft: Pick<GpuQuoteDraft, "storageTbPerNode" | "gpuModel" | "gpuCount">): string | null {
  if (draft.storageTbPerNode <= 0) return null;
  return `${(draft.storageTbPerNode * countUnits(draft).count).toLocaleString("en-US")} TB total`;
}

export function describeSla(sla: UptimeSla | null): string {
  return sla ? `${sla}% uptime` : "No requirement";
}

export function describeTerm(term: RequestTerm): string | null {
  return TERMS.find(option => option.value === term)?.label ?? null;
}

export function describeStart(draft: Pick<GpuQuoteDraft, "start" | "startDate">): string | null {
  if (draft.start !== "date") return STARTS.find(option => option.value === draft.start)!.label;
  return draft.startDate ? formatDate(draft.startDate, { month: "short", day: "numeric", year: "numeric" }) : null;
}

export function describeContact(draft: Pick<GpuQuoteDraft, "email" | "phone">): string | null {
  return [draft.email.trim(), draft.phone.trim()].filter(Boolean).join(" · ") || null;
}

/** A spec the starting point leaves open shows a dash, because a later step asks it. */
export function describeStartingPointCard({ answers }: StartingPoint): StartingPointCard {
  const gpu = findCatalogGpu(answers.gpuModel);
  const unit = unitOfGpu(answers.gpuModel);

  return {
    gpuCount: answers.gpuCount,
    model: describeCardModel(answers, gpu),
    memory: gpu ? `${gpu.brand ?? gpu.vendor} · ${gpu.memory}` : null,
    specs: [
      {
        label: unit.name === "rack" ? "Racks" : "Nodes",
        value: answers.gpuCount === undefined ? UNANSWERED_SPEC : `${Math.ceil(answers.gpuCount / unit.gpuCount)} × ${pluralize(unit.gpuCount, "GPU")}`
      },
      {
        label: "Network",
        value: answers.fabric === undefined ? UNANSWERED_SPEC : describeNetwork({ gpuModel: answers.gpuModel ?? null, fabric: answers.fabric })
      },
      { label: "Storage", value: answers.storageTbPerNode === undefined ? UNANSWERED_SPEC : `${answers.storageTbPerNode} TB / ${unit.name}` }
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

export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function formatDate(isoDate: string, format: Intl.DateTimeFormatOptions): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US", format);
}

export function toIsoDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function describeReplyTime(dueAt: Date, now: Date): string {
  const time = dueAt.toLocaleTimeString("en-US", dueAt.getMinutes() === 0 ? { hour: "numeric" } : { hour: "numeric", minute: "2-digit" });
  const daysAway = differenceInCalendarDays(dueAt, now);

  if (daysAway === 0) return `${time} today`;
  if (daysAway === 1) return `${time} tomorrow`;
  return `${dueAt.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
}

function describeCardModel(answers: DraftAnswers, gpu: CatalogGpu | undefined): string {
  if (gpu) return gpu.shortLabel ?? gpu.label;
  return describeGpuModel({ gpuModel: answers.gpuModel ?? null, otherGpuModel: answers.otherGpuModel ?? "" }) ?? "Any GPU";
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
