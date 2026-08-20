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
import { WalletBalanceReloadCheckInstrumentationService } from "./wallet-balance-reload-check-instrumentation.service";

describe(WalletBalanceReloadCheckInstrumentationService.name, () => {
  describe("recordReloadFailed", () => {
    it("logs error with context when reload fails with an Error", () => {
      const { service } = setup();
      const error = new TypeError(faker.lorem.sentence());
      const logContext = {
        walletAddress: faker.string.alphanumeric(44),
        balance: faker.number.float({ min: 0, max: 100 })
      };

      service.recordReloadFailed(error, logContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          ...logContext,
          event: "WALLET_BALANCE_RELOAD_FAILED",
          error
        })
      );
    });

    it("logs error with context when reload fails with a non-Error", () => {
      const { service } = setup();
      const error = faker.lorem.sentence();
      const logContext = {
        walletAddress: faker.string.alphanumeric(44),
        balance: faker.number.float({ min: 0, max: 100 })
      };

      service.recordReloadFailed(error, logContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          ...logContext,
          event: "WALLET_BALANCE_RELOAD_FAILED",
          error
        })
      );
    });
  });

  describe("recordReloadTriggered", () => {
    it("records the coverage ratio and projected cost in prediction mode and logs the reload", () => {
      const { service, histograms, counters } = setup();
      const logContext = { walletAddress: faker.string.alphanumeric(44), balance: 10 };

      service.recordReloadTriggered({ mode: "prediction", amount: 40, coverageRatio: 0.2, projectedCost: 50, logContext });

      expect(counters.wallet_balance_reload_check_reloads_triggered_total.add).toHaveBeenCalledWith(1, { mode: "prediction" });
      expect(histograms.wallet_balance_reload_check_balance_coverage_ratio.record).toHaveBeenCalledWith(0.2, { mode: "prediction" });
      expect(histograms.wallet_balance_reload_check_projected_cost_usd.record).toHaveBeenCalledWith(50, { mode: "prediction" });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ ...logContext, mode: "prediction", amount: 40, event: "WALLET_BALANCE_RELOADED" })
      );
    });

    it("omits the projected cost histogram in threshold mode", () => {
      const { service, histograms, counters } = setup();

      service.recordReloadTriggered({ mode: "threshold", amount: 100, coverageRatio: 0.5, logContext: { threshold: 20 } });

      expect(counters.wallet_balance_reload_check_reloads_triggered_total.add).toHaveBeenCalledWith(1, { mode: "threshold" });
      expect(histograms.wallet_balance_reload_check_balance_coverage_ratio.record).toHaveBeenCalledWith(0.5, { mode: "threshold" });
      expect(histograms.wallet_balance_reload_check_projected_cost_usd.record).not.toHaveBeenCalled();
    });
  });

  describe("recordReloadSkipped", () => {
    it("increments the skipped counter with the mode and reason and logs the skip", () => {
      const { service, counters } = setup();

      service.recordReloadSkipped({ mode: "threshold", reason: "sufficient_balance", coverageRatio: 1.5, logContext: { threshold: 20 } });

      expect(counters.wallet_balance_reload_check_reloads_skipped_total.add).toHaveBeenCalledWith(1, {
        mode: "threshold",
        reason: "sufficient_balance"
      });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ threshold: 20, mode: "threshold", event: "WALLET_BALANCE_RELOAD_SKIPPED" }));
    });
  });

  function setup() {
    const metricsService = mock<MetricsService>();
    const histograms: Record<string, ReturnType<typeof mock<Histogram>>> = {};
    const counters: Record<string, ReturnType<typeof mock<Counter>>> = {};
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockImplementation((_meter, name) => (counters[name] = mock<Counter>()));
    metricsService.createHistogram.mockImplementation((_meter, name) => (histograms[name] = mock<Histogram>()));

    const service = new WalletBalanceReloadCheckInstrumentationService(metricsService);

    return { service, histograms, counters };
  }
});
