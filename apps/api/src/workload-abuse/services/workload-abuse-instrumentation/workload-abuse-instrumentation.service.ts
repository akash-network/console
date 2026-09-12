import type { Counter, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core/services/metrics/metrics.service";
import type { WorkloadVerdict } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";

export type DomainBlockResult = "blocked" | "skipped" | "dry_run" | "failed" | "sibling_limit_reached";

@singleton()
export class WorkloadAbuseInstrumentationService {
  private readonly meter: Meter;
  private readonly probes: Counter;
  private readonly detections: Counter;
  private readonly enforcements: Counter;
  private readonly domainBlocks: Counter;

  constructor(metricsService: MetricsService) {
    this.meter = metricsService.getMeter("workload-abuse", "1.0.0");
    this.probes = metricsService.createCounter(this.meter, "workload_abuse_probes_total", {
      description: "Trial workload probes by verdict and probe status"
    });
    this.detections = metricsService.createCounter(this.meter, "workload_abuse_detections_total", {
      description: "Trial workload detections recorded, by verdict"
    });
    this.enforcements = metricsService.createCounter(this.meter, "workload_abuse_enforcements_total", {
      description: "Trial abuse enforcement runs, by result"
    });
    this.domainBlocks = metricsService.createCounter(this.meter, "workload_abuse_domain_blocks_total", {
      description: "Email domain auto-block outcomes, by result and (on a skip) reason"
    });
  }

  recordProbe(input: { verdict: WorkloadVerdict; probeStatus: string }): void {
    this.probes.add(1, { verdict: input.verdict, probe_status: input.probeStatus });
  }

  recordDetection(verdict: WorkloadVerdict): void {
    this.detections.add(1, { verdict });
  }

  recordEnforcement(result: "enforced" | "failed" | "skipped"): void {
    this.enforcements.add(1, { result });
  }

  recordDomainBlock(result: DomainBlockResult, reason?: string): void {
    this.domainBlocks.add(1, reason ? { result, reason } : { result });
  }
}
