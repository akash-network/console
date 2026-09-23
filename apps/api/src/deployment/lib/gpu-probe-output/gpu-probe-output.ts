import type { DetectedGpuRecord, GpuProbeSource } from "@src/deployment/model-schemas";

export type GpuProbeReading = {
  source: GpuProbeSource;
  driverVersion: string | null;
  gpus: DetectedGpuRecord[];
};

export const NVIDIA_SECTION = "--nvidia";
export const AMD_SECTION = "--amd";
export const NO_GPU_TOOL_LINE = "gpu: unavailable";

const SECTION_MARKERS = [NVIDIA_SECTION, AMD_SECTION] as const;

/** `nvidia-smi` answers a field it cannot read with a bracketed placeholder rather than leaving it empty. */
const UNAVAILABLE_FIELD = /^\[.*\]$/;

const BYTES_PER_MIB = 1024 * 1024;

/** Reads one probe's output, or null when it carried no section at all, which is a session that was cut short rather than a host without a gpu. */
export function parseGpuProbeOutput(output: string): GpuProbeReading | null {
  const sections = splitSections(output);

  const nvidia = sections.get(NVIDIA_SECTION);
  if (nvidia) return { source: "nvidia-smi", ...parseNvidia(nvidia) };

  const amd = sections.get(AMD_SECTION);
  if (amd) return { source: "rocm-smi", ...parseAmd(amd) };

  if (output.split("\n").some(line => line.trim() === NO_GPU_TOOL_LINE)) {
    return { source: "none", driverVersion: null, gpus: [] };
  }

  return null;
}

/** The pods of one service can land on different hosts, so each is read on its own and their cards add up into the service's reading. */
export function mergeGpuProbeReadings(readings: GpuProbeReading[]): GpuProbeReading | null {
  const [first] = readings;
  if (!first) return null;

  const gpus: DetectedGpuRecord[] = [];
  for (const card of readings.flatMap(reading => reading.gpus)) fold(gpus, { ...card });

  return { source: first.source, driverVersion: first.driverVersion, gpus };
}

function splitSections(output: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;

  for (const line of output.split("\n")) {
    const marker = SECTION_MARKERS.find(section => line.trim() === section);
    if (marker) {
      current = sections.get(marker) ?? [];
      sections.set(marker, current);
      continue;
    }
    current?.push(line);
  }

  return sections;
}

/** Fields are read from the end so a model name carrying a comma stays whole, the way the accelerator evidence parser reads its own rows. */
function parseNvidia(lines: string[]): Omit<GpuProbeReading, "source"> {
  const cards: DetectedGpuRecord[] = [];
  let driverVersion: string | null = null;

  for (const line of lines) {
    const fields = line.split(",").map(field => field.trim());
    if (fields.length < 4) continue;

    const rawName = fields.slice(0, -3).join(", ");
    if (!rawName) continue;

    driverVersion ??= toTextOrNull(fields[fields.length - 2]);
    fold(cards, {
      rawName,
      pciDeviceId: toTextOrNull(fields[fields.length - 1]),
      memoryMb: toNumberOrZero(fields[fields.length - 3]),
      count: 1
    });
  }

  return { driverVersion, gpus: cards };
}

/** `rocm-smi --csv` names its columns rather than fixing their order, so each one is found by heading and a heading we cannot find simply yields nothing. */
function parseAmd(lines: string[]): Omit<GpuProbeReading, "source"> {
  const rows = lines.map(line => line.split(",").map(field => field.trim())).filter(fields => fields.length > 1);
  const heading = rows.shift();
  if (!heading) return { driverVersion: null, gpus: [] };

  const nameAt = findColumn(heading, /card series|card model|product name/i);
  const memoryAt = findColumn(heading, /vram total memory/i);
  const deviceIdAt = findColumn(heading, /device id/i);
  if (nameAt === -1) return { driverVersion: null, gpus: [] };

  const cards: DetectedGpuRecord[] = [];
  for (const fields of rows) {
    const rawName = fields[nameAt];
    if (!rawName) continue;

    fold(cards, {
      rawName,
      pciDeviceId: deviceIdAt === -1 ? null : toTextOrNull(fields[deviceIdAt]),
      memoryMb: memoryAt === -1 ? 0 : Math.round(toNumberOrZero(fields[memoryAt]) / BYTES_PER_MIB),
      count: 1
    });
  }

  return { driverVersion: null, gpus: cards };
}

function findColumn(heading: string[], matcher: RegExp): number {
  return heading.findIndex(column => matcher.test(column));
}

/** Identical cards are one entry carrying how many there are, because a host reports each of its eight h100s on its own line. */
function fold(cards: DetectedGpuRecord[], card: DetectedGpuRecord): void {
  const existing = cards.find(seen => seen.rawName === card.rawName && seen.pciDeviceId === card.pciDeviceId && seen.memoryMb === card.memoryMb);
  if (existing) {
    existing.count += card.count;
    return;
  }

  cards.push(card);
}

function toTextOrNull(field: string | undefined): string | null {
  if (!field || UNAVAILABLE_FIELD.test(field)) return null;
  return field;
}

function toNumberOrZero(field: string | undefined): number {
  const value = Number(field);
  return Number.isFinite(value) ? value : 0;
}
