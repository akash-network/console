import type { Histogram } from "@opentelemetry/api";
import { singleton } from "tsyringe";

import { MetricsService } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";

/** One observation per user touched rather than one per request, so a request serving two users stays distinguishable from the one-user-two-secrets regression this exists to catch. */
@singleton()
export class DataKeyUnwrapInstrumentationService {
  private readonly unwrapsPerRequest: Histogram;

  constructor(
    metricsService: MetricsService,
    private readonly executionContextService: ExecutionContextService
  ) {
    const meter = metricsService.getMeter("data-key-unwrap");

    this.unwrapsPerRequest = metricsService.createHistogram(meter, "user_data_key_unwraps_per_request", {
      description: "Key service unwraps one request spent on one user's data key, expected to stay at one however many secrets the deployment carries"
    });

    this.executionContextService.onContextEnd(() => this.recordUnwrapsThisRequest());
  }

  /** A user whose key was held but never unwrapped is worth an observation of zero, because the cheap path is the one a regression stops taking. */
  beginCountingUnwraps(userId: string): void {
    const counts = this.countsThisRequest();

    if (counts && !counts.has(userId)) {
      counts.set(userId, 0);
    }
  }

  countUnwrap(userId: string): void {
    const counts = this.countsThisRequest();

    counts?.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  private recordUnwrapsThisRequest() {
    const counts = this.currentCounts();

    if (!counts) return;

    for (const count of counts.values()) {
      this.unwrapsPerRequest.record(count);
    }
  }

  private currentCounts() {
    return this.executionContextService.hasContext() ? this.executionContextService.get("DATA_KEY_UNWRAP_COUNTS") : undefined;
  }

  /** Counting outside a request measures nothing rather than throwing, because an unwrap must not fail over its own measurement. */
  private countsThisRequest() {
    if (!this.executionContextService.hasContext()) return undefined;

    const counts = this.currentCounts();

    if (counts) return counts;

    const countsThisRequest = new Map<string, number>();
    this.executionContextService.set("DATA_KEY_UNWRAP_COUNTS", countsThisRequest);

    return countsThisRequest;
  }
}
