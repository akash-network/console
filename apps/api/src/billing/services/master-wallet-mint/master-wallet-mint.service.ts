import { BmeHttpService, CosmosHttpService, type RestCosmosBankBalancesResponse } from "@akashnetwork/http-sdk";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { TimerService } from "@src/core/services/timer/timer.service";
import type { DryRunOptions } from "@src/core/types/console";

type Balances = RestCosmosBankBalancesResponse["balances"];

@singleton()
export class MasterWalletMintService {
  private readonly logger = createOtelLogger({ context: MasterWalletMintService.name });
  private readonly PRICE_SLIPPAGE_MULTIPLIER = 1.02;
  private readonly POLL_INTERVAL_MS = 5_000;
  private readonly MAX_POLL_ATTEMPTS = 24;
  private readonly BALANCE_CHECK_INTERVAL_MS = 10_000;
  private readonly MAX_BALANCE_CHECK_ATTEMPTS = 18;
  private readonly AKT_RESERVE_UAKT = 100_000_000;

  constructor(
    private readonly billingConfigService: BillingConfigService,
    private readonly txManagerService: TxManagerService,
    private readonly cosmosHttpService: CosmosHttpService,
    private readonly denomExchangeService: DenomExchangeService,
    private readonly bmeHttpService: BmeHttpService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly timerService: TimerService
  ) {}

  /**
   * Checks the master wallet's ACT balance against the configured target and mints ACT from AKT if below.
   * Computes AKT to burn using oracle price (with slippage margin), enforces BME minimum mint,
   * caps to available AKT (minus reserve), broadcasts MsgMintACT, polls for settlement, and verifies post-mint balance.
   */
  async mintIfNeeded(options?: DryRunOptions): Promise<Result<void, string>> {
    const address = await this.txManagerService.getFundingWalletAddress();
    const balances = await this.fetchWalletBalances(address);
    const deficit = this.billingConfigService.get("MASTER_WALLET_TARGET_ACT_BALANCE") - this.findBalance(balances, "uact");

    if (deficit <= 0) {
      this.logger.info({ event: "MASTER_WALLET_MINT_SKIPPED", deficit });
      return Ok.EMPTY;
    }

    const calculation = await this.calculateAktToBurn(deficit, balances);

    if (calculation.err) {
      return calculation;
    }

    const aktToBurn = calculation.val;

    if (options?.dryRun) {
      this.logger.info({ event: "MASTER_WALLET_MINT_DRY_RUN", deficit, aktToBurn });
      return Ok.EMPTY;
    }

    return this.executeMint(address, aktToBurn);
  }

  private async fetchWalletBalances(address: string): Promise<Balances> {
    const { balances } = await this.cosmosHttpService.getBankBalancesByAddress(address);
    return balances;
  }

  /**
   * Computes the final AKT amount to burn: applies oracle price with slippage, enforces BME min mint, and caps to available AKT minus reserve.
   */
  private async calculateAktToBurn(actDeficit: number, balances: Balances): Promise<Result<number, string>> {
    const [{ price }, minMintUact] = await Promise.all([this.denomExchangeService.getExchangeRateToUSD("akt"), this.getMinMintAmount()]);

    if (!price || price <= 0) {
      this.logger.error({ event: "MASTER_WALLET_MINT_FAILED", message: "Invalid AKT price", price });
      return Err(`Invalid AKT price: ${price}`);
    }

    const minAktToBurn = Math.ceil((minMintUact / price) * this.PRICE_SLIPPAGE_MULTIPLIER);
    const aktToBurn = Math.ceil((Math.max(actDeficit, minMintUact) / price) * this.PRICE_SLIPPAGE_MULTIPLIER);

    return this.capToAvailableAkt(balances, aktToBurn, minAktToBurn);
  }

  private async getMinMintAmount(): Promise<number> {
    const { params } = await this.bmeHttpService.getParams();
    const uactCoin = params.min_mint.find(coin => coin.denom === "uact");

    if (!uactCoin) {
      this.logger.warn({ event: "MASTER_WALLET_MINT_MIN_NOT_FOUND", message: "uact denom not found in BME min_mint params, falling back to 10_000_000", min_mint: params.min_mint });
      return 10_000_000;
    }

    return Number(uactCoin.amount);
  }

  /** Caps burn amount to available AKT minus reserve (100 AKT). Fails if available can't cover the BME minimum mint. */
  private capToAvailableAkt(balances: Balances, aktToBurn: number, minAktToBurn: number): Result<number, string> {
    const aktBalance = this.findBalance(balances, "uakt");
    const available = aktBalance - this.AKT_RESERVE_UAKT;

    if (available < minAktToBurn) {
      const message = `Insufficient AKT balance: have ${aktBalance}, need at least ${minAktToBurn + this.AKT_RESERVE_UAKT} (${minAktToBurn} min burn + ${this.AKT_RESERVE_UAKT} reserve)`;
      this.logger.error({ event: "MASTER_WALLET_MINT_FAILED", message, aktBalance, minAktToBurn, reserve: this.AKT_RESERVE_UAKT });
      return Err(message);
    }

    if (available < aktToBurn) {
      this.logger.warn({ event: "MASTER_WALLET_MINT_CAPPED", message: "Minting less than needed due to AKT balance", requested: aktToBurn, available });
    }

    return Ok(Math.min(aktToBurn, available));
  }

  /**
   * Broadcasts MsgMintACT, waits for ledger settlement, and verifies ACT balance meets target.
   */
  private async executeMint(address: string, aktToBurn: number): Promise<Result<void, string>> {
    const message = this.rpcMessageService.getMintACTMsg({ owner: address, amount: aktToBurn });

    this.logger.info({ event: "MASTER_WALLET_MINT_STARTED", aktToBurn, address });
    const tx = await this.txManagerService.signAndBroadcastWithFundingWallet([message as EncodeObject]);

    if (tx.code !== 0) {
      const errorMessage = `Transaction failed with code ${tx.code}: ${tx.rawLog}`;
      this.logger.error({ event: "MASTER_WALLET_MINT_TX_FAILED", code: tx.code, rawLog: tx.rawLog, hash: tx.hash });
      return Err(errorMessage);
    }

    const settlement = await this.waitForSettlement(address);

    if (settlement.err) {
      return settlement;
    }

    return this.verifyBalanceAboveTarget(address);
  }

  /** Polls BME ledger until no pending records remain for this address. */
  private async waitForSettlement(address: string): Promise<Result<void, string>> {
    for (let attempt = 0; attempt < this.MAX_POLL_ATTEMPTS; attempt++) {
      const { records } = await this.bmeHttpService.getLedgerRecords({ source: address, status: "ledger_record_status_pending" });

      if (records.length === 0) {
        return Ok.EMPTY;
      }

      await this.timerService.delay(this.POLL_INTERVAL_MS);
    }

    this.logger.warn({ event: "MASTER_WALLET_MINT_TIMEOUT", address });
    return Err("Ledger polling timed out waiting for mint settlement");
  }

  /** Polls ACT balance until it meets the configured target, retrying up to 3 minutes. */
  private async verifyBalanceAboveTarget(address: string): Promise<Result<void, string>> {
    const target = this.billingConfigService.get("MASTER_WALLET_TARGET_ACT_BALANCE");

    for (let attempt = 0; attempt < this.MAX_BALANCE_CHECK_ATTEMPTS; attempt++) {
      const balances = await this.fetchWalletBalances(address);
      const actBalance = this.findBalance(balances, "uact");

      if (actBalance >= target) {
        this.logger.info({ event: "MASTER_WALLET_MINT_CONFIRMED", address, actBalance, target });
        return Ok.EMPTY;
      }

      this.logger.debug({ event: "MASTER_WALLET_MINT_BALANCE_PENDING", actBalance, target, attempt });
      await this.timerService.delay(this.BALANCE_CHECK_INTERVAL_MS);
    }

    this.logger.error({ event: "MASTER_WALLET_MINT_FAILED", message: "ACT balance still below target after mint" });
    return Err("ACT balance still below target after mint");
  }

  private findBalance(balances: Balances, denom: string): number {
    return parseFloat(balances.find(b => b.denom === denom)?.amount || "0");
  }
}
