import type { HardwareRequestSpec } from "@src/hardware-request/model-schemas";

const GPUS_PER_NODE = 8;

const AREA_NAMES: Record<HardwareRequestSpec["region"]["areas"][number], string> = {
  us: "United States",
  ca: "Canada",
  eu: "Europe",
  uk: "United Kingdom",
  apac: "Asia Pacific",
  me: "Middle East",
  latam: "Latin America"
};

const TERM_NAMES: Record<HardwareRequestSpec["term"], string> = {
  month_to_month: "Month to month",
  "3_months": "3 months",
  "6_months": "6 months",
  "12_months": "1 year",
  "24_months": "2 years or more"
};

const FABRIC_NAMES: Record<NonNullable<HardwareRequestSpec["gpu"]["fabric"]>, string> = {
  any: "InfiniBand or RoCE",
  infiniband: "InfiniBand",
  roce: "RoCE"
};

export function describeSpecGpus({ gpu }: HardwareRequestSpec): string {
  if (gpu.count < GPUS_PER_NODE) return `${gpu.count}× ${gpu.model}`;

  const nodes = Math.ceil(gpu.count / GPUS_PER_NODE);
  return `${gpu.count}× ${gpu.model} (${nodes} ${nodes === 1 ? "node" : "nodes"})`;
}

export function describeSpecRegion({ region }: HardwareRequestSpec): string {
  const areas = region.areas.map(area => AREA_NAMES[area]).join(", ");

  switch (region.mode) {
    case "any":
      return "Anywhere";
    case "only":
      return areas;
    case "except":
      return `Anywhere except ${areas}`;
  }
}

function describeInterconnect({ gpu }: HardwareRequestSpec): string | undefined {
  switch (gpu.interconnect) {
    case "none":
      return undefined;
    case "server":
      return "Interconnect inside each server";
    case "cluster":
      return [`${FABRIC_NAMES[gpu.fabric ?? "any"]} between servers`, gpu.fabricGbps && `${gpu.fabricGbps} Gb/s`].filter(Boolean).join(" at ");
  }
}

function describeTargetPrice({ targetPrice }: HardwareRequestSpec): string {
  const min = targetPrice?.minUsdPerGpuHour;
  const max = targetPrice?.maxUsdPerGpuHour;

  if (min && max) return `$${min.toFixed(2)}–$${max.toFixed(2)} per GPU-hour`;
  if (max) return `Up to $${max.toFixed(2)} per GPU-hour`;
  if (min) return `From $${min.toFixed(2)} per GPU-hour`;
  return "Open to offers";
}

function describeStart({ start }: HardwareRequestSpec): string {
  switch (start.kind) {
    case "asap":
      return "As soon as possible";
    case "flexible":
      return "Flexible start";
    case "date":
      return `Starting ${start.date}`;
  }
}

/** One line per answer, in the order the request form asks them. */
export function describeSpec(spec: HardwareRequestSpec): string[] {
  return [
    describeSpecGpus(spec),
    describeInterconnect(spec),
    describeSpecRegion(spec),
    spec.uplinkGbps && `Internet ${spec.uplinkGbps} Gbps`,
    spec.storage.tbPerNode > 0 && `${spec.storage.tbPerNode} TB${spec.storage.nvme ? " NVMe" : ""} storage per node`,
    spec.sla && `${spec.sla}% uptime`,
    describeTargetPrice(spec),
    `${TERM_NAMES[spec.term]}, ${describeStart(spec).toLowerCase()}`,
    spec.couldGrow && "Could grow",
    spec.wantsToTalk && "Wants to talk to someone",
    spec.company && `Company: ${spec.company}`,
    spec.phone && `Phone: ${spec.phone}`
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
}
