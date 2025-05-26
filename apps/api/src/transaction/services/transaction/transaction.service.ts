import { singleton } from "tsyringe";

import { TransactionRepository } from "@src/transaction/repositories/transaction/transaction.repository";

@singleton()
export class TransactionService {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async getTransactions(limit: number) {
    return this.transactionRepository.getTransactions(limit);
  }

  async getTransactionByHash(hash: string) {
    return this.transactionRepository.getTransactionByHash(hash);
  }
}
