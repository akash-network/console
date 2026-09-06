import type { Counter, Meter } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core/services/metrics/metrics.service";
import type { WorkloadVerdict } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";

@singleton()
export class WorkloadAbuseInstrumentationService {
  private readonly meter: Meter;
  private readonly probes: Counter;
  private readonly detections: Counter;

  constructor(metricsService: MetricsService) {
    this.meter = metricsService.getMeter("workload-abuse", "1.0.0");
    this.probes = metricsService.createCounter(this.meter, "workload_abuse_probes_total", {
      description: "Trial workload probes by verdict and probe status"
    });
    this.detections = metricsService.createCounter(this.meter, "workload_abuse_detections_total", {
      description: "Trial workload detections recorded, by verdict"
    });
  }

  recordProbe(input: { verdict: WorkloadVerdict; probeStatus: string }): void {
    this.probes.add(1, { verdict: input.verdict, probe_status: input.probeStatus });
  }

  recordDetection(verdict: WorkloadVerdict): void {
    this.detections.add(1, { verdict });
  }
}
