import type { BatchObservableResult, Counter, Histogram, Meter, ObservableGauge } from "@opentelemetry/api";
import { subMinutes } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import { activityInitiatorEnum, activityStatusEnum, activityTypeEnum } from "@src/activity/model-schemas";
import type { ActivityRepository, PendingActivitySummary } from "@src/activity/repositories/activity/activity.repository";
import type { CreateLogger, MetricsService } from "@src/core";
import type { TxService } from "@src/core/services";
import { ActivityInstrumentationService } from "./activity-instrumentation.service";

import { createActivity } from "@test/seeders/activity.seeder";

describe(ActivityInstrumentationService.name, () => {
  it("defines its counters, duration and backlog gauges on the activity meter", () => {
    const { metricsService, meter, pending, oldestPendingAge, createLogger } = setup();
    const described = { description: expect.stringMatching(/\S/) };

    expect(metricsService.getMeter).toHaveBeenCalledWith("activity");
    expect(metricsService.createCounter).toHaveBeenCalledWith(meter, "activities_opened_total", described);
    expect(metricsService.createCounter).toHaveBeenCalledWith(meter, "activities_settled_total", described);
    expect(metricsService.createCounter).toHaveBeenCalledWith(meter, "activities_recorded_total", described);
    expect(metricsService.createHistogram).toHaveBeenCalledWith(meter, "activity_settle_duration_seconds", { ...described, unit: "s" });
    expect(metricsService.createObservableGauge).toHaveBeenCalledWith(meter, "activities_pending", described);
    expect(metricsService.createObservableGauge).toHaveBeenCalledWith(meter, "activities_oldest_pending_age_seconds", { ...described, unit: "s" });
    expect(meter.addBatchObservableCallback).toHaveBeenCalledWith(expect.any(Function), [pending, oldestPendingAge]);
    expect(createLogger).toHaveBeenCalledWith({ context: ActivityInstrumentationService.name });
  });

  it("starts every counter at zero for each type, initiator and outcome", () => {
    const { opened, settled, recorded } = setup();
    const outcomes = activityStatusEnum.enumValues.filter(status => status !== "pending");
    const typesAndInitiators = activityTypeEnum.enumValues.flatMap(type => activityInitiatorEnum.enumValues.map(initiator => ({ type, initiator })));
    const withOutcomes = typesAndInitiators.flatMap(labels => outcomes.map(status => [0, { ...labels, status }]));

    expect(opened.add.mock.calls).toEqual(typesAndInitiators.map(labels => [0, labels]));
    expect(settled.add.mock.calls).toEqual(withOutcomes);
    expect(recorded.add.mock.calls).toEqual(withOutcomes);
  });

  it("boots even when a counter refuses to start at zero", () => {
    const { logger } = setup({ failingCounters: true });

    expect(logger.warn).toHaveBeenCalledWith({ event: "ACTIVITY_METRICS_FAILED", error: expect.any(Error) });
  });

  describe("trackOpened", () => {
    it("counts an activity opened in progress by type and initiator", () => {
      const { service, opened } = setup();

      service.trackOpened({ type: "deployment_close", initiator: "system" });

      expect(opened.add).toHaveBeenCalledWith(1, { type: "deployment_close", initiator: "system" });
    });

    it("never fails the action it measures", () => {
      const { service, opened, logger } = setup();
      const error = new Error("exporter down");
      opened.add.mockImplementation(() => {
        throw error;
      });

      expect(() => service.trackOpened({ type: "deployment_close", initiator: "user" })).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith({ event: "ACTIVITY_METRICS_FAILED", error });
    });
  });

  describe("trackRecorded", () => {
    it.each(["succeeded", "failed"] as const)("counts an activity recorded as %s by type, status and initiator", status => {
      const { service, recorded, opened } = setup();

      service.trackRecorded({ type: "deployment_close", status, initiator: "system" });

      expect(recorded.add).toHaveBeenCalledWith(1, { type: "deployment_close", status, initiator: "system" });
      expect(opened.add).not.toHaveBeenCalledWith(1, expect.anything());
    });

    it("counts an activity recorded in progress as opened, since it settles later", () => {
      const { service, recorded, opened } = setup();

      service.trackRecorded({ type: "deployment_close", status: "pending", initiator: "user" });

      expect(opened.add).toHaveBeenCalledWith(1, { type: "deployment_close", initiator: "user" });
      expect(recorded.add).not.toHaveBeenCalledWith(1, expect.anything());
    });

    it("never fails the action it measures", () => {
      const { service, recorded, logger } = setup();
      const error = new Error("exporter down");
      recorded.add.mockImplementation(() => {
        throw error;
      });

      expect(() => service.trackRecorded({ type: "deployment_close", status: "succeeded", initiator: "user" })).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith({ event: "ACTIVITY_METRICS_FAILED", error });
    });
  });

  describe("trackSettled", () => {
    it("counts the outcome and records how long the activity stayed in progress", () => {
      const { service, settled, settleDuration } = setup();
      const activity = createActivity({ status: "failed", initiator: "system", createdAt: "2026-10-12T10:00:00.000Z", updatedAt: "2026-10-12T10:31:30.500Z" });

      service.trackSettled(activity);

      expect(settled.add).toHaveBeenCalledWith(1, { type: "deployment_close", status: "failed", initiator: "system" });
      expect(settleDuration.record).toHaveBeenCalledWith(1890.5, { type: "deployment_close", status: "failed" });
    });

    it("counts nothing for an activity left in progress, which its open already counted", () => {
      const { service, settled, settleDuration } = setup();

      service.trackSettled(createActivity({ status: "pending" }));

      expect(settled.add).not.toHaveBeenCalledWith(1, expect.anything());
      expect(settleDuration.record).not.toHaveBeenCalled();
    });

    it("never fails the action it measures", () => {
      const { service, settleDuration, logger } = setup();
      const error = new Error("exporter down");
      settleDuration.record.mockImplementation(() => {
        throw error;
      });

      expect(() => service.trackSettled(createActivity({ status: "succeeded" }))).not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith({ event: "ACTIVITY_METRICS_FAILED", error });
    });
  });

  describe("inside a transaction", () => {
    it.each([
      ["an open", "activities_opened_total", (service: ActivityInstrumentationService) => service.trackOpened({ type: "deployment_close", initiator: "user" })],
      [
        "a record",
        "activities_recorded_total",
        (service: ActivityInstrumentationService) => service.trackRecorded({ type: "deployment_close", status: "succeeded", initiator: "system" })
      ],
      ["a settle", "activities_settled_total", (service: ActivityInstrumentationService) => service.trackSettled(createActivity({ status: "failed" }))]
    ] as const)("counts %s only once the transaction it was written in commits", (_, metric, track) => {
      const { service, counters, commit } = setup({ inTransaction: true });

      track(service);
      const countedBeforeCommit = counters[metric].add.mock.calls.filter(([value]) => value === 1);
      commit();

      expect(countedBeforeCommit).toEqual([]);
      expect(counters[metric].add).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it("counts nothing for a transaction that never commits", () => {
      const { service, opened, settleDuration } = setup({ inTransaction: true });

      service.trackOpened({ type: "deployment_close", initiator: "user" });
      service.trackSettled(createActivity({ status: "succeeded" }));

      expect(opened.add).not.toHaveBeenCalledWith(1, expect.anything());
      expect(settleDuration.record).not.toHaveBeenCalled();
    });
  });

  describe("when the backlog gauges are collected", () => {
    it("reports how many activities of each type are in progress and how old the oldest one is", async () => {
      const { observeBacklog, pending, oldestPendingAge } = setup({
        pendingSummaries: [{ type: "deployment_close", count: 3, oldestCreatedAt: subMinutes(new Date(), 90) }]
      });

      const result = await observeBacklog();

      expect(result.observe).toHaveBeenCalledWith(pending, 3, { type: "deployment_close" });
      expect(result.observe).toHaveBeenCalledWith(oldestPendingAge, expect.closeTo(5400, 0), { type: "deployment_close" });
      expect(result.observe).toHaveBeenCalledWith(pending, 0, { type: "deployment_create" });
    });

    it("reports every type with nothing in progress as zero, so its series never goes missing", async () => {
      const { observeBacklog, pending, oldestPendingAge } = setup({ pendingSummaries: [] });

      const result = await observeBacklog();

      expect(result.observe.mock.calls).toEqual(
        activityTypeEnum.enumValues.flatMap(type => [
          [pending, 0, { type }],
          [oldestPendingAge, 0, { type }]
        ])
      );
    });

    it("reports nothing when the backlog cannot be read, without failing the collection", async () => {
      const error = new Error("connection reset");
      const { observeBacklog, logger } = setup({ pendingSummaries: error });

      const result = await observeBacklog();

      expect(result.observe).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith({ event: "PENDING_ACTIVITIES_SUMMARY_FAILED", error });
    });
  });

  describe("dispose", () => {
    it("unregisters the backlog gauges, so the export that follows shutdown never reads the closed database", () => {
      const { service, meter, pending, oldestPendingAge } = setup();
      const [observeBacklog] = meter.addBatchObservableCallback.mock.calls[0];

      service.dispose();

      expect(meter.removeBatchObservableCallback).toHaveBeenCalledWith(observeBacklog, [pending, oldestPendingAge]);
    });

    it("keeps the backlog gauges registered until then", () => {
      const { meter } = setup();

      expect(meter.removeBatchObservableCallback).not.toHaveBeenCalled();
    });
  });

  function setup(input: { pendingSummaries?: PendingActivitySummary[] | Error; failingCounters?: boolean; inTransaction?: boolean } = {}) {
    const meter = mock<Meter>();
    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(meter);

    const opened = mock<Counter>();
    const settled = mock<Counter>();
    const recorded = mock<Counter>();
    const counters: Record<string, MockProxy<Counter>> = {
      activities_opened_total: opened,
      activities_settled_total: settled,
      activities_recorded_total: recorded
    };
    metricsService.createCounter.mockImplementation((_, name) => counters[name]);
    if (input.failingCounters) {
      opened.add.mockImplementation(() => {
        throw new Error("exporter down");
      });
    }

    const settleDuration = mock<Histogram>();
    metricsService.createHistogram.mockReturnValue(settleDuration);

    const pending = mock<ObservableGauge>();
    const oldestPendingAge = mock<ObservableGauge>();
    const gauges: Record<string, ObservableGauge> = { activities_pending: pending, activities_oldest_pending_age_seconds: oldestPendingAge };
    metricsService.createObservableGauge.mockImplementation((_, name) => gauges[name]);

    const activityRepository = mock<ActivityRepository>();
    if (input.pendingSummaries instanceof Error) activityRepository.summarizePendingByType.mockRejectedValue(input.pendingSummaries);
    else activityRepository.summarizePendingByType.mockResolvedValue(input.pendingSummaries ?? []);

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const txService = mock<TxService>();
    const onCommit: Array<() => void> = [];
    txService.afterCommit.mockImplementation(run => (input.inTransaction ? onCommit.push(run) : run()));
    const commit = () => onCommit.forEach(run => run());

    const service = new ActivityInstrumentationService(metricsService, activityRepository, txService, createLogger);

    async function observeBacklog() {
      const result = mock<BatchObservableResult>();
      const [observe] = meter.addBatchObservableCallback.mock.calls[0];
      await observe(result);
      return result;
    }

    return {
      service,
      metricsService,
      meter,
      opened,
      settled,
      recorded,
      counters,
      settleDuration,
      pending,
      oldestPendingAge,
      logger,
      createLogger,
      commit,
      observeBacklog
    };
  }
});
