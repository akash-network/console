import { singleton } from "tsyringe";

import { GetAddressTransactionsParams, GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { AddressService } from "@src/address/services/address/address.service";
import { ChainIndexerAddressTransactionsService } from "@src/chain-indexer/services/address-transactions/chain-indexer-address-transactions.service";
import { ChainIndexerDelegationService } from "@src/chain-indexer/services/delegation/chain-indexer-delegation.service";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";

@singleton()
export class AddressController {
  constructor(
    private readonly addressService: AddressService,
    private readonly transactionService: TransactionService,
    private readonly chainIndexerDelegation: ChainIndexerDelegationService,
    private readonly chainIndexerTransactions: ChainIndexerAddressTransactionsService
  ) {}

  async getAddressDetails(address: string) {
    return this.addressService.getAddressDetails(address);
  }

  async getTransactions({ address, ...query }: GetAddressTransactionsParams): Promise<GetAddressTransactionsResponse> {
    if (this.chainIndexerDelegation.isEnabled("addressTransactions")) {
      return this.chainIndexerTransactions.getTransactionsByAddress(address, query.skip, query.limit);
    }
    return this.transactionService.getTransactionsByAddress(address, query.skip, query.limit);
  }
}
