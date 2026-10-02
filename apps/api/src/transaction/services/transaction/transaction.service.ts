import { singleton } from "tsyringe";

import { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { Memoize } from "@src/caching/helpers";
import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { TransactionRepository } from "@src/transaction/repositories/transaction/transaction.repository";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  @Memoize({ ttlInSeconds: averageBlockTime, maxEntries: 500 })
  async getTransactions(limit: number): Promise<ListTransactionsResponse> {
    return await this.transactionRepository.getTransactions(limit);
  }

  @Memoize({ ttlInSeconds: 60, maxEntries: 500 })
  async getTransactionByHash(hash: string): Promise<GetTransactionByHashResponse | null> {
    return await this.transactionRepository.getTransactionByHash(hash);
  }

  @Memoize({ ttlInSeconds: averageBlockTime, maxEntries: 500 })
  async getTransactionsByAddress(address: string, skip: number, limit: number): Promise<GetAddressTransactionsResponse> {
    const transactions = await this.transactionRepository.findTransactionsByAddress(address, skip, limit + 1);

    return { results: transactions.slice(0, limit), hasMore: transactions.length > limit };
  }

  async getLatestTransactionsByAddress(address: string, limit: number): Promise<GetAddressTransactionsResponse["results"]> {
    return await this.transactionRepository.findTransactionsByAddress(address, 0, limit);
  }
}
