import type { Counter, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core/services/metrics/metrics.service";
import type { WorkloadVerdict } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";

export type DomainBlockResult = "blocked" | "raced" | "skipped" | "dry_run" | "failed" | "sibling_limit_reached";

export type EvidenceWriteOperation = "insert" | "purge";

@singleton()
export class WorkloadAbuseInstrumentationService {
  private readonly meter: Meter;
  private readonly probes: Counter;
  private readonly detections: Counter;
  private readonly enforcements: Counter;
  private readonly blockedDomainLookupFailures: Counter;
  private readonly domainBlocks: Counter;
  private readonly evidenceWriteFailures: Counter;
  private readonly behaviouralFindings: Counter;

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
    this.blockedDomainLookupFailures = metricsService.createCounter(this.meter, "workload_abuse_blocked_domain_lookup_failures_total", {
      description: "Blocked email domain lookups that failed and were answered as not blocked, so enforcement is off for as long as this climbs"
    });
    this.domainBlocks = metricsService.createCounter(this.meter, "workload_abuse_domain_blocks_total", {
      description: "Email domain auto-block outcomes, by result and (on a skip) reason"
    });
    this.evidenceWriteFailures = metricsService.createCounter(this.meter, "workload_abuse_evidence_write_failures_total", {
      description: "Probe evidence statements that failed to persist, by operation"
    });
    this.behaviouralFindings = metricsService.createCounter(this.meter, "workload_abuse_behavioural_findings_total", {
      description: "Behavioural shape signals recorded on probe evidence, by signal"
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

  recordBlockedDomainLookupFailure(): void {
    this.blockedDomainLookupFailures.add(1);
  }

  recordDomainBlock(result: DomainBlockResult, reason?: string): void {
    this.domainBlocks.add(1, reason ? { result, reason } : { result });
  }

  recordEvidenceWriteFailure(operation: EvidenceWriteOperation): void {
    this.evidenceWriteFailures.add(1, { operation });
  }

  recordBehaviouralFinding(signal: string): void {
    this.behaviouralFindings.add(1, { signal });
  }
}
