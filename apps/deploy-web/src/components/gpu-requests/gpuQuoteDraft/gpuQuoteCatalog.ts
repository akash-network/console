import type { paths } from "@akashnetwork/console-api-types";

type CreateHardwareRequestData = paths["/v1/hardware-requests"]["post"]["requestBody"]["content"]["application/json"]["data"];
export type QuoteRequestData = Extract<CreateHardwareRequestData, { category: "quote" }>;
export type QuoteRequestReceipt = paths["/v1/hardware-requests"]["post"]["responses"][201]["content"]["application/json"]["data"];
export type QuoteSpec = QuoteRequestData["spec"];
export type QuoteRequestSource = NonNullable<QuoteRequestData["source"]>;
export type RegionArea = QuoteSpec["region"]["areas"][number];
export type RegionMode = QuoteSpec["region"]["mode"];
export type Interconnect = QuoteSpec["gpu"]["interconnect"];
export type Fabric = NonNullable<QuoteSpec["gpu"]["fabric"]>;
export type UptimeSla = NonNullable<QuoteSpec["sla"]>;
export type RequestTerm = QuoteSpec["term"];
export type StartKind = QuoteSpec["start"]["kind"];

export const GPUS_PER_NODE = 8;
export const OTHER_GPU_MODEL = "other";
/** Mirrors the api's cap on the GPUs one request can ask for. */
export const MAX_GPU_COUNT = 1000;
export const MAX_STORAGE_TB_PER_NODE = 1000;
export const RECOMMENDED_STORAGE_TB_PER_NODE = 10;

export type GpuVendor = "NVIDIA" | "AMD";

export type ServerLink = "NVLink" | "Infinity Fabric";

export type GpuUnit = { name: "node" | "rack"; gpuCount: number };

export type CatalogGpu = {
  id: string;
  label: string;
  shortLabel?: string;
  brand?: string;
  vendor: GpuVendor;
  memory: string;
  memoryType: string;
  group: string;
  serverLink: ServerLink | null;
  rack?: { name: string; gpuCount: number };
};

export const GPU_CATALOG: CatalogGpu[] = [
  {
    id: "gb300",
    label: "GB300",
    vendor: "NVIDIA",
    memory: "288 GB",
    memoryType: "HBM3e",
    group: "NVIDIA data center",
    serverLink: "NVLink",
    rack: { name: "NVL72", gpuCount: 72 }
  },
  { id: "b300", label: "B300", vendor: "NVIDIA", memory: "288 GB", memoryType: "HBM3e", group: "NVIDIA data center", serverLink: "NVLink" },
  { id: "b200", label: "B200", vendor: "NVIDIA", memory: "180 GB", memoryType: "HBM3e", group: "NVIDIA data center", serverLink: "NVLink" },
  { id: "h200", label: "H200", vendor: "NVIDIA", memory: "141 GB", memoryType: "HBM3e", group: "NVIDIA data center", serverLink: "NVLink" },
  { id: "h100", label: "H100", vendor: "NVIDIA", memory: "80 GB", memoryType: "HBM3", group: "NVIDIA data center", serverLink: "NVLink" },
  { id: "a100", label: "A100", vendor: "NVIDIA", memory: "80 GB", memoryType: "HBM2e", group: "NVIDIA data center", serverLink: "NVLink" },
  {
    id: "pro6000",
    label: "RTX PRO 6000 Server Edition",
    shortLabel: "PRO 6000",
    brand: "NVIDIA RTX",
    vendor: "NVIDIA",
    memory: "96 GB",
    memoryType: "GDDR7",
    group: "NVIDIA data center",
    serverLink: null
  },
  { id: "rtx5090", label: "RTX 5090", vendor: "NVIDIA", memory: "32 GB", memoryType: "GDDR7", group: "NVIDIA workstation", serverLink: null },
  { id: "rtx4090", label: "RTX 4090", vendor: "NVIDIA", memory: "24 GB", memoryType: "GDDR6X", group: "NVIDIA workstation", serverLink: null },
  { id: "mi355x", label: "MI355X", vendor: "AMD", memory: "288 GB", memoryType: "HBM3e", group: "AMD Instinct", serverLink: "Infinity Fabric" },
  { id: "mi325x", label: "MI325X", vendor: "AMD", memory: "256 GB", memoryType: "HBM3e", group: "AMD Instinct", serverLink: "Infinity Fabric" },
  { id: "mi300x", label: "MI300X", vendor: "AMD", memory: "192 GB", memoryType: "HBM3", group: "AMD Instinct", serverLink: "Infinity Fabric" }
];

export const UNIT_COUNTS: Record<GpuUnit["name"], number[]> = { node: [1, 2, 4, 8, 16, 32], rack: [1, 2, 4, 8] };

export const STORAGE_SIZES_TB = [1, 4, 10, 30, 100];

export const FABRICS: { value: Fabric; label: string; spec?: string; detail?: string }[] = [
  { value: "infiniband", label: "InfiniBand", spec: "GPUDirect RDMA" },
  { value: "roce", label: "RoCE (Ethernet)", spec: "RDMA over Converged Ethernet" },
  { value: "any", label: "No preference", detail: "Offers can use either network." }
];

export const REGION_AREAS: { value: RegionArea; label: string; code: string }[] = [
  { value: "us", label: "United States", code: "US" },
  { value: "ca", label: "Canada", code: "CA" },
  { value: "eu", label: "Europe", code: "EU" },
  { value: "uk", label: "United Kingdom", code: "UK" },
  { value: "apac", label: "Asia Pacific", code: "APAC" },
  { value: "me", label: "Middle East", code: "ME" },
  { value: "latam", label: "Latin America", code: "LATAM" }
];

export const REGION_MODES: { value: RegionMode; label: string }[] = [
  { value: "any", label: "Anywhere" },
  { value: "only", label: "Only in…" },
  { value: "except", label: "Anywhere except…" }
];

export const UPTIME_SLAS: { value: UptimeSla | null; label: string; detail: string; isRare?: boolean }[] = [
  { value: null, label: "No requirement", detail: "Best effort" },
  { value: "99", label: "99%", detail: "Up to 7.3 h down a month" },
  { value: "99.5", label: "99.5%", detail: "Up to 3.7 h down a month" },
  { value: "99.9", label: "99.9%", detail: "Up to 44 min down a month", isRare: true }
];

export const TERMS: { value: RequestTerm; label: string; shortLabel: string }[] = [
  { value: "month_to_month", label: "Month to month", shortLabel: "M2M" },
  { value: "3_months", label: "3 months", shortLabel: "3 mo" },
  { value: "6_months", label: "6 months", shortLabel: "6 mo" },
  { value: "12_months", label: "1 year", shortLabel: "1 yr" },
  { value: "24_months", label: "2 years or more", shortLabel: "2 yr+" }
];

/** Requests and offers made before the 3-month term was dropped still carry it, so only the form leaves it out of `TERMS`. */
export const REQUESTABLE_TERMS = TERMS.filter(term => term.value !== "3_months");

export const STARTS: { value: StartKind; label: string; shortLabel: string }[] = [
  { value: "asap", label: "As soon as possible", shortLabel: "ASAP" },
  { value: "date", label: "On a date", shortLabel: "On a date" },
  { value: "flexible", label: "Flexible", shortLabel: "Flexible" }
];

export function findCatalogGpu(gpuModel: string | null | undefined): CatalogGpu | undefined {
  return GPU_CATALOG.find(gpu => gpu.id === gpuModel);
}

/** A rack-scale GPU is only sold as whole racks; every other model comes in servers of eight. */
export function unitOfGpu(gpuModel: string | null | undefined): GpuUnit {
  const rack = findCatalogGpu(gpuModel)?.rack;
  return rack ? { name: "rack", gpuCount: rack.gpuCount } : { name: "node", gpuCount: GPUS_PER_NODE };
}
