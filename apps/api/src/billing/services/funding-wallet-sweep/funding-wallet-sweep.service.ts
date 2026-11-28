import { MsgSend } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { BalanceHttpService } from "@akashnetwork/http-sdk";
import createError from "http-errors";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletMoveRepository } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";

/** In the order the chain wants a coin list; the uakt left behind pays the fee of sweeping the escrow that returns later. */
const MIN_KEPT_BY_DENOM = { uact: 0, uakt: 1_000_000 } as const;

const MOVED_USERS_PAGE_SIZE = 500;

type SweptCoin = { denom: string; amount: string };

export type FundingWalletSweep = { from: string; to: string; swept: SweptCoin[]; txHash?: string; deploymentsStillFunded: number };

@singleton()
export class FundingWalletSweepService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly fundingWalletMoveRepository: FundingWalletMoveRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly balanceHttpService: BalanceHttpService,
    private readonly txManagerService: TxManagerService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FundingWalletSweepService.name });
  }

  /** Only a retired wallet is swept: until then its coins pay the deposits of the users not moved off it yet. */
  async sweep(address: string): Promise<FundingWalletSweep> {
    const network = this.coreConfigService.get("NETWORK");
    const [wallet, active] = await Promise.all([
      this.fundingWalletRepository.findByAddress(network, address),
      this.fundingWalletRepository.findActive(network)
    ]);

    if (!wallet) throw createError(404, `Funding wallet ${address} is not registered`, { network });

    if (wallet.status !== "retired") {
      throw createError(409, `Funding wallet ${address} is ${wallet.status}, and only a retired one is swept`, { network });
    }

    if (!active) throw createError(409, "No funding wallet is active to receive the coins", { network });

    const [swept, deploymentsStillFunded] = await Promise.all([this.#readSweepable(address), this.#countDeploymentsStillFunded(wallet.id)]);
    const sweep: FundingWalletSweep = { from: address, to: active.address, swept, deploymentsStillFunded };

    if (swept.length === 0) {
      this.#logger.info({ event: "FUNDING_WALLET_SWEEP_NOTHING_TO_SEND", ...sweep });
      return sweep;
    }

    const txHash = await this.#send(sweep);
    this.#logger.info({ event: "FUNDING_WALLET_SWEPT", ...sweep, txHash });

    return { ...sweep, txHash };
  }

  async #readSweepable(address: string): Promise<SweptCoin[]> {
    const coins = await Promise.all(
      Object.entries(MIN_KEPT_BY_DENOM).map(async ([denom, minKept]) => {
        const balance = await this.balanceHttpService.getBalance(address, denom);

        return { denom, amount: (balance?.amount ?? 0) - minKept };
      })
    );

    return coins.filter(({ amount }) => amount > 0).map(({ denom, amount }) => ({ denom, amount: String(amount) }));
  }

  async #send({ from, to, swept }: FundingWalletSweep): Promise<string> {
    const tx = await this.txManagerService.signAndBroadcastWithFundingWallet([
      { typeUrl: `/${MsgSend.$type}`, value: MsgSend.fromPartial({ fromAddress: from, toAddress: to, amount: swept }) }
    ]);

    if (tx.code !== 0) {
      throw createError(502, `The sweep of funding wallet ${from} landed with code ${tx.code}`, { txHash: tx.hash, rawLog: tx.rawLog });
    }

    return tx.hash;
  }

  /** A deployment a moved user opened before the move was paid by this wallet, so its close returns escrow here for another sweep to pick up. */
  async #countDeploymentsStillFunded(fundingWalletId: string): Promise<number> {
    const moved = await this.fundingWalletMoveRepository.findCompletedReads(fundingWalletId);
    let count = 0;

    for (const page of chunk(moved, MOVED_USERS_PAGE_SIZE)) {
      count += await this.deploymentRepository.countOpenCreatedAtOrBefore(page);
    }

    return count;
  }
}
