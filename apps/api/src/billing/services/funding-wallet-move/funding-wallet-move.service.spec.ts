import type { AuthzHttpService, FeeAllowance } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import type { FundingWalletMoveOutput, FundingWalletMoveRepository } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { CreateLogger } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { FundingWalletMoveService } from "./funding-wallet-move.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const NETWORK = "sandbox";
const SIGNER_TIMEOUT_MS = 180_000;
const NOW = new Date("2026-11-27T12:00:00.000Z");
const LATE_GRANTS_END_MS = SIGNER_TIMEOUT_MS + 60_000;
const REVOKE_DEPOSIT: EncodeObject = { typeUrl: "/revoke-deposit", value: {} };
const REVOKE_FEES: EncodeObject = { typeUrl: "/revoke-fees", value: {} };
const FEE_EXPIRATION = "2026-12-20T00:00:00.000Z";

describe(FundingWalletMoveService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("when there is nothing to move", () => {
    it("does nothing while no funding wallet is draining", async () => {
      const { service, balancesService, managedSignerService } = setup({ draining: null });

      await expect(service.moveToActive(7)).resolves.toBe("nothing_to_move");

      expect(balancesService.retrieveDeploymentLimitAtLatestHeight).not.toHaveBeenCalled();
      expect(managedSignerService.executeFundingTx).not.toHaveBeenCalled();
    });

    it("does nothing while no funding wallet is active to move to", async () => {
      const { service, fundingWalletMoveRepository } = setup({ active: null });

      await expect(service.moveToActive(7)).resolves.toBe("nothing_to_move");

      expect(fundingWalletMoveRepository.createUnlessStarted).not.toHaveBeenCalled();
    });

    it.each([
      ["does not exist", null],
      ["has no address yet", { address: null }]
    ])("does nothing for a user wallet that %s", async (_case, wallet) => {
      const { service, fundingWalletMoveRepository } = setup({ wallet });

      await expect(service.moveToActive(7)).resolves.toBe("nothing_to_move");

      expect(fundingWalletMoveRepository.createUnlessStarted).not.toHaveBeenCalled();
    });
  });

  describe("while a grant signed before the promotion can still land", () => {
    it("refuses to move and says when it may", async () => {
      const { service, fundingWalletMoveRepository } = setup({ drainingForMs: LATE_GRANTS_END_MS - 1 });

      await expect(service.moveToActive(7)).rejects.toMatchObject({
        status: 503,
        message: "A grant signed before the promotion can still land on the draining funding wallet",
        retryAt: new Date(NOW.getTime() + 1).toISOString()
      });

      expect(fundingWalletMoveRepository.createUnlessStarted).not.toHaveBeenCalled();
    });

    it("moves from the moment that time has passed", async () => {
      const { service } = setup({ drainingForMs: LATE_GRANTS_END_MS });

      await expect(service.moveToActive(7)).resolves.toBe("moved");
    });
  });

  describe("moving a user wallet", () => {
    it("saves the balance and fee allowance read on the draining wallet before anything is revoked", async () => {
      const { service, wallet, draining, active, balancesService, authzHttpService, fundingWalletMoveRepository, calls } = setup({
        chain: { depositLimit: 5_000_000, readHeight: 1234, feeLimit: 700_000, feeExpiration: FEE_EXPIRATION }
      });

      await service.moveToActive(wallet.id);

      expect(balancesService.retrieveDeploymentLimitAtLatestHeight).toHaveBeenCalledWith(
        { id: wallet.id, address: wallet.address },
        {
          granter: draining.address
        }
      );
      expect(authzHttpService.getFeeAllowanceForGranterAndGrantee).toHaveBeenCalledWith(draining.address, wallet.address);
      expect(fundingWalletMoveRepository.createUnlessStarted).toHaveBeenCalledWith({
        userWalletId: wallet.id,
        network: NETWORK,
        fromFundingWalletId: draining.id,
        toFundingWalletId: active.id,
        status: "revoking",
        readLimit: 5_000_000,
        readHeight: 1234,
        feeLimit: 700_000,
        feeExpiresAt: new Date(FEE_EXPIRATION)
      });
      expect(calls.indexOf("createUnlessStarted")).toBeLessThan(calls.indexOf("executeFundingTx"));
    });

    it("removes both grants of the draining wallet in one transaction, then points the user at the active wallet and credits there", async () => {
      const { service, wallet, draining, active, managedSignerService, rpcMessageService, fundingWalletRepository, calls, currentMove } = setup({
        chain: { depositLimit: 5_000_000, feeLimit: 700_000 }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(rpcMessageService.getRevokeDepositDeploymentGrantMsg).toHaveBeenCalledWith({ granter: draining.address, grantee: wallet.address });
      expect(rpcMessageService.getRevokeAllowanceMsg).toHaveBeenCalledWith({ granter: draining.address, grantee: wallet.address });
      expect(managedSignerService.executeFundingTx).toHaveBeenCalledTimes(1);
      expect(managedSignerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_DEPOSIT, REVOKE_FEES]);
      expect(fundingWalletRepository.reassign).toHaveBeenCalledWith({ userWalletId: wallet.id, network: NETWORK, fundingWalletId: active.id });
      expect(calls).toEqual([
        "createUnlessStarted",
        "update:revokeSentAt",
        "executeFundingTx",
        "update:revoked",
        "reassign",
        "authorizeSpending",
        "update:crediting",
        "adjust",
        "watch",
        "update:completed"
      ]);
      expect(currentMove()).toMatchObject({ status: "completed", revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW, failure: null });
    });

    it("grants the fee allowance again as it was, and adds the saved balance through a write that is repeated if it never lands", async () => {
      const { service, wallet, managedUserWalletService, managedSignerService, deploymentAllowanceService } = setup({
        chain: { depositLimit: 5_000_000, feeLimit: 700_000, feeExpiration: FEE_EXPIRATION }
      });

      await service.moveToActive(wallet.id);

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(managedSignerService, {
        address: wallet.address,
        derivationIndex: wallet.id,
        limits: { fees: 700_000 },
        expiration: new Date(FEE_EXPIRATION)
      });
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith({ id: wallet.id, address: wallet.address }, 5_000_000, { redo: true });
    });

    it("has what changed on the old grant between the read and the revoke replayed against the draining wallet", async () => {
      const { service, wallet, draining, deploymentAllowanceService } = setup({ chain: { depositLimit: 5_000_000, readHeight: 1234 } });

      await service.moveToActive(wallet.id);

      expect(deploymentAllowanceService.watch).toHaveBeenCalledWith(
        { id: wallet.id, address: wallet.address },
        {
          txHash: "REVOKE_HASH",
          readHeight: 1234,
          readLimit: 5_000_000,
          sentAt: NOW.toISOString(),
          granter: draining.address
        }
      );
    });

    it("grants a fee allowance without expiry when the old one had none", async () => {
      const { service, wallet, managedUserWalletService } = setup({ chain: { feeLimit: 700_000 } });

      await service.moveToActive(wallet.id);

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limits: { fees: 700_000 }, expiration: undefined })
      );
    });

    it("reads only the uakt part of the fee allowance", async () => {
      const { service, wallet, fundingWalletMoveRepository } = setup({ chain: { feeLimit: 700_000, otherFeeDenomLimit: 9 } });

      await service.moveToActive(wallet.id);

      expect(fundingWalletMoveRepository.createUnlessStarted).toHaveBeenCalledWith(expect.objectContaining({ feeLimit: 700_000, feeExpiresAt: null }));
    });

    it("moves a user with a balance and no fee allowance without granting fees", async () => {
      const { service, wallet, managedSignerService, managedUserWalletService, deploymentAllowanceService } = setup({ chain: { depositLimit: 5_000_000 } });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedSignerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_DEPOSIT]);
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledTimes(1);
    });

    it("moves a user with a fee allowance and no balance without touching the deployment allowance", async () => {
      const { service, wallet, managedSignerService, managedUserWalletService, deploymentAllowanceService, calls, currentMove } = setup({
        chain: { feeLimit: 700_000 }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedSignerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_FEES]);
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledTimes(1);
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.watch).not.toHaveBeenCalled();
      expect(calls).not.toContain("update:crediting");
      expect(currentMove()).toMatchObject({ status: "completed" });
    });

    it("points a user with no grant on the draining wallet at the active one without sending anything", async () => {
      const { service, wallet, active, managedSignerService, managedUserWalletService, deploymentAllowanceService, fundingWalletRepository, calls } = setup();

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedSignerService.executeFundingTx).not.toHaveBeenCalled();
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(fundingWalletRepository.reassign).toHaveBeenCalledWith(expect.objectContaining({ fundingWalletId: active.id }));
      expect(calls).toEqual(["createUnlessStarted", "update:revoked", "reassign", "update:completed"]);
    });

    it("logs the completed move", async () => {
      const { service, wallet, logger, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });

      await service.moveToActive(wallet.id);

      expect(logger.info).toHaveBeenCalledWith({
        event: "FUNDING_WALLET_MOVE_COMPLETED",
        userWalletId: wallet.id,
        moveId: currentMove()!.id,
        readLimit: 5_000_000
      });
    });
  });

  describe("when the revoke fails", () => {
    it("stops before pointing the user anywhere when the chain refuses the revoke", async () => {
      const { service, wallet, managedSignerService, fundingWalletRepository, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      managedSignerService.executeFundingTx.mockResolvedValue({ code: 5, hash: "REFUSED_HASH", rawLog: "" });

      await expect(service.moveToActive(wallet.id)).rejects.toMatchObject({
        status: 502,
        message: "The chain refused to revoke the grants of the draining funding wallet",
        txHash: "REFUSED_HASH"
      });

      expect(fundingWalletRepository.reassign).not.toHaveBeenCalled();
      expect(currentMove()).toMatchObject({ status: "revoking", revokeTxHash: null });
    });

    it("keeps the hash of a revoke the signer could not decide, and stays at revoking", async () => {
      const { service, wallet, managedSignerService, fundingWalletRepository, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      managedSignerService.executeFundingTx.mockRejectedValue(new TxOutcomeUnknownError("UNDECIDED_HASH"));

      await expect(service.moveToActive(wallet.id)).rejects.toBeInstanceOf(TxOutcomeUnknownError);

      expect(fundingWalletRepository.reassign).not.toHaveBeenCalled();
      expect(currentMove()).toMatchObject({ status: "revoking", revokeTxHash: "UNDECIDED_HASH" });
    });

    it.each([
      ["the signer could not decide and gave no hash", new TxOutcomeUnknownError()],
      ["the signer proved it did not land", new TxNotIncludedError("EXPIRED_HASH")],
      ["the signer could not be reached", new Error("connect ECONNREFUSED")]
    ])("records no hash when %s", async (_case, error) => {
      const { service, wallet, managedSignerService, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      managedSignerService.executeFundingTx.mockRejectedValue(error);

      await expect(service.moveToActive(wallet.id)).rejects.toBe(error);

      expect(currentMove()).toMatchObject({ status: "revoking", revokeTxHash: null });
    });
  });

  describe("resuming a move", () => {
    it("goes on to the credit with the saved balance when the earlier revoke did land", async () => {
      const { service, wallet, draining, managedSignerService, deploymentAllowanceService, balancesService, calls } = setup({
        move: { status: "revoking", readLimit: 4_000_000, readHeight: 900, revokeTxHash: "UNDECIDED_HASH", revokeSentAt: new Date("2026-11-27T11:50:00.000Z") }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(balancesService.retrieveDeploymentLimitAtLatestHeight).not.toHaveBeenCalled();
      expect(managedSignerService.executeFundingTx).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith(expect.anything(), 4_000_000, { redo: true });
      expect(deploymentAllowanceService.watch).toHaveBeenCalledWith(expect.anything(), {
        txHash: "UNDECIDED_HASH",
        readHeight: 900,
        readLimit: 4_000_000,
        sentAt: "2026-11-27T11:50:00.000Z",
        granter: draining.address
      });
      expect(calls).not.toContain("createUnlessStarted");
    });

    it("revokes again when the earlier revoke did not land, keeping the balance it saved first", async () => {
      const { service, wallet, managedSignerService, deploymentAllowanceService } = setup({
        chain: { depositLimit: 3_500_000 },
        move: { status: "revoking", readLimit: 4_000_000, readHeight: 900 }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedSignerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_DEPOSIT]);
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith(expect.anything(), 4_000_000, { redo: true });
    });

    it.each([
      ["a balance", { readLimit: 4_000_000, feeLimit: 0 }],
      ["a fee allowance", { readLimit: 0, feeLimit: 700_000 }]
    ])("credits nothing and asks for a review when %s it read is gone though no revoke was ever sent", async (_case, read) => {
      const { service, wallet, deploymentAllowanceService, managedUserWalletService, fundingWalletRepository, currentMove } = setup({
        move: { status: "revoking", readHeight: 900, ...read }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("needs_review");

      expect(fundingWalletRepository.reassign).not.toHaveBeenCalled();
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(currentMove()).toMatchObject({
        status: "failed",
        failure: "the grants read on the draining funding wallet were gone before a revoke was sent, so nothing was credited"
      });
    });

    it("credits the saved balance but asks for a review when it cannot tell which transaction revoked the old grant", async () => {
      const { service, wallet, deploymentAllowanceService, logger, currentMove } = setup({
        move: { status: "revoking", readLimit: 4_000_000, readHeight: 900, revokeSentAt: new Date("2026-11-27T11:50:00.000Z") }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("needs_review");

      expect(deploymentAllowanceService.adjust).toHaveBeenCalledWith(expect.anything(), 4_000_000, { redo: true });
      expect(deploymentAllowanceService.watch).not.toHaveBeenCalled();
      expect(currentMove()).toMatchObject({
        status: "failed",
        failure: "the balance read before the revoke was credited, but what changed on the old grant between that read and the revoke was not replayed"
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "FUNDING_WALLET_MOVE_NEEDS_REVIEW", userWalletId: wallet.id, readLimit: 4_000_000 })
      );
    });

    it.each([
      ["a revoke hash but no time it was sent", { revokeTxHash: "REVOKE_HASH", revokeSentAt: null }],
      ["a time it was sent but no revoke hash", { revokeTxHash: null, revokeSentAt: NOW }]
    ])("asks for a review of a credited move that has %s", async (_case, record) => {
      const { service, wallet, deploymentAllowanceService } = setup({ move: { status: "revoked", readLimit: 4_000_000, readHeight: 900, ...record } });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("needs_review");

      expect(deploymentAllowanceService.watch).not.toHaveBeenCalled();
    });

    it("sends the credit of a move that stopped right after its revoke", async () => {
      const { service, wallet, managedSignerService, deploymentAllowanceService } = setup({
        move: { status: "revoked", readLimit: 4_000_000, readHeight: 900, revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedSignerService.executeFundingTx).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledTimes(1);
    });

    it("never sends a credit again for a move that stopped while crediting, and asks for a review instead", async () => {
      const { service, wallet, deploymentAllowanceService, managedUserWalletService, currentMove } = setup({
        move: { status: "crediting", readLimit: 4_000_000, readHeight: 900, revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("needs_review");

      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(currentMove()).toMatchObject({
        status: "failed",
        failure: "the credit on the new funding wallet was interrupted, so it may or may not be on chain"
      });
    });

    it.each([
      ["completed", "moved"],
      ["failed", "needs_review"]
    ] as const)("sends nothing for a move that is %s", async (status, outcome) => {
      const { service, wallet, managedSignerService, deploymentAllowanceService, fundingWalletRepository, calls } = setup({
        move: { status, readLimit: 4_000_000, readHeight: 900 }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe(outcome);

      expect(managedSignerService.executeFundingTx).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(fundingWalletRepository.reassign).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
    });
  });

  describe("when another run works on the same move", () => {
    it("refuses to run while the other run holds the move, and reads or sends nothing", async () => {
      const { service, wallet, authzHttpService, managedSignerService, deploymentAllowanceService, fundingWalletMoveRepository } = setup({
        move: { status: "revoked", readLimit: 4_000_000, readHeight: 900, revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW },
        isClaimedByAnotherRun: true
      });

      await expect(service.moveToActive(wallet.id)).rejects.toMatchObject({
        status: 409,
        message: "Another run is moving this user wallet",
        userWalletId: wallet.id
      });

      expect(authzHttpService.hasDepositDeploymentGrant).not.toHaveBeenCalled();
      expect(managedSignerService.executeFundingTx).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
      expect(fundingWalletMoveRepository.release).not.toHaveBeenCalled();
    });

    it("holds the move for four signer timeouts and gives it back when done", async () => {
      const { service, wallet, fundingWalletMoveRepository, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });

      await service.moveToActive(wallet.id);

      expect(fundingWalletMoveRepository.claim).toHaveBeenCalledWith(currentMove()!.id, (4 * SIGNER_TIMEOUT_MS) / 1000);
      expect(fundingWalletMoveRepository.release).toHaveBeenCalledWith(currentMove()!.id);
    });

    it("holds the move for whole seconds", async () => {
      const { service, wallet, fundingWalletMoveRepository } = setup({ signerTimeoutMs: 1_100 });

      await service.moveToActive(wallet.id);

      expect(fundingWalletMoveRepository.claim).toHaveBeenCalledWith(expect.anything(), 5);
    });

    it("gives the move back when the run fails", async () => {
      const { service, wallet, managedSignerService, fundingWalletMoveRepository, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      managedSignerService.executeFundingTx.mockRejectedValue(new Error("connect ECONNREFUSED"));

      await expect(service.moveToActive(wallet.id)).rejects.toThrow("connect ECONNREFUSED");

      expect(fundingWalletMoveRepository.release).toHaveBeenCalledWith(currentMove()!.id);
    });

    it("sends no credit when the move left the state this run saw before it could mark the credit", async () => {
      const { service, wallet, deploymentAllowanceService, currentMove } = setup({
        move: { status: "revoked", readLimit: 4_000_000, readHeight: 900, revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW },
        changedByAnotherRunAt: "crediting"
      });

      await expect(service.moveToActive(wallet.id)).rejects.toMatchObject({
        status: 409,
        message: "Another run changed this move",
        moveId: currentMove()!.id,
        expectedStatus: "revoked"
      });

      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
    });

    it("stops before pointing the user anywhere when the move left the state this run saw while its revoke was out", async () => {
      const { service, wallet, fundingWalletRepository, deploymentAllowanceService } = setup({
        chain: { depositLimit: 5_000_000 },
        changedByAnotherRunAt: "revoked"
      });

      await expect(service.moveToActive(wallet.id)).rejects.toMatchObject({ status: 409, expectedStatus: "revoking" });

      expect(fundingWalletRepository.reassign).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).not.toHaveBeenCalled();
    });
  });

  describe("when the fee allowance expired after it was read", () => {
    it.each([
      ["before now", new Date(NOW.getTime() - 1)],
      ["this instant", NOW]
    ])("grants no fee allowance that expired %s, and still credits the balance", async (_case, feeExpiresAt) => {
      const { service, wallet, managedUserWalletService, deploymentAllowanceService } = setup({
        move: { status: "revoked", readLimit: 4_000_000, readHeight: 900, feeLimit: 700_000, feeExpiresAt, revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledTimes(1);
    });

    it("grants a fee allowance that expires a moment from now", async () => {
      const feeExpiresAt = new Date(NOW.getTime() + 1);
      const { service, wallet, managedUserWalletService } = setup({
        move: { status: "revoked", readLimit: 0, readHeight: 900, feeLimit: 700_000, feeExpiresAt, revokeTxHash: "REVOKE_HASH", revokeSentAt: NOW }
      });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ expiration: feeExpiresAt }));
    });
  });

  describe("when the credit fails", () => {
    it("goes back to revoked, so the credit is sent again, when the failure proves nothing was granted", async () => {
      const refused = new Error("The chain refused the deployment allowance grant");
      const { service, wallet, deploymentAllowanceService, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      deploymentAllowanceService.adjust.mockRejectedValueOnce(refused);

      await expect(service.moveToActive(wallet.id)).rejects.toBe(refused);
      expect(currentMove()).toMatchObject({ status: "revoked" });

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");
      expect(deploymentAllowanceService.adjust).toHaveBeenCalledTimes(2);
    });

    it("counts a credit the signer could not decide but gave a hash for as sent, since that write is watched and repeated if it never lands", async () => {
      const { service, wallet, deploymentAllowanceService, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      deploymentAllowanceService.adjust.mockRejectedValue(new TxOutcomeUnknownError("CREDIT_HASH"));

      await expect(service.moveToActive(wallet.id)).resolves.toBe("moved");

      expect(deploymentAllowanceService.watch).toHaveBeenCalledTimes(1);
      expect(currentMove()).toMatchObject({ status: "completed" });
    });

    it("asks for a review when the signer could not decide a credit and gave no hash for it", async () => {
      const { service, wallet, deploymentAllowanceService, currentMove } = setup({ chain: { depositLimit: 5_000_000 } });
      deploymentAllowanceService.adjust.mockRejectedValue(new TxOutcomeUnknownError());

      await expect(service.moveToActive(wallet.id)).resolves.toBe("needs_review");

      expect(deploymentAllowanceService.watch).not.toHaveBeenCalled();
      expect(currentMove()).toMatchObject({ status: "failed", failure: "the signer could not tell whether the credit on the new funding wallet was sent" });
    });
  });

  it("names itself as the context of its logs", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: FundingWalletMoveService.name });
  });

  function setup(
    input: {
      draining?: null;
      active?: null;
      drainingForMs?: number;
      wallet?: null | { address: null };
      chain?: { depositLimit?: number; readHeight?: number; feeLimit?: number; feeExpiration?: string; otherFeeDenomLimit?: number };
      signerTimeoutMs?: number;
      move?: Partial<FundingWalletMoveOutput>;
      isClaimedByAnotherRun?: boolean;
      changedByAnotherRunAt?: FundingWalletMoveOutput["status"];
    } = {}
  ) {
    vi.useFakeTimers({ now: NOW });

    const calls: string[] = [];
    const chain = { depositLimit: 0, readHeight: 1000, feeLimit: 0, ...input.chain };
    const draining: FundingWalletOutput = { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "draining" };
    const active: FundingWalletOutput = { id: crypto.randomUUID(), network: NETWORK, address: createAkashAddress(), status: "active" };
    const wallet = mock<UserWalletOutput>({ id: 7, address: createAkashAddress() });
    const blankMove: FundingWalletMoveOutput = {
      id: crypto.randomUUID(),
      userWalletId: wallet.id,
      network: NETWORK,
      fromFundingWalletId: draining.id,
      toFundingWalletId: active.id,
      status: "revoking",
      readLimit: 0,
      readHeight: 0,
      feeLimit: 0,
      feeExpiresAt: null,
      revokeSentAt: null,
      revokeTxHash: null,
      failure: null,
      claimedUntil: null,
      createdAt: NOW,
      updatedAt: NOW
    };
    let move: FundingWalletMoveOutput | undefined = input.move && { ...blankMove, ...input.move };

    const fundingWalletRepository = mock<FundingWalletRepository>();
    const fundingWalletMoveRepository = mock<FundingWalletMoveRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const balancesService = mock<BalancesService>();
    const authzHttpService = mock<AuthzHttpService>();
    const rpcMessageService = mock<RpcMessageService>();
    const managedSignerService = mock<ManagedSignerService>();
    const managedUserWalletService = mock<ManagedUserWalletService>();
    const deploymentAllowanceService = mock<DeploymentAllowanceService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    fundingWalletRepository.findDraining.mockResolvedValue(
      input.draining === null ? undefined : { ...draining, drainingSince: new Date(NOW.getTime() - (input.drainingForMs ?? LATE_GRANTS_END_MS + 60_000)) }
    );
    fundingWalletRepository.findActive.mockResolvedValue(input.active === null ? undefined : active);
    fundingWalletRepository.reassign.mockImplementation(async () => {
      calls.push("reassign");
    });
    userWalletRepository.findById.mockResolvedValue(
      input.wallet === null ? undefined : input.wallet ? mock<UserWalletOutput>({ id: 7, address: null }) : wallet
    );
    fundingWalletMoveRepository.findBySource.mockImplementation(async () => move);
    fundingWalletMoveRepository.createUnlessStarted.mockImplementation(async created => {
      calls.push("createUnlessStarted");
      move = { ...blankMove, ...created, feeExpiresAt: created.feeExpiresAt ?? null };
      return move;
    });
    fundingWalletMoveRepository.claim.mockImplementation(async () => (input.isClaimedByAnotherRun ? undefined : move));
    fundingWalletMoveRepository.updateFrom.mockImplementation(async (_id, status, patch) => {
      const isChangedByAnotherRun = !!input.changedByAnotherRunAt && patch.status === input.changedByAnotherRunAt;

      if (move!.status !== status || isChangedByAnotherRun) return undefined;

      calls.push(`update:${patch.status ?? Object.keys(patch).join("+")}`);
      move = { ...move!, ...patch };
      return move;
    });
    balancesService.retrieveDeploymentLimitAtLatestHeight.mockResolvedValue({ limit: chain.depositLimit, height: chain.readHeight, granter: draining.address });
    authzHttpService.hasDepositDeploymentGrant.mockResolvedValue(chain.depositLimit > 0);
    authzHttpService.hasFeeAllowance.mockResolvedValue(chain.feeLimit > 0);
    const feeAllowance: FeeAllowance = {
      granter: draining.address,
      grantee: wallet.address!,
      allowance: {
        "@type": "/cosmos.feegrant.v1beta1.BasicAllowance",
        spend_limit: [
          ...(chain.otherFeeDenomLimit ? [{ denom: "uact" as const, amount: String(chain.otherFeeDenomLimit) }] : []),
          { denom: "uakt" as const, amount: String(chain.feeLimit) }
        ],
        expiration: chain.feeExpiration ?? ""
      }
    };
    authzHttpService.getFeeAllowanceForGranterAndGrantee.mockResolvedValue(chain.feeLimit > 0 ? feeAllowance : undefined);
    rpcMessageService.getRevokeDepositDeploymentGrantMsg.mockReturnValue(REVOKE_DEPOSIT);
    rpcMessageService.getRevokeAllowanceMsg.mockReturnValue(REVOKE_FEES);
    managedSignerService.executeFundingTx.mockImplementation(async () => {
      calls.push("executeFundingTx");
      return { code: 0, hash: "REVOKE_HASH", rawLog: "" };
    });
    managedUserWalletService.authorizeSpending.mockImplementation(async () => {
      calls.push("authorizeSpending");
    });
    deploymentAllowanceService.adjust.mockImplementation(async () => {
      calls.push("adjust");
      return { previousLimit: 0, nextLimit: move!.readLimit, txHash: "CREDIT_HASH" };
    });
    deploymentAllowanceService.watch.mockImplementation(async () => {
      calls.push("watch");
    });

    const service = new FundingWalletMoveService(
      fundingWalletRepository,
      fundingWalletMoveRepository,
      userWalletRepository,
      balancesService,
      authzHttpService,
      rpcMessageService,
      managedSignerService,
      managedUserWalletService,
      deploymentAllowanceService,
      mockConfigService<BillingConfigService>({ TX_SIGNER_REQUEST_TIMEOUT_MS: input.signerTimeoutMs ?? SIGNER_TIMEOUT_MS }),
      mockConfigService<CoreConfigService>({ NETWORK }),
      createLogger
    );

    return {
      service,
      wallet: { id: wallet.id, address: wallet.address! },
      draining,
      active,
      calls,
      currentMove: () => move,
      fundingWalletRepository,
      fundingWalletMoveRepository,
      balancesService,
      authzHttpService,
      rpcMessageService,
      managedSignerService,
      managedUserWalletService,
      deploymentAllowanceService,
      logger,
      createLogger
    };
  }
});
