import { faker } from "@faker-js/faker";
import type { Counter } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, MetricsService } from "@src/core";
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

  describe("recordDeploymentClosedOnChain", () => {
    it("warns, credits the marked-closed count, and leaves the run reporting success", () => {
      const { service, logger, summarizer, countersByName } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment();
      const error = new Error("Deployment closed");

      service.recordDeploymentClosedOnChain({ owner: deployment.address, deployment, messageIndex: 1, error });
      service.finish("success", 200);

      expect(summarizer.get("deploymentsMarkedClosedCount")).toBe(1);
      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(0);
      expect(summarizer.get("walletsTopUpErrorCount")).toBe(0);
      expect(countersByName["auto_top_up_deployments_marked_closed_total"].add).toHaveBeenCalledWith(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_DEPLOYMENT_CLOSED_ON_CHAIN",
          dseq: deployment.dseq,
          address: deployment.address,
          messageIndex: 1,
          message: "Deployment closed"
        })
      );
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_DEPLOYMENTS_SUMMARY" }));
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("recordDeploymentCloseMarkFailed", () => {
    it("warns without claiming the deployment was marked closed", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment();

      service.recordDeploymentCloseMarkFailed({ owner: deployment.address, deployment, error: new Error("connection terminated") });

      expect(summarizer.get("deploymentsMarkedClosedCount")).toBe(0);
      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_DEPLOYMENT_CLOSE_MARK_FAILED", dseq: deployment.dseq }));
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("recordClosedDeploymentRetryLimit", () => {
    it("warns without counting the deployments it left unfunded as errors", () => {
      const { service, logger, summarizer } = setup();
      service.start(100, { dryRun: false });
      const owner = createDrainingDeployment().address;

      service.recordClosedDeploymentRetryLimit({ owner, remainingCount: 2 });

      expect(summarizer.get("deploymentTopUpErrorCount")).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TOP_UP_CLOSED_DEPLOYMENT_RETRY_LIMIT", owner, remainingCount: 2 }));
      expect(logger.error).not.toHaveBeenCalled();
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

  describe("recordOwnerInsufficientBalance", () => {
    it("counts every deployment as insufficient balance and warns once for the owner", () => {
      const { service, logger, summarizer, countersByName } = setup();
      service.start(100, { dryRun: false });
      const first = createDrainingDeployment({ isWalletAutoTopUpEnabled: true, walletIsTrialing: true });
      const second = createDrainingDeployment({ isWalletAutoTopUpEnabled: true, walletIsTrialing: true, address: first.address, userId: first.userId });

      service.recordOwnerInsufficientBalance({
        owner: first.address,
        spendable: 0,
        deployments: [
          { deployment: first, desiredAmount: 1_000_000 },
          { deployment: second, desiredAmount: 2_000_000 }
        ]
      });

      expect(summarizer.get("insufficientBalanceCount")).toBe(2);
      expect(countersByName["auto_top_up_message_preparation_errors_total"].add).toHaveBeenCalledExactlyOnceWith(2, { error_type: "insufficient_balance" });
      expect(countersByName["auto_top_up_insufficient_balance_with_auto_reload_total"].add).toHaveBeenCalledExactlyOnceWith(2);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
        event: "TOP_UP_OWNER_INSUFFICIENT_BALANCE",
        owner: first.address,
        userId: first.userId,
        isTrialing: true,
        autoReloadEnabled: true,
        spendable: 0,
        deploymentCount: 2,
        deployments: [
          { dseq: first.dseq, desiredAmount: 1_000_000 },
          { dseq: second.dseq, desiredAmount: 2_000_000 }
        ],
        dryRun: false
      });
    });

    it("leaves the auto-reload counter untouched when the wallet has auto top-up disabled", () => {
      const { service, countersByName } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment({ isWalletAutoTopUpEnabled: false });

      service.recordOwnerInsufficientBalance({ owner: deployment.address, spendable: 0, deployments: [{ deployment, desiredAmount: 1_000_000 }] });

      expect(countersByName["auto_top_up_insufficient_balance_with_auto_reload_total"].add).not.toHaveBeenCalled();
    });

    it("keeps the summary count in dry run without emitting metrics", () => {
      const { service, summarizer, logger, countersByName } = setup();
      service.start(100, { dryRun: true });
      const deployment = createDrainingDeployment();

      service.recordOwnerInsufficientBalance({ owner: deployment.address, spendable: 0, deployments: [{ deployment, desiredAmount: 1_000_000 }] });

      expect(summarizer.get("insufficientBalanceCount")).toBe(1);
      expect(countersByName["auto_top_up_message_preparation_errors_total"].add).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    });
  });

  describe("recordDepositBelowUsefulRunway", () => {
    it("counts the decline, warns with the owner's account state, and carries the dry-run flag", () => {
      const { service, logger, summarizer, countersByName } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment({ walletIsTrialing: false, isWalletAutoTopUpEnabled: false });

      service.recordDepositBelowUsefulRunway({ deployment, desiredAmount: 50_000_000, affordableAmount: 500_000, runwayMinutes: 17 });

      expect(summarizer.get("depositsBelowUsefulRunwayCount")).toBe(1);
      expect(countersByName["auto_top_up_deposits_below_useful_runway_total"].add).toHaveBeenCalledWith(1);
      expect(logger.warn).toHaveBeenCalledWith({
        event: "DEPOSIT_BELOW_USEFUL_RUNWAY",
        dseq: deployment.dseq,
        address: deployment.address,
        userId: deployment.userId,
        isTrialing: false,
        autoReloadEnabled: false,
        desiredAmount: 50_000_000,
        affordableAmount: 500_000,
        runwayMinutes: 17,
        dryRun: false
      });
    });

    it("counts the decline without emitting a metric in dry run mode", () => {
      const { service, summarizer, countersByName } = setup();
      service.start(100, { dryRun: true });

      service.recordDepositBelowUsefulRunway({
        deployment: createDrainingDeployment(),
        desiredAmount: 50_000_000,
        affordableAmount: 500_000,
        runwayMinutes: 17
      });

      expect(summarizer.get("depositsBelowUsefulRunwayCount")).toBe(1);
      expect(countersByName["auto_top_up_deposits_below_useful_runway_total"].add).not.toHaveBeenCalled();
    });
  });

  describe("recordHeadroomConceded", () => {
    it("counts the concession, warns with the amounts either side of it, and carries the dry-run flag", () => {
      const { service, logger, summarizer, countersByName } = setup();
      service.start(100, { dryRun: false });
      const deployment = createDrainingDeployment();
      const details = {
        dseq: deployment.dseq,
        address: deployment.address,
        desiredAmount: 50_000_000,
        flooredAmount: 600_000,
        affordableAmount: 5_600_000,
        runwayMinutes: 2880
      };

      service.recordHeadroomConceded(details);

      expect(summarizer.get("headroomConcessionCount")).toBe(1);
      expect(countersByName["auto_top_up_headroom_concessions_total"].add).toHaveBeenCalledWith(1);
      expect(logger.warn).toHaveBeenCalledWith({ event: "AUTO_TOP_UP_HEADROOM_CONCEDED", ...details, dryRun: false });
    });

    it("counts the concession without emitting a metric in dry run mode", () => {
      const { service, summarizer, countersByName } = setup();
      service.start(100, { dryRun: true });
      const deployment = createDrainingDeployment();

      service.recordHeadroomConceded({
        dseq: deployment.dseq,
        address: deployment.address,
        desiredAmount: 50_000_000,
        flooredAmount: 600_000,
        affordableAmount: 5_600_000,
        runwayMinutes: 2880
      });

      expect(summarizer.get("headroomConcessionCount")).toBe(1);
      expect(countersByName["auto_top_up_headroom_concessions_total"].add).not.toHaveBeenCalled();
    });
  });

  describe("recordDeploymentPreparation", () => {
    it("records predicted close blocks when start height is set", () => {
      const { service, summarizer } = setup();
      service.start(100, { dryRun: false });

      service.recordDeploymentPreparation("owner1", 200);

      expect(summarizer.get("deploymentCount")).toBe(1);
    });

    it("counts the scanned deployment so the summary's deployment count has a metric counterpart", () => {
      const { service, countersByName } = setup();
      service.start(100, { dryRun: false });

      service.recordDeploymentPreparation("owner1", 200);

      expect(countersByName["auto_top_up_deployments_scanned_total"].add).toHaveBeenCalledExactlyOnceWith(1);
    });

    it("does not emit the scanned counter in dry run mode", () => {
      const { service, countersByName } = setup();
      service.start(100, { dryRun: true });

      service.recordDeploymentPreparation("owner1", 200);

      expect(countersByName["auto_top_up_deployments_scanned_total"].add).not.toHaveBeenCalled();
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

  describe("recordClaimReleaseError", () => {
    it("logs the deployments whose funding claim could not be released", () => {
      const { service, logger } = setup();
      service.start(100, { dryRun: false });

      service.recordClaimReleaseError({ owner: "akash1owner", deploymentIds: ["setting-1"], error: new Error("connection terminated") });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_CLAIM_RELEASE_ERROR",
          owner: "akash1owner",
          deploymentIds: ["setting-1"],
          message: "connection terminated"
        })
      );
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TopUpManagedDeploymentsInstrumentationService.name });
  });

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
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TopUpManagedDeploymentsInstrumentationService(metricsService, summarizer, createLogger);

    return { service, metricsService, countersByName, summarizer, logger, createLogger };
  }
});
