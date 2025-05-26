import { singleton } from "tsyringe";

import { TransactionService } from "@src/transaction/services/transaction/transaction.service";

@singleton()
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  async getTransactions(limit: number) {
    return this.transactionService.getTransactions(limit);
  }

  async getTransactionByHash(hash: string) {
    return this.transactionService.getTransactionByHash(hash);
  }
}
