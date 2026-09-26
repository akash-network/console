import { inject, singleton } from "tsyringe";

import type { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import type { ChainIndexerConfig } from "@src/chain-indexer/config/env.config";
import type { ChainIndexerApiClient } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { CHAIN_INDEXER_API_CLIENT } from "@src/chain-indexer/providers/chain-indexer-api.provider";
import { CHAIN_INDEXER_CONFIG } from "@src/chain-indexer/providers/chain-indexer-config.provider";

type ChainIndexerTransaction = Awaited<ReturnType<ChainIndexerApiClient["v1"]["listAddressTransactions"]>>["data"]["transactions"][number];

/** Serves the legacy address history shape from chain-indexer; the memo, the error log and per-message amounts are not stored there yet, so they come back empty. */
@singleton()
export class ChainIndexerAddressTransactionsService {
  readonly #api: ChainIndexerApiClient;
  readonly #config: ChainIndexerConfig;

  constructor(@inject(CHAIN_INDEXER_API_CLIENT) api: ChainIndexerApiClient, @inject(CHAIN_INDEXER_CONFIG) config: ChainIndexerConfig) {
    this.#api = api;
    this.#config = config;
  }

  async getTransactionsByAddress(address: string, skip: number, limit: number): Promise<GetAddressTransactionsResponse> {
    const { data } = await this.#api.v1.listAddressTransactions(
      { address, skip, limit },
      { signal: AbortSignal.timeout(this.#config.CHAIN_INDEXER_REQUEST_TIMEOUT_MS) }
    );
    return { count: data.total, results: data.transactions.map(toLegacyTransaction) };
  }
}

function toLegacyTransaction(tx: ChainIndexerTransaction): GetAddressTransactionsResponse["results"][number] {
  const isReceiver = tx.roles.includes("receiver");
  return {
    height: tx.height,
    datetime: tx.datetime,
    hash: tx.hash,
    isSuccess: tx.code === 0,
    error: null,
    gasUsed: tx.gasUsed,
    gasWanted: tx.gasWanted,
    fee: sumUaktFee(tx.fee),
    memo: null,
    isSigner: tx.roles.includes("signer"),
    messages: tx.messages.map(message => ({ id: `${tx.hash}-${message.index}`, type: message.type, amount: 0, isReceiver }))
  };
}

/** The legacy column held the uakt fee only, so other denoms are left out to keep the numbers comparable. */
function sumUaktFee(fee: ChainIndexerTransaction["fee"]): number {
  return fee.filter(coin => coin.denom === "uakt").reduce((sum, coin) => sum + Math.floor(Number(coin.amount)), 0);
}
