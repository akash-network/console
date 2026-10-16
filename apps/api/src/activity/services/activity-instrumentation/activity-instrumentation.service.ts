import type { Counter, Histogram, Meter } from "@opentelemetry/api";
import { inject, singleton } from "tsyringe";

import { activityInitiatorEnum, activityStatusEnum, activityTypeEnum, type NewActivity } from "@src/activity/model-schemas";
import { type ActivityOutput, ActivityRepository, type PendingActivitySummary } from "@src/activity/repositories/activity/activity.repository";
import { type CreateLogger, LOGGER_FACTORY, MetricsService } from "@src/core";

const OUTCOME_STATUSES = activityStatusEnum.enumValues.filter(status => status !== "pending");

type TrackedActivity = Pick<NewActivity, "type" | "status" | "initiator">;

@singleton()
export class ActivityInstrumentationService {
  readonly #opened: Counter;
  readonly #settled: Counter;
  readonly #recorded: Counter;
  readonly #settleDuration: Histogram;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(metricsService: MetricsService, activityRepository: ActivityRepository, @inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.#logger = createLogger({ context: ActivityInstrumentationService.name });
    const meter = metricsService.getMeter("activity");

    this.#opened = metricsService.createCounter(meter, "activities_opened_total", {
      description: "Activities opened in progress for an action that finishes in the background, by type and initiator"
    });
    this.#settled = metricsService.createCounter(meter, "activities_settled_total", {
      description: "Activities in progress that reached an outcome, by type, outcome status and initiator"
    });
    this.#recorded = metricsService.createCounter(meter, "activities_recorded_total", {
      description: "Activities written with their outcome already known, by type, status and initiator"
    });
    this.#settleDuration = metricsService.createHistogram(meter, "activity_settle_duration_seconds", {
      description: "Seconds from opening an activity in progress to its outcome, by type and outcome status",
      unit: "s"
    });

    this.#measure(() => this.#startCountersAtZero());
    this.#observePending(metricsService, meter, activityRepository);
  }

  trackOpened({ type, initiator }: Omit<TrackedActivity, "status">): void {
    this.#measure(() => this.#opened.add(1, { type, initiator }));
  }

  trackRecorded({ type, status, initiator }: TrackedActivity): void {
    if (status === "pending") return this.trackOpened({ type, initiator });

    this.#measure(() => this.#recorded.add(1, { type, status, initiator }));
  }

  trackSettled({ type, status, initiator, createdAt, updatedAt }: ActivityOutput): void {
    if (status === "pending") return;

    this.#measure(() => {
      this.#settled.add(1, { type, status, initiator });
      this.#settleDuration.record(secondsBetween(new Date(createdAt), new Date(updatedAt)), { type, status });
    });
  }

  /** Every label set exists from boot, so the first event after a restart still counts in a Prometheus increase(). */
  #startCountersAtZero(): void {
    for (const type of activityTypeEnum.enumValues) {
      for (const initiator of activityInitiatorEnum.enumValues) {
        this.#opened.add(0, { type, initiator });
        for (const status of OUTCOME_STATUSES) {
          this.#settled.add(0, { type, status, initiator });
          this.#recorded.add(0, { type, status, initiator });
        }
      }
    }
  }

  #observePending(metricsService: MetricsService, meter: Meter, activityRepository: ActivityRepository): void {
    const pending = metricsService.createObservableGauge(meter, "activities_pending", {
      description: "Activities in progress, by type"
    });
    const oldestPendingAge = metricsService.createObservableGauge(meter, "activities_oldest_pending_age_seconds", {
      description: "Age of the oldest activity in progress, by type, or 0 when none is",
      unit: "s"
    });

    meter.addBatchObservableCallback(
      async result => {
        const summaries = await this.#summarizePending(activityRepository);
        if (!summaries) return;

        const now = new Date();
        for (const type of activityTypeEnum.enumValues) {
          const summary = summaries.find(candidate => candidate.type === type);
          result.observe(pending, summary?.count ?? 0, { type });
          result.observe(oldestPendingAge, summary ? secondsBetween(summary.oldestCreatedAt, now) : 0, { type });
        }
      },
      [pending, oldestPendingAge]
    );
  }

  async #summarizePending(activityRepository: ActivityRepository): Promise<PendingActivitySummary[] | undefined> {
    try {
      return await activityRepository.summarizePendingByType();
    } catch (error) {
      this.#logger.warn({ event: "PENDING_ACTIVITIES_SUMMARY_FAILED", error });
    }
  }

  /** Telemetry must never fail the action it measures. */
  #measure(record: () => void): void {
    try {
      record();
    } catch (error) {
      this.#logger.warn({ event: "ACTIVITY_METRICS_FAILED", error });
    }
  }
}

function secondsBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 1000;
}
