const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}));

vi.mock("@akashnetwork/logging/otel", () => ({
  createOtelLogger: () => mockLogger
}));

import { faker } from "@faker-js/faker";
import type { Counter, Histogram } from "@opentelemetry/api";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core";
import { TrialActivationInstrumentationService } from "./trial-activation-instrumentation.service";

describe(TrialActivationInstrumentationService.name, () => {
  describe("recordJobSucceeded", () => {
    it("counts a success and records the job duration", () => {
      const { service, jobCompletions, jobDuration } = setup();

      service.recordJobSucceeded(faker.string.uuid(), 1234);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "success" });
      expect(jobDuration.record).toHaveBeenCalledWith(1234, { status: "success" });
    });
  });

  describe("recordJobFailed", () => {
    it("counts a failure, records the duration, and logs the event", () => {
      const { service, jobCompletions, jobDuration } = setup();
      const error = new Error(faker.lorem.sentence());
      const userId = faker.string.uuid();

      service.recordJobFailed(userId, 500, error);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "failure", reason: "grant_failed" });
      expect(jobDuration.record).toHaveBeenCalledWith(500, { status: "failure" });
      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_ACTIVATION_JOB_FAILED", userId, reason: "grant_failed", error }));
    });

    it.each([
      { error: createError(409, "still provisioning"), reason: "provisioning_in_progress" },
      { error: createError(404, "wallet not found"), reason: "user_or_wallet_not_found" },
      { error: createError(400, "Email not verified"), reason: "email_not_verified" },
      { error: createError(400, "Unable to start trial for this user"), reason: "fingerprint_block" },
      { error: createError(400, "some other bad request"), reason: "grant_failed" },
      { error: new Error("chain grant reverted"), reason: "grant_failed" }
    ])("classifies a $reason failure", ({ error, reason }) => {
      const { service, jobCompletions } = setup();

      service.recordJobFailed(faker.string.uuid(), 100, error);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "failure", reason });
    });
  });

  describe("recordActivated", () => {
    it("records the activation latency and logs the event", () => {
      const { service, activationLatency } = setup();
      const userId = faker.string.uuid();

      service.recordActivated(userId, 9000);

      expect(activationLatency.record).toHaveBeenCalledWith(9000);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_ACTIVATED", userId, latencyMs: 9000 }));
    });
  });

  function setup() {
    const jobCompletions = mock<Counter>();
    const jobDuration = mock<Histogram>();
    const activationLatency = mock<Histogram>();

    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockReturnValue(jobCompletions);
    metricsService.createHistogram.mockReturnValueOnce(jobDuration).mockReturnValueOnce(activationLatency);

    const service = new TrialActivationInstrumentationService(metricsService);

    return { service, jobCompletions, jobDuration, activationLatency };
  }
});
