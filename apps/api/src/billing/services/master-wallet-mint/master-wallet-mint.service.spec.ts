import { MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { BmeHttpService } from "@akashnetwork/http-sdk";
import { Ok } from "ts-results";
import { describe, expect, it } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { TimerService } from "@src/core/services/timer/timer.service";
import { MasterWalletMintService } from "./master-wallet-mint.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBankBalancesResponse } from "@test/seeders/bank-balances-response.seeder";
import { createBmeLedgerRecord, createBmeLedgerResponse } from "@test/seeders/bme-ledger-record.seeder";
import { createDenomExchangeRate } from "@test/seeders/denom-exchange-rate.seeder";

describe(MasterWalletMintService.name, () => {
  describe("mintExcessAkt", () => {
    it("skips when a previous mint is still settling", async () => {
      const { service, chainSdk, txManagerService } = setup({
        balances: { uact: 5_000_000_000, uakt: 50_000_000_000 }
      });
      chainSdk.akash.bme.v1.getLedgerRecords.mockResolvedValueOnce(createBmeLedgerResponse({ records: [createBmeLedgerRecord({ status: 1 })] }));

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(chainSdk.cosmos.bank.v1beta1.getAllBalances).not.toHaveBeenCalled();
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("warns and skips when AKT balance is below the reserve", async () => {
      const { service, txManagerService, denomExchangeService } = setup({
        aktReserve: 2_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 1_500_000_000 }
      });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("skips when AKT balance exactly equals the reserve", async () => {
      const { service, txManagerService, denomExchangeService } = setup({
        aktReserve: 2_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 2_000_000_000 }
      });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(denomExchangeService.getExchangeRateToUSD).not.toHaveBeenCalled();
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("skips when excess is below the BME minimum mint", async () => {
      const { service, txManagerService } = setup({
        aktReserve: 2_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 2_010_000_000 },
        aktPrice: 0.5
      });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("burns the full excess above the reserve when under the per-run cap", async () => {
      const { service, masterAddress, chainSdk, rpcMessageService } = setup({
        aktReserve: 2_000_000_000,
        maxMintUakt: 5_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });
      mockBalancesOnce(chainSdk, { uact: 7_000_000_000, uakt: 2_000_000_000 });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(rpcMessageService.getMintACTMsg).toHaveBeenCalledWith({
        owner: masterAddress,
        amount: 6_000_000_000 - 2_000_000_000
      });
    });

    it("caps the burn at the per-run maximum when excess exceeds it", async () => {
      const { service, masterAddress, chainSdk, rpcMessageService } = setup({
        aktReserve: 2_000_000_000,
        maxMintUakt: 5_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 50_000_000_000 },
        aktPrice: 0.5
      });
      mockBalancesOnce(chainSdk, { uact: 8_000_000_000, uakt: 45_000_000_000 });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(rpcMessageService.getMintACTMsg).toHaveBeenCalledWith({
        owner: masterAddress,
        amount: 5_000_000_000
      });
    });

    it("falls back to default minimum mint when uact denom is absent from BME params", async () => {
      const { service, bmeHttpService, chainSdk, rpcMessageService, masterAddress } = setup({
        aktReserve: 2_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 2_100_000_000 },
        aktPrice: 0.5
      });
      bmeHttpService.getParams.mockResolvedValue({ params: { min_mint: [{ denom: "uother", amount: "500000" }] } });
      mockBalancesOnce(chainSdk, { uact: 6_000_000_000, uakt: 2_000_000_000 });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(rpcMessageService.getMintACTMsg).toHaveBeenCalledWith({
        owner: masterAddress,
        amount: 100_000_000
      });
    });

    it("fails when AKT price is invalid", async () => {
      const { service, denomExchangeService } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 }
      });
      denomExchangeService.getExchangeRateToUSD.mockResolvedValue(createDenomExchangeRate({ price: 0 }));

      const result = await service.mintExcessAkt();

      expect(result.err).toBe(true);
      expect(result.val).toBe("Invalid AKT price: 0");
    });

    it("fails when mint transaction returns a non-zero code", async () => {
      const { service, txManagerService } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });
      txManagerService.signAndBroadcastWithFundingWallet.mockResolvedValue({ code: 11, hash: "FAIL", rawLog: "insufficient funds" });

      const result = await service.mintExcessAkt();

      expect(result.err).toBe(true);
      expect(result.val).toBe("Transaction failed with code 11: insufficient funds");
    });

    it("waits for ledger settlement before confirming mint", async () => {
      const { service, chainSdk } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });
      mockBalancesOnce(chainSdk, { uact: 7_000_000_000, uakt: 2_000_000_000 });

      const pendingRecord = createBmeLedgerRecord({ status: 1 });
      chainSdk.akash.bme.v1.getLedgerRecords
        .mockResolvedValueOnce(createBmeLedgerResponse())
        .mockResolvedValueOnce(createBmeLedgerResponse({ records: [pendingRecord] }))
        .mockResolvedValueOnce(createBmeLedgerResponse());

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(chainSdk.akash.bme.v1.getLedgerRecords).toHaveBeenCalledTimes(3);
    });

    it("fails when ledger settlement times out", async () => {
      const { service, chainSdk } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });
      chainSdk.akash.bme.v1.getLedgerRecords.mockResolvedValueOnce(createBmeLedgerResponse());
      chainSdk.akash.bme.v1.getLedgerRecords.mockResolvedValue(createBmeLedgerResponse({ records: [createBmeLedgerRecord({ status: 1 })] }));

      const result = await service.mintExcessAkt();

      expect(result.err).toBe(true);
      expect(result.val).toBe("Ledger polling timed out waiting for mint settlement");
    });

    it("keeps polling until ACT balance reaches expected after mint", async () => {
      const { service, chainSdk } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });
      mockBalancesOnce(chainSdk, { uact: 5_000_000_000, uakt: 2_000_000_000 });
      mockBalancesOnce(chainSdk, { uact: 7_000_000_000, uakt: 2_000_000_000 });

      const result = await service.mintExcessAkt();

      expect(result).toEqual(Ok.EMPTY);
      expect(chainSdk.cosmos.bank.v1beta1.getAllBalances).toHaveBeenCalledTimes(3);
    });

    it("fails when ACT balance stays below expected after retries", async () => {
      const { service, chainSdk } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });
      chainSdk.cosmos.bank.v1beta1.getAllBalances.mockResolvedValue(
        createBankBalancesResponse({
          balances: [
            { denom: "uact", amount: String(5_000_000_000) },
            { denom: "uakt", amount: String(2_000_000_000) }
          ]
        })
      );

      const result = await service.mintExcessAkt();

      expect(result.err).toBe(true);
      expect(result.val).toBe("ACT balance still below expected after mint");
    });

    it("skips broadcasting when dry-run is enabled", async () => {
      const { service, txManagerService } = setup({
        balances: { uact: 5_000_000_000, uakt: 6_000_000_000 },
        aktPrice: 0.5
      });

      const result = await service.mintExcessAkt({ dryRun: true });

      expect(result).toEqual(Ok.EMPTY);
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });
  });

  function mockBalancesOnce(chainSdk: ReturnType<typeof setup>["chainSdk"], amounts: { uact: number; uakt: number }) {
    chainSdk.cosmos.bank.v1beta1.getAllBalances.mockResolvedValueOnce(
      createBankBalancesResponse({
        balances: [
          { denom: "uact", amount: String(amounts.uact) },
          { denom: "uakt", amount: String(amounts.uakt) }
        ]
      })
    );
  }

  function setup(input: { aktReserve?: number; maxMintUakt?: number; balances?: { uact: number; uakt: number }; aktPrice?: number }) {
    const billingConfig = mock<BillingConfigService>();
    billingConfig.get.calledWith("MASTER_WALLET_AKT_RESERVE").mockReturnValue(input.aktReserve ?? 2_000_000_000);
    billingConfig.get.calledWith("MASTER_WALLET_MAX_MINT_UAKT").mockReturnValue(input.maxMintUakt ?? 5_000_000_000);

    const masterAddress = createAkashAddress();
    const txManagerService = mock<TxManagerService>();
    txManagerService.getFundingWalletAddress.mockResolvedValue(masterAddress);

    const chainSdk = mockDeep<ChainSDK>();

    if (input.balances) {
      chainSdk.cosmos.bank.v1beta1.getAllBalances.mockResolvedValueOnce(
        createBankBalancesResponse({
          balances: [
            { denom: "uact", amount: String(input.balances.uact) },
            { denom: "uakt", amount: String(input.balances.uakt) }
          ]
        })
      );
    }

    chainSdk.akash.bme.v1.getLedgerRecords.mockResolvedValue(createBmeLedgerResponse());

    const denomExchangeService = mock<DenomExchangeService>();
    if (input.aktPrice !== undefined) {
      denomExchangeService.getExchangeRateToUSD.mockResolvedValue(createDenomExchangeRate({ price: input.aktPrice }));
    }

    const bmeHttpService = mock<BmeHttpService>();
    bmeHttpService.getParams.mockResolvedValue({ params: { min_mint: [{ denom: "uact", amount: "10000000" }] } });

    const rpcMessageService = mock<RpcMessageService>();
    rpcMessageService.getMintACTMsg.mockReturnValue({
      typeUrl: `/${MsgMintACT.$type}`,
      value: MsgMintACT.fromPartial({ owner: masterAddress, to: masterAddress, coinsToBurn: { denom: "uakt", amount: "0" } })
    });

    txManagerService.signAndBroadcastWithFundingWallet.mockResolvedValue({ code: 0, hash: "AABB", rawLog: "" });

    const timerService = mock<TimerService>();
    timerService.delay.mockResolvedValue(undefined);

    const service = new MasterWalletMintService(
      billingConfig,
      txManagerService,
      chainSdk,
      denomExchangeService,
      bmeHttpService,
      rpcMessageService,
      timerService
    );

    return { service, masterAddress, billingConfig, txManagerService, chainSdk, denomExchangeService, bmeHttpService, rpcMessageService, timerService };
  }
});
