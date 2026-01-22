import { singleton } from "tsyringe";

import { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { Memoize } from "@src/caching/helpers";
import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { TransactionRepository } from "@src/transaction/repositories/transaction/transaction.repository";
import { averageBlockTime } from "@src/utils/constants";

@singleton()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getTransactions(limit: number): Promise<ListTransactionsResponse> {
    return await this.transactionRepository.getTransactions(limit);
  }

  @Memoize({ ttlInSeconds: 60 })
  async getTransactionByHash(hash: string): Promise<GetTransactionByHashResponse | null> {
    return await this.transactionRepository.getTransactionByHash(hash);
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getTransactionsByAddress(address: string, skip?: number, limit?: number): Promise<GetAddressTransactionsResponse> {
    return await this.transactionRepository.getTransactionsByAddress(address, skip, limit);
  }
}
