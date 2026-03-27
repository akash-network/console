import { vi } from "vitest";

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

  function setup() {
    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockReturnValue(mock<Counter>());
    metricsService.createHistogram.mockReturnValue(mock<Histogram>());

    const service = new WalletBalanceReloadCheckInstrumentationService(metricsService);

    return { service };
  }
});
