import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GetAddressTransactionsResponse } from "@src/address/http-schemas/address.schema";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type { TransactionRepository } from "@src/transaction/repositories/transaction/transaction.repository";
import { TransactionService } from "./transaction.service";

describe(TransactionService.name, () => {
  describe("getTransactionsByAddress", () => {
    it("reports a further page when the address has more transactions than the page holds", async () => {
      const { service, transactionRepository } = setup();
      const transactions = [createAddressTransaction(), createAddressTransaction(), createAddressTransaction()];
      transactionRepository.findTransactionsByAddress.mockResolvedValue(transactions);

      const page = await service.getTransactionsByAddress("akash1test123", 4, 2);

      expect(page).toEqual({ results: transactions.slice(0, 2), hasMore: true });
      expect(transactionRepository.findTransactionsByAddress).toHaveBeenCalledWith("akash1test123", 4, 3);
    });

    it("reports no further page when the page holds the last transactions of the address", async () => {
      const { service, transactionRepository } = setup();
      const transactions = [createAddressTransaction(), createAddressTransaction()];
      transactionRepository.findTransactionsByAddress.mockResolvedValue(transactions);

      const page = await service.getTransactionsByAddress("akash1test123", 0, 2);

      expect(page).toEqual({ results: transactions, hasMore: false });
    });
  });

  describe("getLatestTransactionsByAddress", () => {
    it("lists the newest transactions of the address", async () => {
      const { service, transactionRepository } = setup();
      const transactions = [createAddressTransaction()];
      transactionRepository.findTransactionsByAddress.mockResolvedValue(transactions);

      const latestTransactions = await service.getLatestTransactionsByAddress("akash1test123", 5);

      expect(latestTransactions).toEqual(transactions);
      expect(transactionRepository.findTransactionsByAddress).toHaveBeenCalledWith("akash1test123", 0, 5);
    });
  });

  function createAddressTransaction(): GetAddressTransactionsResponse["results"][number] {
    return {
      height: faker.number.int({ min: 1, max: 30_000_000 }),
      datetime: faker.date.past().toISOString(),
      hash: faker.string.hexadecimal({ length: 64, prefix: "" }).toUpperCase(),
      isSuccess: true,
      error: null,
      gasUsed: faker.number.int({ min: 1, max: 500_000 }),
      gasWanted: faker.number.int({ min: 1, max: 500_000 }),
      fee: faker.number.int({ min: 1, max: 20_000 }),
      memo: null,
      isSigner: true,
      messages: []
    };
  }

  function setup() {
    MemoryCacheEngine.clearAllCaches();

    const transactionRepository = mock<TransactionRepository>();
    const service = new TransactionService(transactionRepository);

    return { service, transactionRepository };
  }
});
