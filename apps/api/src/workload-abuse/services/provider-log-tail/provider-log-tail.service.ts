import { singleton } from "tsyringe";

import { ProviderStreamService, type ProviderStreamStatus } from "@src/workload-abuse/services/provider-stream/provider-stream.service";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export type LogTailTarget = {
  hostUri: string;
  providerAddress: string;
  token: string;
  dseq: string;
  gseq: number;
  oseq: number;
  services: string[];
};

export type LogTailResult = { status: ProviderStreamStatus; lines: string[] };

export function buildLogTailUrl(target: LogTailTarget, tail: number): string {
  const services = target.services.length > 0 ? `&service=${encodeURIComponent(target.services.join(","))}` : "";

  return `${target.hostUri}/lease/${target.dseq}/${target.gseq}/${target.oseq}/logs?follow=false&tail=${tail}${services}`;
}

/** Providers send one JSON log entry per text frame; anything else is kept verbatim rather than dropped. */
export function formatLogFrame(payload: string): string {
  try {
    const entry = JSON.parse(payload) as { name?: unknown; message?: unknown };
    if (typeof entry.message !== "string") return payload;

    const service = typeof entry.name === "string" ? entry.name.split("-")[0] : "";

    return `[${service}]: ${entry.message}`;
  } catch {
    return payload;
  }
}

@singleton()
export class ProviderLogTailService {
  constructor(
    private readonly providerStreamService: ProviderStreamService,
    private readonly config: WorkloadAbuseConfigService
  ) {}

  async collect(target: LogTailTarget): Promise<LogTailResult> {
    const result = await this.providerStreamService.collect({
      url: buildLogTailUrl(target, this.config.get("WORKLOAD_ABUSE_PROBE_LOG_TAIL")),
      providerAddress: target.providerAddress,
      token: target.token,
      idleTimeoutMs: this.config.get("WORKLOAD_ABUSE_PROBE_IDLE_TIMEOUT_MS"),
      hardTimeoutMs: this.config.get("WORKLOAD_ABUSE_PROBE_HARD_TIMEOUT_MS"),
      maxBytes: this.config.get("WORKLOAD_ABUSE_PROBE_MAX_OUTPUT_BYTES")
    });

    return { status: result.status, lines: result.frames.map(frame => formatLogFrame(frame.payload)) };
  }
}
