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
import type { DrainingDeployment } from "@src/deployment/types/draining-deployment";
import type { FundingMessageItem } from "./deployment-top-up-instrumentation";
import { classifyFailure, FundDrainingDeploymentsInstrumentationService } from "./fund-draining-deployments-instrumentation.service";

describe(FundDrainingDeploymentsInstrumentationService.name, () => {
  describe("recordJobSucceeded", () => {
    it("increments completions and duration with a success status and logs completion", () => {
      const { service, jobCompletions, jobDuration } = setup();

      service.recordJobSucceeded(1234);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "success" });
      expect(jobDuration.record).toHaveBeenCalledWith(1234, { status: "success" });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_JOB_COMPLETED", status: "success", durationMs: 1234 }));
    });
  });

  describe("recordJobFailed", () => {
    it("marks a master-wallet insufficient-funds failure as retriable", () => {
      const { service, jobCompletions, jobDuration } = setup();
      const error = new Error("failed to execute message; message index: 0: insufficient funds");

      service.recordJobFailed(50, error);

      expect(jobCompletions.add).toHaveBeenCalledWith(1, { status: "failure", reason: "master_wallet_insufficient_funds", retriable: true });
      expect(jobDuration.record).toHaveBeenCalledWith(50, { status: "failure" });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUND_DRAINING_JOB_FAILED", reason: "master_wallet_insufficient_funds", retriable: true, error })
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
    it("increments deposits by item count, records each amount under its denom, and logs the deposit", () => {
      const { service, deposits, depositAmount } = setup();
      const items = [createFundingItem({ amount: 500000, denom: "uakt", dseq: 1 }), createFundingItem({ amount: 750000, denom: "uakt", dseq: 2 })];

      service.recordDeposit({ owner: "akash1owner", items });

      expect(deposits.add).toHaveBeenCalledWith(2);
      expect(depositAmount.record).toHaveBeenCalledWith(500000, { denom: "uakt" });
      expect(depositAmount.record).toHaveBeenCalledWith(750000, { denom: "uakt" });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_DEPOSITED", owner: "akash1owner" }));
    });
  });

  describe("recordSkipped", () => {
    it("increments skips with a nothing_to_fund reason and logs it", () => {
      const { service, skips } = setup();

      service.recordSkipped({ owner: "akash1owner", deploymentCount: 3 });

      expect(skips.add).toHaveBeenCalledWith(1, { reason: "nothing_to_fund" });
      expect(mockLogger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_SKIPPED", owner: "akash1owner", deploymentCount: 3 }));
    });
  });

  describe("recordInvalidDepositAmount", () => {
    it("increments skips with a non_positive_amount reason and warns", () => {
      const { service, skips } = setup();

      service.recordInvalidDepositAmount({ desiredAmount: 0, dseq: "123", address: "akash1owner", blockRate: 50 });

      expect(skips.add).toHaveBeenCalledWith(1, { reason: "non_positive_amount" });
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_AMOUNT_NON_POSITIVE", desiredAmount: 0, dseq: "123" }));
    });
  });

  describe("recordMessagePreparationError", () => {
    it("tags an insufficient-balance error and counts auto-reload wallets separately", () => {
      const { service, messagePreparationErrors, insufficientBalanceWithAutoReload } = setup();
      const deployment = mock<DrainingDeployment>({ dseq: "123", address: "akash1owner", isWalletAutoTopUpEnabled: true });

      service.recordMessagePreparationError({ deployment, error: new Error("Insufficient balance to cover deposit") });

      expect(messagePreparationErrors.add).toHaveBeenCalledWith(1, { error_type: "insufficient_balance" });
      expect(insufficientBalanceWithAutoReload.add).toHaveBeenCalledWith(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUND_DRAINING_MESSAGE_PREPARATION_ERROR", errorType: "insufficient_balance" })
      );
    });

    it("does not count auto-reload when the wallet has auto top-up disabled", () => {
      const { service, insufficientBalanceWithAutoReload } = setup();
      const deployment = mock<DrainingDeployment>({ dseq: "123", address: "akash1owner", isWalletAutoTopUpEnabled: false });

      service.recordMessagePreparationError({ deployment, error: new Error("Insufficient balance to cover deposit") });

      expect(insufficientBalanceWithAutoReload.add).not.toHaveBeenCalled();
    });

    it("tags any other preparation error as unknown and logs an error", () => {
      const { service, messagePreparationErrors, insufficientBalanceWithAutoReload } = setup();
      const deployment = mock<DrainingDeployment>({ dseq: "123", address: "akash1owner", isWalletAutoTopUpEnabled: true });

      service.recordMessagePreparationError({ deployment, error: new Error("rpc unavailable") });

      expect(messagePreparationErrors.add).toHaveBeenCalledWith(1, { error_type: "unknown" });
      expect(insufficientBalanceWithAutoReload.add).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_MESSAGE_PREPARATION_ERROR", errorType: "unknown" }));
    });
  });

  describe("recordOwnerInsufficientBalance", () => {
    it("counts every deployment as insufficient balance and warns once for the owner", () => {
      const { service, messagePreparationErrors, insufficientBalanceWithAutoReload } = setup();
      const first = mock<DrainingDeployment>({ dseq: "123", address: "akash1owner", isWalletAutoTopUpEnabled: true });
      const second = mock<DrainingDeployment>({ dseq: "456", address: "akash1owner", isWalletAutoTopUpEnabled: true });

      service.recordOwnerInsufficientBalance({
        owner: "akash1owner",
        spendable: 0,
        deployments: [
          { deployment: first, desiredAmount: 1_000_000 },
          { deployment: second, desiredAmount: 2_000_000 }
        ]
      });

      expect(messagePreparationErrors.add).toHaveBeenCalledExactlyOnceWith(2, { error_type: "insufficient_balance" });
      expect(insufficientBalanceWithAutoReload.add).toHaveBeenCalledExactlyOnceWith(2);
      expect(mockLogger.warn).toHaveBeenCalledExactlyOnceWith({
        event: "FUND_DRAINING_OWNER_INSUFFICIENT_BALANCE",
        owner: "akash1owner",
        spendable: 0,
        deploymentCount: 2,
        deployments: [
          { dseq: "123", desiredAmount: 1_000_000 },
          { dseq: "456", desiredAmount: 2_000_000 }
        ]
      });
    });

    it("leaves the auto-reload counter untouched when the wallet has auto top-up disabled", () => {
      const { service, insufficientBalanceWithAutoReload } = setup();
      const deployment = mock<DrainingDeployment>({ dseq: "123", address: "akash1owner", isWalletAutoTopUpEnabled: false });

      service.recordOwnerInsufficientBalance({ owner: "akash1owner", spendable: 0, deployments: [{ deployment, desiredAmount: 1_000_000 }] });

      expect(insufficientBalanceWithAutoReload.add).not.toHaveBeenCalled();
    });
  });

  describe("recordChainTxError", () => {
    it("increments chain tx errors and logs the error", () => {
      const { service, chainTxErrors } = setup();
      const error = new Error("broadcast failed");

      service.recordChainTxError({ owner: "akash1owner", items: [createFundingItem()], error });

      expect(chainTxErrors.add).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_CHAIN_TX_ERROR", owner: "akash1owner", error }));
    });
  });

  describe("recordMasterWalletInsufficientFundsError", () => {
    it("increments the master-wallet insufficient-funds counter and logs the error", () => {
      const { service, masterWalletInsufficientFunds } = setup();
      const error = new Error("insufficient funds");

      service.recordMasterWalletInsufficientFundsError({ owner: "akash1owner", items: [createFundingItem()], error });

      expect(masterWalletInsufficientFunds.add).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUND_DRAINING_MASTER_WALLET_INSUFFICIENT_FUNDS", owner: "akash1owner", error })
      );
    });
  });

  describe("recordClaimReleaseError", () => {
    it("increments the claim-release error counter and logs the error", () => {
      const { service, claimReleaseErrors } = setup();
      const error = new Error("connection terminated");

      service.recordClaimReleaseError({ owner: "akash1owner", deploymentIds: ["setting-1"], error });

      expect(claimReleaseErrors.add).toHaveBeenCalledWith(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUND_DRAINING_CLAIM_RELEASE_ERROR", owner: "akash1owner", deploymentIds: ["setting-1"], error })
      );
    });
  });

  describe("recordHeadroomConceded", () => {
    it("increments the concession counter and warns with the amounts either side of it", () => {
      const { service, headroomConcessions } = setup();
      const details = {
        dseq: "900001",
        address: "akash1owner",
        desiredAmount: 50_000_000,
        flooredAmount: 600_000,
        affordableAmount: 5_600_000,
        runwayMinutes: 2880
      };

      service.recordHeadroomConceded(details);

      expect(headroomConcessions.add).toHaveBeenCalledWith(1);
      expect(mockLogger.warn).toHaveBeenCalledWith({ event: "FUND_DRAINING_HEADROOM_CONCEDED", ...details });
    });
  });

  describe("recordDeploymentsMarkedClosed", () => {
    it("increments the marked-closed counter by the given count", () => {
      const { service, deploymentsMarkedClosed } = setup();

      service.recordDeploymentsMarkedClosed(4);

      expect(deploymentsMarkedClosed.add).toHaveBeenCalledWith(4);
    });
  });

  describe("recordDeploymentClosedOnChain", () => {
    it("credits the marked-closed counter and warns rather than reporting a chain tx error", () => {
      const { service, deploymentsMarkedClosed, chainTxErrors } = setup();
      const deployment = mock<DrainingDeployment>({ dseq: "42", address: "akash1owner" });
      const error = new Error("Deployment closed");

      service.recordDeploymentClosedOnChain({ owner: "akash1owner", deployment, messageIndex: 0, error });

      expect(deploymentsMarkedClosed.add).toHaveBeenCalledWith(1);
      expect(chainTxErrors.add).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUND_DRAINING_DEPLOYMENT_CLOSED_ON_CHAIN", owner: "akash1owner", dseq: "42", messageIndex: 0, error })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("recordDeploymentCloseMarkFailed", () => {
    it("warns without claiming the deployment was marked closed", () => {
      const { service, deploymentsMarkedClosed } = setup();
      const deployment = mock<DrainingDeployment>({ dseq: "42", address: "akash1owner" });

      service.recordDeploymentCloseMarkFailed({ owner: "akash1owner", deployment, error: new Error("connection terminated") });

      expect(deploymentsMarkedClosed.add).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "FUND_DRAINING_DEPLOYMENT_CLOSE_MARK_FAILED", dseq: "42" }));
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("recordClosedDeploymentRetryLimit", () => {
    it("warns without counting the deployments it left unfunded as errors", () => {
      const { service, chainTxErrors } = setup();

      service.recordClosedDeploymentRetryLimit({ owner: "akash1owner", remainingCount: 2 });

      expect(chainTxErrors.add).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUND_DRAINING_CLOSED_DEPLOYMENT_RETRY_LIMIT", owner: "akash1owner", remainingCount: 2 })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe("recordDeploymentPreparation", () => {
    it("records no instrument and does not throw on the stateless path", () => {
      const { service, jobCompletions } = setup();

      expect(() => service.recordDeploymentPreparation("akash1owner", 1000500)).not.toThrow();
      expect(jobCompletions.add).not.toHaveBeenCalled();
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
      mockLogger.info.mockImplementationOnce(() => {
        throw new Error("logger down");
      });

      expect(() => service.recordSkipped({ owner: "akash1owner", deploymentCount: 1 })).not.toThrow();
      expect(skips.add).toHaveBeenCalledWith(1, { reason: "nothing_to_fund" });
    });
  });

  describe("classifyFailure", () => {
    it("classifies an insufficient-funds error, case-insensitively", () => {
      expect(classifyFailure(new Error("Message index 0: Insufficient Funds"))).toBe("master_wallet_insufficient_funds");
    });

    it("classifies any other error as a deposit tx failure", () => {
      expect(classifyFailure(new Error(faker.lorem.sentence()))).toBe("deposit_tx_failed");
    });

    it("classifies a non-error throw as unknown", () => {
      expect(classifyFailure("boom")).toBe("unknown");
    });
  });

  function createFundingItem(input?: { amount?: number; denom?: string; dseq?: number }): FundingMessageItem {
    return {
      deployment: mock<DrainingDeployment>(),
      input: {
        dseq: input?.dseq ?? faker.number.int({ min: 1, max: 100000 }),
        amount: input?.amount ?? faker.number.int({ min: 1, max: 1000000 }),
        denom: input?.denom ?? "uakt",
        owner: "akash1owner",
        signer: "akash1owner"
      }
    };
  }

  function setup() {
    vi.clearAllMocks();

    const counters: Record<string, Counter> = {};
    const histograms: Record<string, Histogram> = {};

    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock());
    metricsService.createCounter.mockImplementation((_meter, name) => (counters[name] = mock<Counter>()));
    metricsService.createHistogram.mockImplementation((_meter, name) => (histograms[name] = mock<Histogram>()));

    const service = new FundDrainingDeploymentsInstrumentationService(metricsService);

    return {
      service,
      jobCompletions: counters["fund_draining_deployments_job_completions_total"],
      deposits: counters["fund_draining_deployments_deposits_total"],
      skips: counters["fund_draining_deployments_skips_total"],
      messagePreparationErrors: counters["fund_draining_deployments_message_preparation_errors_total"],
      insufficientBalanceWithAutoReload: counters["fund_draining_deployments_insufficient_balance_with_auto_reload_total"],
      chainTxErrors: counters["fund_draining_deployments_chain_tx_errors_total"],
      masterWalletInsufficientFunds: counters["fund_draining_deployments_master_wallet_insufficient_funds_total"],
      deploymentsMarkedClosed: counters["fund_draining_deployments_deployments_marked_closed_total"],
      claimReleaseErrors: counters["fund_draining_deployments_claim_release_errors_total"],
      headroomConcessions: counters["fund_draining_deployments_headroom_concessions_total"],
      jobDuration: histograms["fund_draining_deployments_job_duration_ms"],
      depositAmount: histograms["fund_draining_deployments_deposit_amount"]
    };
  }
});
