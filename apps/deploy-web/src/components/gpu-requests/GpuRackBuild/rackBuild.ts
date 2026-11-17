import type { RequestTerm } from "../gpuQuoteDraft/gpuQuoteCatalog";
import { findCatalogGpu, REGION_AREAS, STARTS, TERMS, unitOfGpu } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { GpuQuoteDraft, QuoteStepId } from "../gpuQuoteDraft/gpuQuoteDraft";
import { countUnits, describeGpuModel, formatDate } from "../gpuQuoteDraft/gpuQuoteDraft";
import { RACK_UNITS } from "./rackGeometry";

export type RackPart = "rack" | "servers" | "network" | "storage" | "floor" | "power" | "calendar";

/** An 8U HGX server, a 4U PCIe server, or a rack-scale NVL72 system. */
export type RackKind = "8u" | "4u" | "nvl";

export type RackSlotType = "server" | "compute" | "switch" | "power";

/** What sits on the rails, counted in rack units up from the lowest one. */
export type RackSlot = { type: RackSlotType; bottomUnit: number; units: number };

export type RackSpan = { bottomUnit: number; units: number };

export type RackCallout = { part: Exclude<RackPart, "rack">; label: string; value: string };

export type CalendarCell = { column: number; row: number };

export type RackCalendar = { months: number; header: string; startCell: CalendarCell | null };

export type RackBuild = {
  kind: RackKind;
  slots: RackSlot[];
  blankSpans: RackSpan[];
  drives: number;
  powerStrips: number;
  hasUps: boolean;
  isPowered: boolean;
  isReview: boolean;
  isBuilt: Record<RackPart, boolean>;
  currentPart: RackPart | null;
  stepOfPart: Record<RackPart, QuoteStepId>;
  calendar: RackCalendar;
  callouts: RackCallout[];
};

const SERVER_UNITS: Record<Exclude<RackKind, "nvl">, number> = { "8u": 8, "4u": 4 };

const SERVERS_PER_RACK: Record<Exclude<RackKind, "nvl">, number> = { "8u": 4, "4u": 8 };

const MAX_DRIVES = 8;

/** NVMe drives hold 3.84 TB each, so the drawing seats one per that much storage. */
const TB_PER_DRIVE = 3.84;

/** A GB300 NVL72 rack: power shelves around 18 compute trays split by 9 NVLink switch trays, above four spare units. */
const NVL_SLOTS: RackSlot[] = (() => {
  const layout: [type: RackSlotType, units: number, count: number][] = [
    ["power", 2, 1],
    ["compute", 1, 8],
    ["switch", 1, 9],
    ["compute", 1, 10],
    ["power", 2, 1]
  ];
  const slots: RackSlot[] = [];
  let bottomUnit = 4;

  for (const [type, units, count] of layout) {
    for (let index = 0; index < count; index++) {
      slots.push({ type, bottomUnit, units });
      bottomUnit += units;
    }
  }

  return slots;
})();

const PART_OF_STEP: Partial<Record<QuoteStepId, RackPart>> = {
  interconnect: "network",
  storage: "storage",
  region: "floor",
  sla: "power",
  timing: "calendar"
};

const FABRIC_CALLOUTS = { infiniband: "InfiniBand", roce: "RoCE", any: "IB or RoCE" } as const;

const MAX_CALLOUT_AREAS = 2;

const TERM_MONTHS: Record<RequestTerm, number> = { month_to_month: 1, "3_months": 3, "6_months": 6, "12_months": 12, "24_months": 24 };

const CALENDAR_ROWS = 5;

/** The room fills in as questions are reached: answered hardware arrives with the starting point, everything else with its own step. */
export function describeRackBuild({
  steps,
  draft,
  reachedSteps,
  currentStep,
  today
}: {
  steps: QuoteStepId[];
  draft: GpuQuoteDraft;
  reachedSteps: ReadonlySet<QuoteStepId>;
  currentStep: QuoteStepId;
  today: string;
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
    calendar: "timing"
  };
  const hasServers = !!draft.gpuModel && hasReached(stepOfPart.servers);
  const isBuilt: Record<RackPart, boolean> = {
    rack: true,
    servers: hasServers,
    network: hasReached(stepOfPart.network),
    storage: hasServers && hasReached(stepOfPart.storage) && draft.storageTbPerNode > 0,
    floor: hasReached("region"),
    power: hasReached("sla"),
    calendar: hasReached("timing")
  };
  const kind = kindOfGpu(draft.gpuModel);
  const slots = hasServers ? slotsOf(kind, countUnits(draft).count) : [];

  return {
    kind,
    slots,
    blankSpans: slots.length > 0 ? blankSpansAround(slots, isBuilt.network) : [],
    drives: Math.min(MAX_DRIVES, Math.ceil(draft.storageTbPerNode / TB_PER_DRIVE)),
    powerStrips: draft.sla === "99.5" || draft.sla === "99.9" ? 2 : 1,
    hasUps: isBuilt.power && draft.sla === "99.9",
    isPowered: isReview || isBuilt.power,
    isReview,
    isBuilt,
    currentPart: currentPartOf(currentStep, hasServers),
    stepOfPart,
    calendar: describeCalendar(draft, today),
    callouts: describeCallouts(draft, isBuilt)
  };
}

function kindOfGpu(gpuModel: string | null): RackKind {
  if (unitOfGpu(gpuModel).name === "rack") return "nvl";
  return findCatalogGpu(gpuModel)?.serverLink === null ? "4u" : "8u";
}

/** One rack is drawn however many the request needs, so servers beyond the first rack are left out. */
function slotsOf(kind: RackKind, servers: number): RackSlot[] {
  if (kind === "nvl") return NVL_SLOTS;

  const units = SERVER_UNITS[kind];
  return Array.from({ length: Math.min(servers, SERVERS_PER_RACK[kind]) }, (_, index) => ({ type: "server", bottomUnit: index * units, units }));
}

/** Real racks close every empty unit with a blanking panel; the top unit stays free of them once the switch takes it. */
function blankSpansAround(slots: RackSlot[], hasSwitch: boolean): RackSpan[] {
  const taken = [...slots, ...(hasSwitch ? [{ bottomUnit: RACK_UNITS - 1, units: 1 }] : [])].sort((first, second) => first.bottomUnit - second.bottomUnit);
  const spans: RackSpan[] = [];
  let freeFrom = 0;

  for (const { bottomUnit, units } of taken) {
    if (bottomUnit > freeFrom) spans.push({ bottomUnit: freeFrom, units: bottomUnit - freeFrom });
    freeFrom = bottomUnit + units;
  }
  if (freeFrom < RACK_UNITS) spans.push({ bottomUnit: freeFrom, units: RACK_UNITS - freeFrom });

  return spans;
}

function currentPartOf(step: QuoteStepId, hasServers: boolean): RackPart | null {
  if (step === "start" || step === "gpu") return hasServers ? "servers" : "rack";
  return PART_OF_STEP[step] ?? null;
}

function describeCalendar(draft: GpuQuoteDraft, today: string): RackCalendar {
  const months = TERM_MONTHS[draft.term];
  return { months, header: months === 1 ? "MONTHLY" : `${months} MONTHS`, startCell: startCellOf(draft, today) };
}

/** The front page marks the start day on a Sunday-first month grid; a flexible start has no day to mark. */
function startCellOf(draft: GpuQuoteDraft, today: string): CalendarCell | null {
  if (draft.start === "flexible") return null;

  const startDay = new Date(`${draft.start === "date" && draft.startDate ? draft.startDate : today}T00:00:00`);
  const firstWeekday = new Date(startDay.getFullYear(), startDay.getMonth(), 1).getDay();
  return { column: startDay.getDay(), row: Math.min(CALENDAR_ROWS - 1, Math.floor((startDay.getDate() - 1 + firstWeekday) / 7)) };
}

/** Listed in the order the request card lists its answers, which is the order callouts that arrive together stack in. */
function describeCallouts(draft: GpuQuoteDraft, isBuilt: Record<RackPart, boolean>): RackCallout[] {
  const callouts: (RackCallout | false)[] = [
    isBuilt.servers && { part: "servers", label: "GPUs", value: `${draft.gpuCount}× ${shortGpuName(draft)}` },
    isBuilt.network && { part: "network", label: "Network", value: FABRIC_CALLOUTS[draft.fabric] },
    isBuilt.floor && { part: "floor", label: "Region", value: shortRegion(draft) },
    isBuilt.storage && { part: "storage", label: "Storage", value: `${draft.storageTbPerNode} TB/${unitOfGpu(draft.gpuModel).name}` },
    isBuilt.power && { part: "power", label: "Uptime", value: draft.sla ? `${draft.sla}%` : "No SLA" },
    isBuilt.calendar && { part: "calendar", label: "Term", value: `${TERMS.find(term => term.value === draft.term)?.shortLabel ?? "—"} · ${shortStart(draft)}` }
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
