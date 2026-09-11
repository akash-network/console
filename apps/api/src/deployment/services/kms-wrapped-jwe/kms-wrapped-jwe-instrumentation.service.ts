import type { Counter, Histogram } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";
import type { KmsWrappedJweFailure } from "./kms-wrapped-jwe.service";

/** Times the key service and counts what it served, separately: a call that answers promptly with a plaintext we cannot use is fast and failed, and a dashboard that conflated the two would read as healthy. */
@singleton()
export class KmsWrappedJweInstrumentationService {
  private readonly callDuration: Histogram;
  private readonly calls: Counter;

  constructor(metricsService: MetricsService) {
    const meter = metricsService.getMeter("kms-key-service");

    this.callDuration = metricsService.createHistogram(meter, "kms_key_service_call_duration_ms", {
      description: "Wall-clock of a single Cloud KMS asymmetricDecrypt call, so a slow deploy is attributable to the key service or to the database",
      unit: "ms"
    });

    this.calls = metricsService.createCounter(meter, "kms_key_service_calls_total", {
      description: "Key unwraps attempted against Cloud KMS, tagged by status and, on failure, by the failure that caused it"
    });
  }

  recordCallSucceeded(durationMs: number): void {
    this.callDuration.record(durationMs, { status: "success" });
  }

  recordCallFailed(durationMs: number): void {
    this.callDuration.record(durationMs, { status: "failure" });
  }

  recordUnwrapSucceeded(): void {
    this.calls.add(1, { status: "success" });
  }

  recordUnwrapFailed(failure: KmsWrappedJweFailure): void {
    this.calls.add(1, { status: "failure", failure });
  }
}
