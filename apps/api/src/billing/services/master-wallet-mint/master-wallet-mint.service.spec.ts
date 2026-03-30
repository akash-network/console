import { MsgMintACT } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { BmeHttpService } from "@akashnetwork/http-sdk";
import { Ok } from "ts-results";
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
  describe("mintIfNeeded", () => {
    it("should skip minting when ACT balance exceeds target", async () => {
      const { service, txManagerService } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 15_000_000_000, uakt: 50_000_000_000 }
      });

      const result = await service.mintIfNeeded();

      expect(result).toEqual(Ok.EMPTY);
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("should skip minting when ACT balance equals target", async () => {
      const { service, txManagerService } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 10_000_000_000, uakt: 50_000_000_000 }
      });

      const result = await service.mintIfNeeded();

      expect(result).toEqual(Ok.EMPTY);
      expect(txManagerService.signAndBroadcastWithFundingWallet).not.toHaveBeenCalled();
    });

    it("should mint with 2% price slippage margin on AKT to burn", async () => {
      const { service, masterAddress, chainSdk, rpcMessageService } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 99_999_999_999 },
        aktPrice: 0.5
      });
      mockBalancesOnce(chainSdk, { uact: 10_000_000_000, uakt: 89_799_999_999 });

      const result = await service.mintIfNeeded();

      expect(result).toEqual(Ok.EMPTY);
      // deficit = 10_000_000_000 - 5_000_000_000 = 5_000_000_000 uact
      // aktToBurn = ceil(5_000_000_000 / 0.5 * 1.02) = 10_200_000_000
      expect(rpcMessageService.getMintACTMsg).toHaveBeenCalledWith({
        owner: masterAddress,
        amount: 10_200_000_000
      });
    });

    it("should fail when AKT balance is insufficient to cover mint", async () => {
      const { service } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 100 },
        aktPrice: 0.5
      });

      const result = await service.mintIfNeeded();

      expect(result.err).toBe(true);
      expect(result.val).toContain("Insufficient AKT balance");
    });

    it("should wait for ledger settlement before confirming mint", async () => {
      const { service, chainSdk } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 99_999_999_999 },
        aktPrice: 0.5
      });
      mockBalancesOnce(chainSdk, { uact: 10_000_000_000, uakt: 89_799_999_999 });

      const pendingRecord = createBmeLedgerRecord({ status: 1 });
      chainSdk.akash.bme.v1.getLedgerRecords
        .mockResolvedValueOnce(createBmeLedgerResponse({ records: [pendingRecord] }))
        .mockResolvedValueOnce(createBmeLedgerResponse());

      const result = await service.mintIfNeeded();

      expect(result).toEqual(Ok.EMPTY);
      expect(chainSdk.akash.bme.v1.getLedgerRecords).toHaveBeenCalledTimes(2);
    });

    it("should fail when ledger settlement times out", async () => {
      const { service, chainSdk } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 99_999_999_999 },
        aktPrice: 0.5
      });

      const pendingRecord = createBmeLedgerRecord({ status: 1 });
      chainSdk.akash.bme.v1.getLedgerRecords.mockResolvedValue(createBmeLedgerResponse({ records: [pendingRecord] }));

      const result = await service.mintIfNeeded();

      expect(result.err).toBe(true);
      expect(result.val).toBe("Ledger polling timed out waiting for mint settlement");
    });

    it("should fail when ACT balance stays below target after retries", async () => {
      const { service, chainSdk } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 99_999_999_999 },
        aktPrice: 0.5
      });
      chainSdk.cosmos.bank.v1beta1.getAllBalances.mockResolvedValue(
        createBankBalancesResponse({
          balances: [
            { denom: "uact", amount: String(5_000_000_000) },
            { denom: "uakt", amount: String(96_123_572) }
          ]
        })
      );

      const result = await service.mintIfNeeded();

      expect(result.err).toBe(true);
      expect(result.val).toBe("ACT balance still below target after mint");
    });

    it("should skip broadcasting when dry-run is enabled", async () => {
      const { service, txManagerService } = setup({
        targetActBalance: 10_000_000_000,
        balances: { uact: 5_000_000_000, uakt: 99_999_999_999 },
        aktPrice: 0.5
      });

      const result = await service.mintIfNeeded({ dryRun: true });

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

  function setup(input: { targetActBalance: number; balances?: { uact: number; uakt: number }; aktPrice?: number }) {
    const billingConfig = mock<BillingConfigService>();
    billingConfig.get.calledWith("MASTER_WALLET_TARGET_ACT_BALANCE").mockReturnValue(input.targetActBalance);

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
