import { singleton } from "tsyringe";

import { type GpuProbeReading, parseGpuProbeOutput } from "@src/deployment/lib/gpu-probe-output/gpu-probe-output";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { type CollectedFrame, ProviderStreamService, type ProviderStreamStatus } from "@src/workload-abuse/services/provider-stream/provider-stream.service";

/** Asks the card what it is and never what runs on it, because this shell opens inside a paying customer's workload. */
const GPU_COLLECTOR = [
  "if command -v nvidia-smi >/dev/null 2>&1; then",
  "echo '--nvidia';",
  "nvidia-smi --query-gpu=name,memory.total,driver_version,pci.device_id --format=csv,noheader,nounits 2>/dev/null;",
  "elif command -v rocm-smi >/dev/null 2>&1; then",
  "echo '--amd';",
  "rocm-smi --showproductname --showmeminfo vram --showid --csv 2>/dev/null;",
  "else printf 'gpu: unavailable\\n';",
  "fi"
].join(" ");

export type LeaseGpuProbeTarget = {
  hostUri: string;
  providerAddress: string;
  token: string;
  dseq: string;
  gseq: number;
  oseq: number;
  service: string;
  podIndex: number;
};

/** Only a session whose tool ran to a clean exit is a reading, because one cut short or failing lists fewer cards than the host has. */
export type LeaseGpuProbeResult = { status: "detected"; reading: GpuProbeReading } | { status: ProviderStreamStatus | "unreadable" };

export function buildLeaseGpuProbeUrl(target: LeaseGpuProbeTarget): string {
  const command = ["sh", "-c", GPU_COLLECTOR].map((part, index) => `cmd${index}=${encodeURIComponent(part)}`).join("&");

  return `${target.hostUri}/lease/${target.dseq}/${target.gseq}/${target.oseq}/shell?stdin=0&tty=0&podIndex=${target.podIndex}&${command}&service=${encodeURIComponent(target.service)}`;
}

@singleton()
export class LeaseGpuProbeService {
  constructor(
    private readonly providerStreamService: ProviderStreamService,
    private readonly config: DeploymentConfigService
  ) {}

  async probe(target: LeaseGpuProbeTarget): Promise<LeaseGpuProbeResult> {
    const result = await this.providerStreamService.collect({
      url: buildLeaseGpuProbeUrl(target),
      providerAddress: target.providerAddress,
      token: target.token,
      idleTimeoutMs: this.config.get("LEASE_GPU_DETECTION_IDLE_TIMEOUT_MS"),
      hardTimeoutMs: this.config.get("LEASE_GPU_DETECTION_HARD_TIMEOUT_MS"),
      maxBytes: this.config.get("LEASE_GPU_DETECTION_MAX_OUTPUT_BYTES")
    });

    if (result.status !== "completed") return { status: result.status };

    const reading = result.exitCode === 0 ? parseGpuProbeOutput(readShellOutput(result.frames)) : null;
    return reading ? { status: "detected", reading } : { status: "unreadable" };
  }
}

function readShellOutput(frames: CollectedFrame[]): string {
  return frames
    .filter(frame => frame.kind === "shell" && frame.stream === "stdout")
    .map(frame => frame.payload)
    .join("");
}
