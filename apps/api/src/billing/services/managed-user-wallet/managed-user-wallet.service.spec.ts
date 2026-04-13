import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import addDays from "date-fns/addDays";
import subDays from "date-fns/subDays";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { ManagedSignerService } from "../managed-signer/managed-signer.service";
import type { RpcMessageService } from "../rpc-message-service/rpc-message.service";
import { ManagedUserWalletService } from "./managed-user-wallet.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(ManagedUserWalletService.name, () => {
  describe("refillWalletFees", () => {
    it("throws 402 when wallet address is missing", async () => {
      const { service, signer } = setup();

      await expect(service.refillWalletFees(signer, { address: null, isTrialing: false, createdAt: faker.date.past() })).rejects.toMatchObject({
        status: 402
      });
    });

    it("authorizes fee spending without expiration for non-trialing wallet", async () => {
      const { service, signer, config, rpcMessageService } = setup();
      const wallet = { address: createAkashAddress(), isTrialing: false, createdAt: faker.date.past() };

      await service.refillWalletFees(signer, wallet);

      expect(rpcMessageService.getFeesAllowanceGrantMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          grantee: wallet.address,
          limit: config.FEE_ALLOWANCE_REFILL_AMOUNT,
          expiration: undefined
        })
      );
    });

    it("authorizes fee spending with expiration for trialing wallet in trial window", async () => {
      const { service, signer, config, rpcMessageService } = setup();
      const createdAt = subDays(new Date(), 1);
      const wallet = { address: createAkashAddress(), isTrialing: true, createdAt };

      await service.refillWalletFees(signer, wallet);

      const expectedExpiration = addDays(createdAt, config.TRIAL_ALLOWANCE_EXPIRATION_DAYS);
      expect(rpcMessageService.getFeesAllowanceGrantMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          expiration: expectedExpiration
        })
      );
    });

    it("authorizes fee spending without expiration for trialing wallet outside trial window", async () => {
      const { service, signer, config, rpcMessageService } = setup();
      const createdAt = subDays(new Date(), config.TRIAL_ALLOWANCE_EXPIRATION_DAYS + 1);
      const wallet = { address: createAkashAddress(), isTrialing: true, createdAt };

      await service.refillWalletFees(signer, wallet);

      expect(rpcMessageService.getFeesAllowanceGrantMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          expiration: undefined
        })
      );
    });
  });

  describe("fee grant silent-drop recovery", () => {
    it("verifies the grant landed after a batched revoke+grant tx", async () => {
      const { service, signer, rpcMessageService, authzHttpService, logger } = setup();
      const wallet = { address: createAkashAddress(), isTrialing: false, createdAt: faker.date.past() };

      authzHttpService.hasFeeAllowance.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      await service.refillWalletFees(signer, wallet);

      expect(authzHttpService.hasFeeAllowance).toHaveBeenCalledTimes(2);
      expect(rpcMessageService.getRevokeAllowanceMsg).toHaveBeenCalledTimes(1);
      expect(signer.executeFundingTx).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalledWith(expect.objectContaining({ event: "FEE_GRANT_SILENTLY_DROPPED" }));
      expect(logger.error).not.toHaveBeenCalledWith(expect.objectContaining({ event: "FEE_GRANT_REISSUE_FAILED" }));
    });

    it("re-issues the grant when the post-tx check reports it missing", async () => {
      const { service, signer, rpcMessageService, authzHttpService, logger } = setup();
      const wallet = { address: createAkashAddress(), isTrialing: false, createdAt: faker.date.past() };
      const grantMsg = { typeUrl: "/fee-grant", value: {} } as unknown as EncodeObject;

      rpcMessageService.getFeesAllowanceGrantMsg.mockReturnValue(grantMsg);
      authzHttpService.hasFeeAllowance
        .mockResolvedValueOnce(true) // pre-tx: prior allowance exists, revoke is batched
        .mockResolvedValueOnce(false) // post-tx: grant silently dropped
        .mockResolvedValueOnce(true); // post-retry: grant re-issued successfully

      await service.refillWalletFees(signer, wallet);

      expect(authzHttpService.hasFeeAllowance).toHaveBeenCalledTimes(3);
      expect(signer.executeFundingTx).toHaveBeenCalledTimes(2);
      expect(signer.executeFundingTx).toHaveBeenNthCalledWith(2, [grantMsg]);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "FEE_GRANT_SILENTLY_DROPPED" }));
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).not.toHaveBeenCalledWith(expect.objectContaining({ event: "FEE_GRANT_REISSUE_FAILED" }));
    });

    it("throws BadGateway after the retry policy is exhausted", async () => {
      const { service, signer, authzHttpService, logger } = setup();
      const wallet = { address: createAkashAddress(), isTrialing: false, createdAt: faker.date.past() };

      authzHttpService.hasFeeAllowance.mockResolvedValueOnce(true).mockResolvedValue(false);

      await expect(service.refillWalletFees(signer, wallet)).rejects.toMatchObject({ status: 502 });

      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "FEE_GRANT_SILENTLY_DROPPED" }));
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "FEE_GRANT_REISSUE_FAILED" }));
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it("skips post-tx verification when no prior allowance existed", async () => {
      const { service, signer, rpcMessageService, authzHttpService, logger } = setup();
      const wallet = { address: createAkashAddress(), isTrialing: false, createdAt: faker.date.past() };

      authzHttpService.hasFeeAllowance.mockResolvedValue(false);

      await service.refillWalletFees(signer, wallet);

      expect(authzHttpService.hasFeeAllowance).toHaveBeenCalledTimes(1);
      expect(rpcMessageService.getRevokeAllowanceMsg).not.toHaveBeenCalled();
      expect(signer.executeFundingTx).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const config: BillingConfig = {
      TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: 500000,
      TRIAL_FEES_ALLOWANCE_AMOUNT: 100000,
      TRIAL_ALLOWANCE_EXPIRATION_DAYS: 14,
      FEE_ALLOWANCE_REFILL_AMOUNT: 200000,
      DEPLOYMENT_GRANT_DENOM: "uakt"
    } as BillingConfig;

    const txManagerService = mock<TxManagerService>();
    const rpcMessageService = mock<RpcMessageService>();
    const authzHttpService = mock<AuthzHttpService>();
    const signer = mock<ManagedSignerService>();
    const logger = mock<LoggerService>();

    txManagerService.getFundingWalletAddress.mockResolvedValue(createAkashAddress());
    authzHttpService.hasFeeAllowance.mockResolvedValue(false);
    rpcMessageService.getFeesAllowanceGrantMsg.mockReturnValue({ typeUrl: "/fee-grant", value: {} } as unknown as EncodeObject);
    rpcMessageService.getRevokeAllowanceMsg.mockReturnValue({ typeUrl: "/fee-revoke", value: {} } as unknown as EncodeObject);
    signer.executeFundingTx.mockResolvedValue({ code: 0, hash: "hash", rawLog: "[]" } as never);

    const service = new ManagedUserWalletService(config, txManagerService, rpcMessageService, authzHttpService, logger);

    return { service, signer, config, txManagerService, rpcMessageService, authzHttpService, logger };
  }
});
