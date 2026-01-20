import { singleton } from "tsyringe";

import { GetAddressTransactionsParams, GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { Memoize } from "@src/caching/helpers";
import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { TransactionRepository } from "@src/transaction/repositories/transaction/transaction.repository";

@singleton()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  @Memoize({ ttlInSeconds: 15 })
  async getTransactions(limit: number): Promise<ListTransactionsResponse> {
    return await this.transactionRepository.getTransactions(limit);
  }

  @Memoize({ ttlInSeconds: 60 })
  async getTransactionByHash(hash: string): Promise<GetTransactionByHashResponse | null> {
    return await this.transactionRepository.getTransactionByHash(hash);
  }

  @Memoize({ ttlInSeconds: 30 })
  async getTransactionsByAddress({ address, ...query }: GetAddressTransactionsParams): Promise<GetAddressTransactionsResponse> {
    return await this.transactionRepository.getTransactionsByAddress({ address, ...query });
  }
}
