import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { WalletGrantRevokerService } from "./wallet-grant-revoker.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const GRANTER = "akash1funding";
const REVOKE_DEPOSIT = mock<ReturnType<RpcMessageService["getRevokeDepositDeploymentGrantMsg"]>>({ typeUrl: "/cosmos.authz.v1beta1.MsgRevoke" });
const REVOKE_FEE = mock<ReturnType<RpcMessageService["getRevokeAllowanceMsg"]>>({ typeUrl: "/cosmos.feegrant.v1beta1.MsgRevokeAllowance" });

describe(WalletGrantRevokerService.name, () => {
  describe("revokeDepositGrant", () => {
    it("revokes the deposit grant the funding wallet gave the grantee", async () => {
      const { service, authzHttpService, rpcMessageService, signerService, grantee } = setup({ hasDepositGrant: true });

      await expect(service.revokeDepositGrant(grantee)).resolves.toBe(true);

      expect(authzHttpService.hasDepositDeploymentGrant).toHaveBeenCalledWith(GRANTER, grantee);
      expect(rpcMessageService.getRevokeDepositDeploymentGrantMsg).toHaveBeenCalledWith({ granter: GRANTER, grantee });
      expect(signerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_DEPOSIT]);
    });

    it("skips a deposit grant the chain no longer holds", async () => {
      const { service, signerService, grantee } = setup({ hasDepositGrant: false });

      await expect(service.revokeDepositGrant(grantee)).resolves.toBe(false);

      expect(signerService.executeFundingTx).not.toHaveBeenCalled();
    });
  });

  describe("revokeFeeGrant", () => {
    it("revokes the fee grant the funding wallet gave the grantee", async () => {
      const { service, authzHttpService, rpcMessageService, signerService, grantee } = setup({ hasFeeGrant: true });

      await expect(service.revokeFeeGrant(grantee)).resolves.toBe(true);

      expect(authzHttpService.hasFeeAllowance).toHaveBeenCalledWith(GRANTER, grantee);
      expect(rpcMessageService.getRevokeAllowanceMsg).toHaveBeenCalledWith({ granter: GRANTER, grantee });
      expect(signerService.executeFundingTx).toHaveBeenCalledWith([REVOKE_FEE]);
    });

    it("skips a fee grant the chain no longer holds", async () => {
      const { service, signerService, grantee } = setup({ hasFeeGrant: false });

      await expect(service.revokeFeeGrant(grantee)).resolves.toBe(false);

      expect(signerService.executeFundingTx).not.toHaveBeenCalled();
    });

    it.each([
      ["in its message", new Error("failed to execute message; message index: 0: fee allowance Not Found")],
      ["in the error it wraps", Object.assign(new Error("Broadcast failed"), { originalError: new Error("authorization not found") })]
    ])("treats a revoke the chain reports as already gone %s as revoked", async (_, error) => {
      const { service, signerService, grantee } = setup({ hasFeeGrant: true });
      signerService.executeFundingTx.mockRejectedValue(error);

      await expect(service.revokeFeeGrant(grantee)).resolves.toBe(true);
    });

    it.each([
      ["any other chain failure", new Error("account sequence mismatch")],
      ["a wrapped error that is not an error", Object.assign(new Error("Broadcast failed"), { originalError: "not found" })],
      ["a thrown value that is not an error", "not found"]
    ])("passes on %s", async (_, error) => {
      const { service, signerService, grantee } = setup({ hasFeeGrant: true });
      signerService.executeFundingTx.mockRejectedValue(error);

      await expect(service.revokeFeeGrant(grantee)).rejects.toBe(error);
    });
  });

  function setup(input: { hasDepositGrant?: boolean; hasFeeGrant?: boolean }) {
    const grantee = createAkashAddress();
    const txManagerService = mock<TxManagerService>();
    txManagerService.getFundingWalletAddress.mockResolvedValue(GRANTER);
    const authzHttpService = mock<AuthzHttpService>();
    authzHttpService.hasDepositDeploymentGrant.mockResolvedValue(input.hasDepositGrant ?? false);
    authzHttpService.hasFeeAllowance.mockResolvedValue(input.hasFeeGrant ?? false);
    const rpcMessageService = mock<RpcMessageService>();
    rpcMessageService.getRevokeDepositDeploymentGrantMsg.mockReturnValue(REVOKE_DEPOSIT);
    rpcMessageService.getRevokeAllowanceMsg.mockReturnValue(REVOKE_FEE);
    const signerService = mock<ManagedSignerService>();
    signerService.executeFundingTx.mockResolvedValue(mock<Awaited<ReturnType<ManagedSignerService["executeFundingTx"]>>>());
    const service = new WalletGrantRevokerService(txManagerService, authzHttpService, rpcMessageService, signerService);

    return { service, grantee, authzHttpService, rpcMessageService, signerService };
  }
});
