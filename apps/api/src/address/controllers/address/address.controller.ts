import { singleton } from "tsyringe";

import { GetAddressTransactionsParams, GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { AddressService } from "@src/address/services/address/address.service";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";

@singleton()
export class AddressController {
  constructor(
    private readonly addressService: AddressService,
    private readonly transactionService: TransactionService
  ) {}

  async getAddressDetails(address: string) {
    return this.addressService.getAddressDetails(address);
  }

  async getTransactions({ address, ...query }: GetAddressTransactionsParams): Promise<GetAddressTransactionsResponse> {
    return this.transactionService.getTransactionsByAddress(address, query.skip, query.limit);
  }
}
