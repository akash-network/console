import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AddressController } from "@src/address/controllers/address/address.controller";
import type { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import type { AddressService } from "@src/address/services/address/address.service";
import type { ChainIndexerAddressTransactionsService } from "@src/chain-indexer/services/address-transactions/chain-indexer-address-transactions.service";
import type { ChainIndexerDelegationService } from "@src/chain-indexer/services/delegation/chain-indexer-delegation.service";
import type { TransactionService } from "@src/transaction/services/transaction/transaction.service";

describe(AddressController.name, () => {
  describe("getTransactions", () => {
    it("serves the page from chain-indexer when the endpoint is delegated", async () => {
      const { controller, chainIndexerTransactions, transactionService, delegated } = setup({ delegated: true });

      const result = await controller.getTransactions({ address: "akash1a", skip: 10, limit: 5 });

      expect(result).toBe(delegated);
      expect(chainIndexerTransactions.getTransactionsByAddress).toHaveBeenCalledWith("akash1a", 10, 5);
      expect(transactionService.getTransactionsByAddress).not.toHaveBeenCalled();
    });

    it("serves the page from the legacy indexer when the endpoint is not delegated", async () => {
      const { controller, chainIndexerTransactions, transactionService, legacy } = setup({ delegated: false });

      const result = await controller.getTransactions({ address: "akash1a", skip: 10, limit: 5 });

      expect(result).toBe(legacy);
      expect(transactionService.getTransactionsByAddress).toHaveBeenCalledWith("akash1a", 10, 5);
      expect(chainIndexerTransactions.getTransactionsByAddress).not.toHaveBeenCalled();
    });
  });

  function setup(input: { delegated: boolean }) {
    const legacy: GetAddressTransactionsResponse = { count: 1, results: [] };
    const delegated: GetAddressTransactionsResponse = { count: 2, results: [] };
    const addressService = mock<AddressService>();
    const transactionService = mock<TransactionService>();
    transactionService.getTransactionsByAddress.mockResolvedValue(legacy);
    const chainIndexerTransactions = mock<ChainIndexerAddressTransactionsService>();
    chainIndexerTransactions.getTransactionsByAddress.mockResolvedValue(delegated);
    const delegation = mock<ChainIndexerDelegationService>();
    delegation.isEnabled.mockReturnValue(input.delegated);
    const controller = new AddressController(addressService, transactionService, delegation, chainIndexerTransactions);
    return { controller, transactionService, chainIndexerTransactions, legacy, delegated };
  }
});
