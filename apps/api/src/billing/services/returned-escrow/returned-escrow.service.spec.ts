import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  CompletedFundingWalletMove,
  FundingWalletMoveRepository,
  FundingWalletRefundOutput,
  FundingWalletRefundRepository,
  FundingWalletRepository,
  UserWalletOutput,
  UserWalletRepository
} from "@src/billing/repositories";
import type {
  DeploymentAllowanceHistoryRepository,
  RefundLeftWithGranter
} from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { CreditReturnedEscrow } from "./credit-returned-escrow.job";
import { ReturnedEscrowService } from "./returned-escrow.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";
const USER_WALLET_ID = 7;
const NOW = new Date("2026-11-27T12:00:00.000Z");

describe(ReturnedEscrowService.name, () => {
  describe("creditTo", () => {
    it("credits nothing for a user wallet that does not exist or has no address", async () => {
      const missing = setup({ wallet: null });
      const uninitialized = setup({ wallet: { address: null } });

      await expect(missing.service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 0 });
      await expect(uninitialized.service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 0 });

      expect(missing.fundingWalletMoveRepository.findCompletedOf).not.toHaveBeenCalled();
      expect(uninitialized.fundingWalletMoveRepository.findCompletedOf).not.toHaveBeenCalled();
    });

    it("credits nothing for a user wallet that was never moved", async () => {
      const { service, deploymentAllowanceHistoryRepository, deploymentAllowanceService } = setup({ moves: [] });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 0 });

      expect(deploymentAllowanceHistoryRepository.findRefundsLeftWithGranter).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
    });

    it("reads what the user's closing deployments returned to the funding wallet it moved off, after the height the move read at", async () => {
      const { service, wallet, moves, fundingWalletMoveRepository, deploymentAllowanceHistoryRepository } = setup();

      await service.creditTo(USER_WALLET_ID);

      expect(fundingWalletMoveRepository.findCompletedOf).toHaveBeenCalledWith(USER_WALLET_ID, NETWORK);
      expect(deploymentAllowanceHistoryRepository.findRefundsLeftWithGranter).toHaveBeenCalledWith({
        granter: moves[0].fromAddress,
        owner: wallet.address,
        afterHeight: moves[0].readHeight
      });
    });

    it("records each close once with the amount it returned in the grant's denom, and adds it to the user's balance through a write that is repeated if it never lands", async () => {
      const { service, wallet, moves, deploymentAllowanceService, refunds, logger } = setup({
        returned: [
          { txHash: "CLOSE_A", msgIndex: 0, receivedByGranter: ["500000uact"] },
          { txHash: "CLOSE_B", msgIndex: 2, receivedByGranter: ["200000uact,9uakt", "100000uact"] }
        ]
      });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 2, needsReview: 0 });

      expect(refunds()).toEqual([
        expect.objectContaining({ moveId: moves[0].id, txHash: "CLOSE_A", msgIndex: 0, amount: 500_000, status: "credited" }),
        expect.objectContaining({ moveId: moves[0].id, txHash: "CLOSE_B", msgIndex: 2, amount: 300_000, status: "credited" })
      ]);
      expect(deploymentAllowanceService.adjust.mock.calls).toEqual([
        [wallet, 500_000, { redo: true }],
        [wallet, 300_000, { redo: true }]
      ]);
      expect(logger.info).toHaveBeenCalledWith({
        event: "RETURNED_ESCROW_CREDITED",
        userWalletId: USER_WALLET_ID,
        refundId: refunds()[0].id,
        txHash: "CLOSE_A",
        amount: 500_000
      });
    });

    it("records nothing for a close that returned none of the grant's denom", async () => {
      const { service, refunds, deploymentAllowanceService } = setup({ returned: [{ txHash: "CLOSE_A", msgIndex: 0, receivedByGranter: ["500000uakt"] }] });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 0 });

      expect(refunds()).toEqual([]);
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
    });

    it("marks a refund as crediting before the credit is sent", async () => {
      const { service, deploymentAllowanceService, refunds } = setup({ returned: [{ txHash: "CLOSE_A", msgIndex: 0, receivedByGranter: ["500000uact"] }] });
      const statusesAtCredit: string[] = [];
      deploymentAllowanceService.adjust.mockImplementation(async () => {
        statusesAtCredit.push(refunds()[0].status);
        return { previousLimit: 0, nextLimit: 500_000, txHash: "CREDIT_HASH" };
      });

      await service.creditTo(USER_WALLET_ID);

      expect(statusesAtCredit).toEqual(["crediting"]);
    });

    it("credits nothing again for a close it credited on an earlier run", async () => {
      const { service, deploymentAllowanceService } = setup({ returned: [{ txHash: "CLOSE_A", msgIndex: 0, receivedByGranter: ["500000uact"] }] });
      await service.creditTo(USER_WALLET_ID);

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 0 });

      expect(deploymentAllowanceService.adjust).toHaveBeenCalledTimes(1);
    });

    it("never sends a credit again for a refund that stopped while crediting, and asks for a review instead", async () => {
      const { service, deploymentAllowanceService, refunds, logger } = setup({ recorded: [{ status: "crediting", amount: 500_000, txHash: "CLOSE_A" }] });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 1 });

      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(refunds()[0]).toMatchObject({ status: "failed", failure: "the credit was interrupted, so it may or may not be on chain" });
      expect(logger.error).toHaveBeenCalledWith({
        event: "RETURNED_ESCROW_NEEDS_REVIEW",
        refundId: refunds()[0].id,
        txHash: "CLOSE_A",
        amount: 500_000,
        failure: "the credit was interrupted, so it may or may not be on chain"
      });
    });

    it("counts a refund already waiting for a review and sends nothing for it", async () => {
      const { service, deploymentAllowanceService, fundingWalletRefundRepository } = setup({ recorded: [{ status: "failed", amount: 500_000 }] });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 1 });

      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(fundingWalletRefundRepository.updateFrom).not.toHaveBeenCalled();
    });

    it("sends nothing for a refund another run took first", async () => {
      const { service, deploymentAllowanceService } = setup({ recorded: [{ status: "pending", amount: 500_000 }], isTakenByAnotherRun: true });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 0 });

      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
    });

    it.each([
      ["the signer proved it did not land", new TxNotIncludedError("EXPIRED_HASH")],
      ["the chain refused the grant", new Error("The chain refused the deployment allowance grant")]
    ])("leaves the refund to be credited by a later run when %s", async (_case, error) => {
      const { service, deploymentAllowanceService, refunds } = setup({ recorded: [{ status: "pending", amount: 500_000 }] });
      deploymentAllowanceService.adjust.mockRejectedValueOnce(error);

      await expect(service.creditTo(USER_WALLET_ID)).rejects.toBe(error);
      expect(refunds()[0]).toMatchObject({ status: "pending" });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 1, needsReview: 0 });
    });

    it("counts a credit the signer could not decide but gave a hash for as sent, since that write is watched and repeated if it never lands", async () => {
      const { service, deploymentAllowanceService, refunds } = setup({ recorded: [{ status: "pending", amount: 500_000 }] });
      deploymentAllowanceService.adjust.mockRejectedValue(new TxOutcomeUnknownError("CREDIT_HASH"));

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 1, needsReview: 0 });

      expect(refunds()[0]).toMatchObject({ status: "credited" });
    });

    it("asks for a review when the signer could not decide a credit and gave no hash for it", async () => {
      const { service, deploymentAllowanceService, refunds, logger } = setup({ recorded: [{ status: "pending", amount: 500_000 }] });
      deploymentAllowanceService.adjust.mockRejectedValue(new TxOutcomeUnknownError());

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 0, needsReview: 1 });

      expect(refunds()[0]).toMatchObject({ status: "failed", failure: "the signer could not tell whether the credit was sent" });
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("credits what was returned to each funding wallet the user moved off", async () => {
      const { service, moves, deploymentAllowanceHistoryRepository, refunds } = setup({
        moveCount: 2,
        returned: [{ txHash: "CLOSE_A", msgIndex: 0, receivedByGranter: ["500000uact"] }]
      });

      await expect(service.creditTo(USER_WALLET_ID)).resolves.toEqual({ credited: 2, needsReview: 0 });

      expect(deploymentAllowanceHistoryRepository.findRefundsLeftWithGranter.mock.calls.map(([query]) => query.granter)).toEqual(
        moves.map(move => move.fromAddress)
      );
      expect(refunds().map(refund => refund.moveId)).toEqual(moves.map(move => move.id));
    });
  });

  describe("queueForEveryoneMovedOff", () => {
    it("queues a check for every user wallet whose move off that funding wallet completed", async () => {
      const { service, fundingWallet, fundingWalletRepository, fundingWalletMoveRepository, jobQueueService, logger } = setup({
        movedUserWalletIds: [11, 12, 13]
      });

      await expect(service.queueForEveryoneMovedOff(fundingWallet.address)).resolves.toEqual({ queued: 3 });

      expect(fundingWalletRepository.findByAddress).toHaveBeenCalledWith(NETWORK, fundingWallet.address);
      expect(fundingWalletMoveRepository.findCompletedUserWalletIds).toHaveBeenCalledWith(fundingWallet.id);
      expect(jobQueueService.enqueue.mock.calls).toEqual([11, 12, 13].map(userWalletId => [new CreditReturnedEscrow({ userWalletId })]));
      expect(logger.info).toHaveBeenCalledWith({ event: "RETURNED_ESCROW_CREDITS_QUEUED", network: NETWORK, address: fundingWallet.address, queued: 3 });
    });

    it("refuses a funding wallet the network does not know", async () => {
      const { service, jobQueueService } = setup({ isFundingWalletKnown: false });
      const address = createAkashAddress();

      await expect(service.queueForEveryoneMovedOff(address)).rejects.toMatchObject({
        status: 404,
        message: `Funding wallet ${address} is not registered`,
        network: NETWORK
      });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ReturnedEscrowService.name });
  });

  function setup(
    input: {
      wallet?: null | { address: null };
      moves?: [];
      moveCount?: number;
      returned?: Pick<RefundLeftWithGranter, "txHash" | "msgIndex" | "receivedByGranter">[];
      recorded?: Partial<FundingWalletRefundOutput>[];
      isTakenByAnotherRun?: boolean;
      movedUserWalletIds?: number[];
      isFundingWalletKnown?: boolean;
    } = {}
  ) {
    const wallet = { id: USER_WALLET_ID, address: createAkashAddress() };
    const fundingWallet = { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "retired" as const };
    const moves =
      input.moves ??
      Array.from({ length: input.moveCount ?? 1 }, (_, index) =>
        mock<CompletedFundingWalletMove>({ id: crypto.randomUUID(), fromAddress: createAkashAddress(), readHeight: 1000 + index, status: "completed" })
      );
    let recorded: FundingWalletRefundOutput[] = (input.recorded ?? []).map(refund => ({
      id: crypto.randomUUID(),
      moveId: moves[0].id,
      txHash: "RECORDED_CLOSE",
      msgIndex: 0,
      amount: 0,
      status: "pending",
      failure: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...refund
    }));

    const fundingWalletRepository = mock<FundingWalletRepository>();
    const fundingWalletMoveRepository = mock<FundingWalletMoveRepository>();
    const fundingWalletRefundRepository = mock<FundingWalletRefundRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentAllowanceHistoryRepository = mock<DeploymentAllowanceHistoryRepository>();
    const deploymentAllowanceService = mock<DeploymentAllowanceService>();
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    userWalletRepository.findById.mockResolvedValue(
      input.wallet === null ? undefined : mock<UserWalletOutput>({ id: USER_WALLET_ID, address: input.wallet ? null : wallet.address })
    );
    fundingWalletRepository.findByAddress.mockResolvedValue(input.isFundingWalletKnown === false ? undefined : fundingWallet);
    fundingWalletMoveRepository.findCompletedOf.mockResolvedValue(moves);
    fundingWalletMoveRepository.findCompletedUserWalletIds.mockResolvedValue(input.movedUserWalletIds ?? []);
    deploymentAllowanceHistoryRepository.findRefundsLeftWithGranter.mockResolvedValue(
      (input.returned ?? []).map(returned => ({ height: 2000, dseq: "1", ...returned }))
    );
    fundingWalletRefundRepository.recordUnlessKnown.mockImplementation(async returned => {
      const isKnown = recorded.some(refund => refund.moveId === returned.moveId && refund.txHash === returned.txHash && refund.msgIndex === returned.msgIndex);

      if (!isKnown) recorded.push({ id: crypto.randomUUID(), status: "pending", failure: null, createdAt: NOW, updatedAt: NOW, ...returned });
    });
    fundingWalletRefundRepository.findByMove.mockImplementation(async moveId => recorded.filter(refund => refund.moveId === moveId));
    fundingWalletRefundRepository.updateFrom.mockImplementation(async (id, status, patch) => {
      const current = recorded.find(refund => refund.id === id);

      if (!current || current.status !== status || input.isTakenByAnotherRun) return undefined;

      const updated = { ...current, ...patch };
      recorded = recorded.map(refund => (refund.id === id ? updated : refund));

      return updated;
    });
    deploymentAllowanceService.adjust.mockResolvedValue({ previousLimit: 0, nextLimit: 0, txHash: "CREDIT_HASH" });

    const service = new ReturnedEscrowService(
      fundingWalletRepository,
      fundingWalletMoveRepository,
      fundingWalletRefundRepository,
      userWalletRepository,
      deploymentAllowanceHistoryRepository,
      deploymentAllowanceService,
      jobQueueService,
      mockConfigService<BillingConfigService>({ DEPLOYMENT_GRANT_DENOM: "uact" }),
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return {
      service,
      wallet,
      fundingWallet,
      moves,
      refunds: () => recorded,
      fundingWalletRepository,
      fundingWalletMoveRepository,
      fundingWalletRefundRepository,
      deploymentAllowanceHistoryRepository,
      deploymentAllowanceService,
      jobQueueService,
      logger,
      createLogger
    };
  }
});
