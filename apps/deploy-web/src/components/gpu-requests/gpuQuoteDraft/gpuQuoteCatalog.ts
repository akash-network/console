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
export type FabricGbps = NonNullable<QuoteSpec["gpu"]["fabricGbps"]>;
export type UplinkGbps = 1 | 10 | 25;
export type UptimeSla = NonNullable<QuoteSpec["sla"]>;
export type RequestTerm = QuoteSpec["term"];
export type StartKind = QuoteSpec["start"]["kind"];

export const GPUS_PER_NODE = 8;
export const OTHER_GPU_MODEL = "other";
export const MAX_USD_PER_GPU_HOUR = 1000;
export const MAX_STORAGE_TB_PER_NODE = 1000;

export type CatalogGpu = { id: string; label: string; vendor: "NVIDIA" | "AMD"; memory: string; group: string };

export const GPU_CATALOG: CatalogGpu[] = [
  { id: "b300", label: "B300", vendor: "NVIDIA", memory: "288 GB", group: "NVIDIA data center" },
  { id: "b200", label: "B200", vendor: "NVIDIA", memory: "180 GB", group: "NVIDIA data center" },
  { id: "h200", label: "H200", vendor: "NVIDIA", memory: "141 GB", group: "NVIDIA data center" },
  { id: "h100", label: "H100", vendor: "NVIDIA", memory: "80 GB", group: "NVIDIA data center" },
  { id: "a100", label: "A100", vendor: "NVIDIA", memory: "80 GB", group: "NVIDIA data center" },
  { id: "l40s", label: "L40S", vendor: "NVIDIA", memory: "48 GB", group: "NVIDIA data center" },
  { id: "pro6000", label: "RTX PRO 6000", vendor: "NVIDIA", memory: "96 GB", group: "NVIDIA workstation" },
  { id: "rtx5090", label: "RTX 5090", vendor: "NVIDIA", memory: "32 GB", group: "NVIDIA workstation" },
  { id: "rtx4090", label: "RTX 4090", vendor: "NVIDIA", memory: "24 GB", group: "NVIDIA workstation" },
  { id: "mi355x", label: "MI355X", vendor: "AMD", memory: "288 GB", group: "AMD Instinct" },
  { id: "mi325x", label: "MI325X", vendor: "AMD", memory: "256 GB", group: "AMD Instinct" },
  { id: "mi300x", label: "MI300X", vendor: "AMD", memory: "192 GB", group: "AMD Instinct" }
];

export const SMALL_GPU_COUNTS = [1, 2, 4];

export const FABRICS: { value: Fabric; label: string }[] = [
  { value: "any", label: "No preference" },
  { value: "infiniband", label: "InfiniBand" },
  { value: "roce", label: "RoCE (Ethernet)" }
];

export const FABRIC_SPEEDS: FabricGbps[] = [200, 400, 800];

export const REGION_AREAS: { value: RegionArea; label: string }[] = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "eu", label: "Europe" },
  { value: "uk", label: "United Kingdom" },
  { value: "apac", label: "Asia Pacific" },
  { value: "me", label: "Middle East" },
  { value: "latam", label: "Latin America" }
];

export const REGION_MODES: { value: RegionMode; label: string }[] = [
  { value: "any", label: "Anywhere" },
  { value: "only", label: "Only in…" },
  { value: "except", label: "Anywhere except…" }
];

export const UPLINKS: { value: UplinkGbps | null; label: string }[] = [
  { value: null, label: "No preference" },
  { value: 1, label: "1 Gbps" },
  { value: 10, label: "10 Gbps" },
  { value: 25, label: "25 Gbps or more" }
];

export const UPTIME_SLAS: { value: UptimeSla | null; label: string; detail: string }[] = [
  { value: null, label: "No requirement", detail: "Best effort" },
  { value: "99", label: "99%", detail: "Up to 7.3 h down a month" },
  { value: "99.5", label: "99.5%", detail: "Up to 3.7 h down a month" },
  { value: "99.9", label: "99.9%", detail: "Up to 44 min down a month. Few providers offer it." }
];

export const TERMS: { value: RequestTerm; label: string }[] = [
  { value: "month_to_month", label: "Month to month" },
  { value: "3_months", label: "3 months" },
  { value: "6_months", label: "6 months" },
  { value: "12_months", label: "1 year" },
  { value: "24_months", label: "2 years or more" }
];

export const STARTS: { value: StartKind; label: string }[] = [
  { value: "asap", label: "As soon as possible" },
  { value: "date", label: "On a date" },
  { value: "flexible", label: "Flexible" }
];
