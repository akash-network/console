import { singleton } from "tsyringe";

import { GetAddressTransactionsParams, GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { TransactionRepository } from "@src/transaction/repositories/transaction/transaction.repository";

@singleton()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async getTransactions(limit: number): Promise<ListTransactionsResponse> {
    return await this.transactionRepository.getTransactions(limit);
  }

  async getTransactionByHash(hash: string): Promise<GetTransactionByHashResponse | null> {
    return await this.transactionRepository.getTransactionByHash(hash);
  }

  async getTransactionsByAddress({ address, ...query }: GetAddressTransactionsParams): Promise<GetAddressTransactionsResponse> {
    return await this.transactionRepository.getTransactionsByAddress({ address, ...query });
  }
}
