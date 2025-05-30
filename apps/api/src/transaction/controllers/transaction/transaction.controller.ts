import { singleton } from "tsyringe";

import { GetTransactionByHashResponse, ListTransactionsResponse } from "@src/transaction/http-schemas/transaction.schema";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";

@singleton()
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  async getTransactions(limit: number): Promise<ListTransactionsResponse> {
    return await this.transactionService.getTransactions(limit);
  }

  async getTransactionByHash(hash: string): Promise<GetTransactionByHashResponse> | null {
    return await this.transactionService.getTransactionByHash(hash);
  }
}
