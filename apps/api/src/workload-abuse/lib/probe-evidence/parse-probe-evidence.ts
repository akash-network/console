import type { ProbeEvidenceAccelerator, ProbeEvidenceArtifact, ProbeEvidenceNetShape, ProbeEvidenceProcessOrigin } from "@src/workload-abuse/model-schemas";

export type ProbeEvidenceFeatures = {
  accelerator: ProbeEvidenceAccelerator[] | null;
  artifacts: ProbeEvidenceArtifact[] | null;
  processOrigins: ProbeEvidenceProcessOrigin[] | null;
  netShape: ProbeEvidenceNetShape | null;
};

const SECTION_MARKERS = [
  "--loadavg",
  "--nproc",
  "--procs",
  "--net",
  "--tmp",
  "--files",
  "--authorized-keys",
  "--recent-exec",
  "--recent-conf",
  "--accel",
  "--netl",
  "--disk",
  "--procorig"
] as const;

export function parseProbeEvidence(rawShellOutput: string): ProbeEvidenceFeatures {
  const sections = splitSections(rawShellOutput);

  return {
    accelerator: parseAccelerator(sections.get("--accel")),
    artifacts: parseArtifacts(sections.get("--disk")),
    processOrigins: parseProcessOrigins(sections.get("--procorig")),
    netShape: parseNetShape(sections.get("--net"), sections.get("--netl"))
  };
}

export function withoutEvidenceSections(rawShellOutput: string): string {
  const boundary = rawShellOutput.indexOf("\n--accel\n");
  if (boundary !== -1) return rawShellOutput.slice(0, boundary + 1);
  return rawShellOutput.startsWith("--accel\n") ? "" : rawShellOutput;
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

function parseAccelerator(lines: string[] | undefined): ProbeEvidenceAccelerator[] | null {
  if (!lines) return null;
  if (lines.some(line => line.trim() === "accel: unavailable")) return null;

  const accelerators: Array<Omit<ProbeEvidenceAccelerator, "processes">> = [];
  const processes: ProbeEvidenceAccelerator["processes"] = [];

  for (const line of lines) {
    const fields = line.split(",").map(field => field.trim());
    if (fields.length >= 4 && !isNumeric(fields[0]) && isNumeric(fields[1]) && isNumeric(fields[2]) && isNumeric(fields[3])) {
      accelerators.push({
        name: fields[0],
        utilPct: Number(fields[1]),
        memUsedMb: Number(fields[2]),
        memTotalMb: Number(fields[3])
      });
    } else if (fields.length >= 3 && isNumeric(fields[0])) {
      processes.push({
        pid: Number(fields[0]),
        name: fields.slice(1, -1).join(", "),
        vramMb: toNumberOrZero(fields[fields.length - 1])
      });
    }
  }

  return accelerators.map(accelerator => ({ ...accelerator, processes }));
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

function parseNetShape(netLines: string[] | undefined, netlLines: string[] | undefined): ProbeEvidenceNetShape | null {
  if (!netlLines) return null;

  const listenPorts = new Set<number>();
  if (netLines) {
    for (const line of netLines) {
      const match = line.trim().match(/^\d+\s+listen=(\d+)$/);
      if (match) listenPorts.add(Number(match[1]));
    }
  }

  const establishedByKey = new Map<string, ProbeEvidenceNetShape["established"][number]>();
  for (const line of netlLines) {
    const match = line.trim().match(/^(\d+)\s+([0-9A-Fa-f]+)\s+([0-9A-Fa-f]+):([0-9A-Fa-f]+)\s+\d+$/);
    if (!match) continue;
    const localPort = parseInt(match[2], 16);
    const remoteIp = decodeHexIp(match[3]);
    const remotePort = parseInt(match[4], 16);
    if (!remoteIp) continue;
    const key = `${localPort}|${remoteIp}|${remotePort}`;
    const existing = establishedByKey.get(key);
    if (existing) existing.count += Number(match[1]);
    else establishedByKey.set(key, { localPort, remoteIp, remotePort, count: Number(match[1]) });
  }

  return {
    listenPorts: [...listenPorts].sort((a, b) => a - b),
    established: [...establishedByKey.values()]
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
