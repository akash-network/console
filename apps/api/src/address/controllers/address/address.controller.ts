import { createOtelLogger } from "@akashnetwork/logging/otel";
import { singleton } from "tsyringe";

import { GetAddressTransactionsParams, GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import { AddressService } from "@src/address/services/address/address.service";
import { ChainIndexerAddressTransactionsService } from "@src/chain-indexer/services/address-transactions/chain-indexer-address-transactions.service";
import { ChainIndexerDelegationService } from "@src/chain-indexer/services/delegation/chain-indexer-delegation.service";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";

const logger = createOtelLogger({ context: "AddressController" });

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

  /** The legacy path stays the fallback while delegated, so a chain-indexer outage degrades to the old data source instead of a 500. */
  async getTransactions({ address, ...query }: GetAddressTransactionsParams): Promise<GetAddressTransactionsResponse> {
    if (this.chainIndexerDelegation.isEnabled("addressTransactions")) {
      try {
        return await this.chainIndexerTransactions.getTransactionsByAddress(address, query.skip, query.limit);
      } catch (error) {
        logger.error({ event: "CHAIN_INDEXER_DELEGATION_FAILED", endpoint: "addressTransactions", address, error });
      }
    }
    return this.transactionService.getTransactionsByAddress(address, query.skip, query.limit);
  }
}
