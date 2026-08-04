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
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core";
import { classifyFailure, type FundingSkipReason, InitialDeploymentFundingInstrumentationService } from "./initial-deployment-funding-instrumentation.service";

describe(InitialDeploymentFundingInstrumentationService.name, () => {
  describe("recordJobSucceeded", () => {
    it("increments completions and duration with a success status and logs completion", () => {
      const { service, jobCompletions, jobDuration } = setup();

      service.recordJobSucceeded(1234);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "success" });
      expect(jobDuration.record).toHaveBeenCalledWith(1234, { status: "success" });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "INITIAL_FUNDING_JOB_COMPLETED", status: "success", durationMs: 1234 }));
    });
  });

  describe("recordJobFailed", () => {
    it("marks a lease-not-visible failure as retriable", () => {
      const { service, jobCompletions, jobDuration } = setup();
      const error = new Error("Lease for deployment 123 owned by akash1owner is not visible on chain yet");

      service.recordJobFailed(50, error);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "failure", reason: "lease_not_visible", retriable: true });
      expect(jobDuration.record).toHaveBeenCalledWith(50, { status: "failure" });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "INITIAL_FUNDING_JOB_FAILED", reason: "lease_not_visible", retriable: true, error })
      );
    });

    it("marks a generic deposit failure as non-retriable", () => {
      const { service, jobCompletions } = setup();
      const error = new Error("Bad status on response: 503");

      service.recordJobFailed(50, error);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "failure", reason: "deposit_tx_failed", retriable: false });
    });
  });

  describe("recordDeposit", () => {
    it("increments deposits, records the amount under its denom, and logs the deposit", () => {
      const { service, deposits, depositAmount } = setup();
      const logContext = { dseq: "123", address: "akash1owner", blockRate: 50 };

      service.recordDeposit(500000, "uakt", logContext);

      expect(deposits.add).toHaveBeenCalledWith(1);
      expect(depositAmount.record).toHaveBeenCalledWith(500000, { denom: "uakt" });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ ...logContext, event: "INITIAL_FUNDING_DEPOSITED", amount: 500000, denom: "uakt" })
      );
    });
  });

  describe("recordSkipped", () => {
    it.each([
      ["sufficient_runway", "info"],
      ["deployment_closed", "info"],
      ["insufficient_balance", "warn"],
      ["no_fee_allowance", "warn"],
      ["wallet_not_found", "error"]
    ] as Array<[FundingSkipReason, "info" | "warn" | "error"]>)("increments skips for %s and logs it at %s level", (reason, level) => {
      const { service, skips } = setup();
      const logContext = { dseq: "123", address: "akash1owner" };

      service.recordSkipped(reason, logContext);

      expect(skips.add).toHaveBeenCalledWith(1, { reason });
      expect(mockLogger[level]).toHaveBeenCalledWith(expect.objectContaining({ ...logContext, event: "INITIAL_FUNDING_SKIPPED", reason }));
    });
  });

  describe("when the logger throws", () => {
    it("still records job completion metrics and does not propagate the failure", () => {
      const { service, jobCompletions, jobDuration } = setup();
      mockLogger.info.mockImplementationOnce(() => {
        throw new Error("logger down");
      });

      expect(() => service.recordJobSucceeded(1234)).not.toThrow();
      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "success" });
      expect(jobDuration.record).toHaveBeenCalledWith(1234, { status: "success" });
    });

    it("still records deposit metrics and does not propagate the failure", () => {
      const { service, deposits, depositAmount } = setup();
      mockLogger.info.mockImplementationOnce(() => {
        throw new Error("logger down");
      });

      expect(() => service.recordDeposit(500000, "uakt", { dseq: "123" })).not.toThrow();
      expect(deposits.add).toHaveBeenCalledWith(1);
      expect(depositAmount.record).toHaveBeenCalledWith(500000, { denom: "uakt" });
    });

    it("still records failure metrics and does not propagate the failure", () => {
      const { service, jobCompletions } = setup();
      mockLogger.error.mockImplementationOnce(() => {
        throw new Error("logger down");
      });

      expect(() => service.recordJobFailed(50, new Error("boom"))).not.toThrow();
      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "failure", reason: "deposit_tx_failed", retriable: false });
    });

    it("still records skip metrics and does not propagate the failure", () => {
      const { service, skips } = setup();
      mockLogger.warn.mockImplementationOnce(() => {
        throw new Error("logger down");
      });

      expect(() => service.recordSkipped("insufficient_balance", { dseq: "123" })).not.toThrow();
      expect(skips.add).toHaveBeenCalledWith(1, { reason: "insufficient_balance" });
    });
  });

  describe("classifyFailure", () => {
    it("classifies a lease-not-visible error, case-insensitively", () => {
      expect(classifyFailure(new Error("deployment is Not Visible On Chain Yet"))).toBe("lease_not_visible");
    });

    it("classifies any other error as a deposit tx failure", () => {
      expect(classifyFailure(new Error(faker.lorem.sentence()))).toBe("deposit_tx_failed");
    });

    it("classifies a non-error throw as unknown", () => {
      expect(classifyFailure("boom")).toBe("unknown");
    });
  });

  function setup() {
    vi.clearAllMocks();

    const counters: Record<string, Counter> = {};
    const histograms: Record<string, Histogram> = {};

    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockImplementation((_meter, name) => (counters[name] = mock<Counter>()));
    metricsService.createHistogram.mockImplementation((_meter, name) => (histograms[name] = mock<Histogram>()));

    const service = new InitialDeploymentFundingInstrumentationService(metricsService);

    return {
      service,
      jobCompletions: counters["initial_deployment_funding_job_completions_total"],
      deposits: counters["initial_deployment_funding_deposits_total"],
      skips: counters["initial_deployment_funding_skips_total"],
      jobDuration: histograms["initial_deployment_funding_job_duration_ms"],
      depositAmount: histograms["initial_deployment_funding_deposit_amount"]
    };
  }
});
