import "@test/mocks/logger-service.mock";

import { faker } from "@faker-js/faker";
import type { Counter } from "@opentelemetry/api";
import { mock } from "vitest-mock-extended";

import type { LoggerService, MetricsService } from "@src/core";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import type { DrainingDeployment } from "@src/deployment/types/draining-deployment";
import { TopUpManagedDeploymentsInstrumentationService } from "./top-up-managed-deployments-instrumentation.service";

import { createAutoTopUpDeployment } from "@test/seeders/auto-top-up-deployment.seeder";
import { createDrainingDeployment as createDrainingDeploymentSeed } from "@test/seeders/draining-deployment.seeder";

describe(TopUpManagedDeploymentsInstrumentationService.name, () => {
  describe("finish", () => {
    it("logs info when there are no errors", () => {
      const { service, logger } = setup();
      service.start(100, { dryRun: false });

      service.finish("success", 200);

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_DEPLOYMENTS_SUMMARY", dryRun: false }));
    });

    it("logs error when there are deployment errors", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      summarizer.inc("deploymentTopUpErrorCount");

      service.finish("failure", 200);

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_DEPLOYMENTS_SUMMARY" }));
    });

    it("skips setting endBlockHeight when blockHeight is undefined", () => {
      const { service, logger } = setup();
      service.start(100, { dryRun: false });

      service.finish("success");

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({ endBlockHeight: undefined })
        })
      );
    });
  });

  describe("recordDeposit", () => {
    it("tracks summarizer and logs success", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      const details = createDepositDetails();

      service.recordDeposit(details);

      expect(summarizer.get("deploymentTopUpCount")).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_DEPLOYMENTS_SUCCESS" }));
    });
  });

  describe("recordChainTxError", () => {
    it("tracks failed wallet and logs error", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      const details = createDepositDetails();

      service.recordChainTxError({ ...details, error: new Error("tx failed") });

      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_DEPLOYMENTS_ERROR" }));
    });
  });

  describe("recordMessagePreparationError", () => {
    it("tracks insufficient balance separately", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment();

      service.recordMessagePreparationError({ deployment, error: new Error("Insufficient balance for address") });

      expect(summarizer.get("insufficientBalanceCount")).toBe(1);
      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "MESSAGE_PREPARATION_ERROR" }));
    });

    it("increments auto-reload counter when insufficient balance and wallet auto-reload is enabled", () => {
      const { service, countersByName } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment({ isWalletAutoTopUpEnabled: true });

      service.recordMessagePreparationError({ deployment, error: new Error("Insufficient balance for address") });

      expect(countersByName["auto_top_up_insufficient_balance_with_auto_reload_total"]?.add).toHaveBeenCalledWith(1);
    });

    it("does not increment auto-reload counter when insufficient balance and wallet auto-reload is disabled", () => {
      const { service, countersByName } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment({ isWalletAutoTopUpEnabled: false });

      service.recordMessagePreparationError({ deployment, error: new Error("Insufficient balance for address") });

      expect(countersByName["auto_top_up_insufficient_balance_with_auto_reload_total"]?.add).not.toHaveBeenCalled();
    });

    it("tracks other errors as deployment errors", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment();

      service.recordMessagePreparationError({ deployment, error: new Error("some other error") });

      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(1);
      expect(summarizer.get("insufficientBalanceCount")).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "MESSAGE_PREPARATION_ERROR" }));
    });

    it("handles non-Error error types", () => {
      const { service, logger } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment();

      service.recordMessagePreparationError({ deployment, error: "string error" });

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ message: "string error" }));
    });
  });

  describe("recordDeploymentPreparation", () => {
    it("records predicted close blocks when start height is set", () => {
      const { service, summarizer } = setup();
      service.start(100, { dryRun: false });

      service.recordDeploymentPreparation("owner1", 200);

      expect(summarizer.get("deploymentCount")).toBe(1);
    });

    it("skips predicted close blocks when start height is not set", () => {
      const { service, summarizer } = setup();

      service.recordDeploymentPreparation("owner1", 200);

      expect(summarizer.get("deploymentCount")).toBe(1);
    });
  });

  describe("recordMasterWalletInsufficientFundsError", () => {
    it("logs error with serialized error details", () => {
      const { service, logger } = setup();
      service.start(100, { dryRun: false });
      const details = createDepositDetails();

      service.recordMasterWalletInsufficientFundsError({ ...details, error: new Error("insufficient funds") });

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "MASTER_WALLET_INSUFFICIENT_FUNDS", message: "insufficient funds" }));
    });
  });

  describe("execWhenEnabled", () => {
    it("does not emit metrics in dry run mode", () => {
      const { service, summarizer } = setup();
      service.start(100, { dryRun: true });
      const details = createDepositDetails();

      service.recordDeposit(details);
      service.finish("success", 200);

      expect(summarizer.get("deploymentTopUpCount")).toBe(1);
    });
  });

  function createDrainingDeployment(overrides?: Partial<DrainingDeployment>): DrainingDeployment {
    const base = createAutoTopUpDeployment(overrides);
    const extra = createDrainingDeploymentSeed({ dseq: Number(base.dseq), owner: base.address });
    return { ...base, ...extra, dseq: base.dseq, ...overrides } as DrainingDeployment;
  }

  function createDepositDetails() {
    const deployment = createDrainingDeployment();
    return {
      owner: deployment.address,
      items: [
        {
          deployment,
          input: {
            dseq: Number(deployment.dseq),
            amount: faker.number.int({ min: 1000, max: 5000000 }),
            denom: "uakt",
            owner: deployment.address,
            signer: deployment.address
          }
        }
      ]
    };
  }

  function setup() {
    const countersByName: Record<string, Counter> = {};
    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockImplementation((_meter, name) => {
      const counter = mock<Counter>();
      countersByName[name] = counter;
      return counter;
    });
    metricsService.createHistogram.mockReturnValue(mock());

    const summarizer = new TopUpSummarizer();
    const logger = mock<LoggerService>();

    const service = new TopUpManagedDeploymentsInstrumentationService(metricsService, summarizer, logger);

    return { service, metricsService, countersByName, summarizer, logger };
  }
});
