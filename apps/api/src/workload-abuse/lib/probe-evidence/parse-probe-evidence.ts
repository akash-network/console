import type { ProbeEvidenceAccelerator, ProbeEvidenceArtifact, ProbeEvidenceNetShape, ProbeEvidenceProcessOrigin } from "@src/workload-abuse/model-schemas";

export type ProbeEvidenceFeatures = {
  accelerator: ProbeEvidenceAccelerator[] | null;
  artifacts: ProbeEvidenceArtifact[] | null;
  processOrigins: ProbeEvidenceProcessOrigin[] | null;
  netShape: ProbeEvidenceNetShape | null;
};

/** The kernel numbers a live socket 01 and a half open one 02, and the collector reports both. */
const ESTABLISHED_SOCKET_STATE = "01";

const SECTION_MARKERS = ["--accel", "--netl", "--disk", "--procorig"] as const;

export function parseProbeEvidence(evidenceOutput: string): ProbeEvidenceFeatures {
  const sections = splitSections(evidenceOutput);

  return {
    accelerator: parseAccelerator(sections.get("--accel")),
    artifacts: parseArtifacts(sections.get("--disk")),
    processOrigins: parseProcessOrigins(sections.get("--procorig")),
    netShape: parseNetShape(sections.get("--netl"))
  };
}

function splitSections(output: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentLines: string[] | null = null;

  for (const line of output.split("\n")) {
    if ((SECTION_MARKERS as readonly string[]).includes(line)) {
      currentLines = sections.get(line) ?? [];
      sections.set(line, currentLines);
      continue;
    }
    currentLines?.push(line);
  }

  return sections;
}

type AcceleratorOnGpu = Omit<ProbeEvidenceAccelerator, "processes"> & { gpuUuid: string };

/** Both accelerator queries report the gpu uuid, so a process lands on the card it actually ran on rather than on every card in the host. */
function parseAccelerator(lines: string[] | undefined): ProbeEvidenceAccelerator[] | null {
  if (!lines) return null;
  if (lines.some(line => line.trim() === "accel: unavailable")) return null;

  const accelerators: AcceleratorOnGpu[] = [];
  const processesByGpu = new Map<string, ProbeEvidenceAccelerator["processes"]>();

  for (const line of lines) {
    const fields = line.split(",").map(field => field.trim());
    if (fields.length >= 5 && !isNumeric(fields[1]) && isNumeric(fields[2]) && isNumeric(fields[3]) && isNumeric(fields[4])) {
      accelerators.push({
        gpuUuid: fields[0],
        name: fields[1],
        utilPct: Number(fields[2]),
        memUsedMb: Number(fields[3]),
        memTotalMb: Number(fields[4])
      });
    } else if (fields.length >= 4 && isNumeric(fields[1])) {
      const processes = processesByGpu.get(fields[0]) ?? [];
      processes.push({
        pid: Number(fields[1]),
        name: fields.slice(2, -1).join(", "),
        vramMb: toNumberOrZero(fields[fields.length - 1])
      });
      processesByGpu.set(fields[0], processes);
    }
  }

  return accelerators.map(accelerator => ({
    name: accelerator.name,
    utilPct: accelerator.utilPct,
    memUsedMb: accelerator.memUsedMb,
    memTotalMb: accelerator.memTotalMb,
    processes: processesByGpu.get(accelerator.gpuUuid) ?? []
  }));
}

function parseArtifacts(lines: string[] | undefined): ProbeEvidenceArtifact[] | null {
  if (!lines) return null;

  const artifacts: ProbeEvidenceArtifact[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d+) (.+)$/);
    if (match) artifacts.push({ sizeBytes: Number(match[1]), path: match[2] });
  }

  return artifacts;
}

function parseProcessOrigins(lines: string[] | undefined): ProbeEvidenceProcessOrigin[] | null {
  if (!lines) return null;

  let bootTimeSeconds: number | null = null;
  const origins: ProbeEvidenceProcessOrigin[] = [];

  for (const line of lines) {
    const bootTimeMatch = line.match(/^btime=(\d+)$/);
    if (bootTimeMatch) {
      bootTimeSeconds = Number(bootTimeMatch[1]);
      continue;
    }
    const match = line.match(/^(\d+) ppid=(\d+) starttime=(\d+) comm=(.*)$/);
    if (!match) continue;
    const starttimeTicks = Number(match[3]);
    origins.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      comm: match[4],
      startedAtEpochMs: bootTimeSeconds === null ? 0 : Math.round((bootTimeSeconds + starttimeTicks / 100) * 1000)
    });
  }

  return origins;
}

function parseNetShape(netlLines: string[] | undefined): ProbeEvidenceNetShape | null {
  if (!netlLines) return null;

  const listenPorts = new Set<number>();
  for (const line of netlLines) {
    const match = line.trim().match(/^\d+\s+listen=(\d+)$/);
    if (match) listenPorts.add(Number(match[1]));
  }

  const connectionsByKey = new Map<string, ProbeEvidenceNetShape["connections"][number]>();
  for (const line of netlLines) {
    const match = line.trim().match(/^(\d+)\s+([0-9A-Fa-f]+)\s+([0-9A-Fa-f]+):([0-9A-Fa-f]+)\s+(\d+)$/);
    if (!match) continue;
    const localPort = parseInt(match[2], 16);
    const remoteIp = decodeHexIp(match[3]);
    const remotePort = parseInt(match[4], 16);
    if (!remoteIp) continue;
    const state = match[5] === ESTABLISHED_SOCKET_STATE ? "established" : "connecting";
    const key = `${localPort}|${remoteIp}|${remotePort}|${state}`;
    const existing = connectionsByKey.get(key);
    if (existing) existing.count += Number(match[1]);
    else connectionsByKey.set(key, { localPort, remoteIp, remotePort, count: Number(match[1]), state });
  }

  return {
    listenPorts: [...listenPorts].sort((a, b) => a - b),
    connections: [...connectionsByKey.values()]
  };
}

function decodeHexIp(hex: string): string | null {
  if (hex.length === 8) {
    return `${parseInt(hex.slice(6, 8), 16)}.${parseInt(hex.slice(4, 6), 16)}.${parseInt(hex.slice(2, 4), 16)}.${parseInt(hex.slice(0, 2), 16)}`;
  }
  if (hex.length === 32) {
    const lowered = hex.toLowerCase();
    if (lowered.startsWith("0000000000000000ffff0000")) return decodeHexIp(lowered.slice(24));
    return formatIpv6(lowered);
  }
  return null;
}

function formatIpv6(hex: string): string {
  const hextets: string[] = [];
  for (let index = 0; index < 32; index += 8) {
    const group = hex.slice(index, index + 8);
    hextets.push(`${group.slice(6, 8)}${group.slice(4, 6)}`, `${group.slice(2, 4)}${group.slice(0, 2)}`);
  }
  return hextets.join(":").toLowerCase();
}

function toNumberOrZero(value: string): number {
  return isNumeric(value) ? Number(value) : 0;
}

function isNumeric(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value);
}
