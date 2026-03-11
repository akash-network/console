import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { faker } from "@faker-js/faker";
import addDays from "date-fns/addDays";
import subDays from "date-fns/subDays";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
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

    txManagerService.getFundingWalletAddress.mockResolvedValue(createAkashAddress());
    authzHttpService.hasFeeAllowance.mockResolvedValue(false);
    rpcMessageService.getFeesAllowanceGrantMsg.mockReturnValue({ typeUrl: "/fee-grant", value: {} } as unknown as EncodeObject);
    signer.executeFundingTx.mockResolvedValue({ code: 0, hash: "hash", rawLog: "[]" } as never);

    const service = new ManagedUserWalletService(config, txManagerService, rpcMessageService, authzHttpService);

    return { service, signer, config, txManagerService, rpcMessageService, authzHttpService };
  }
});
