import "@test/setup-functional-tests";

import { container } from "tsyringe";

import { TransactionRepository } from "./transaction.repository";

import { createAkashAddress, createAkashBlock, createAkashMessage, createTransaction } from "@test/seeders";
import { createAddressReferenceInDatabase } from "@test/seeders/address-reference.seeder";

describe(TransactionRepository.name, () => {
  describe("getTransactions", () => {
    it("returns a list of transactions", async () => {
      const { transactions, repository } = await setup();
      const transactionsFound = await repository.getTransactions(10);

      expect(transactions).toEqual(expect.arrayContaining(transactionsFound.map(tx => expect.objectContaining({ hash: tx.hash }))));
    });

    it("does not return more than 100 transactions", async () => {
      const { transactions, repository } = await setup();
      const transactionsFound = await repository.getTransactions(101);
      expect(transactions.length).toBeGreaterThan(100);
      expect(transactionsFound.length).toBe(100);
    });
  });

  describe("getTransactionByHash", () => {
    it("returns a transaction by hash", async () => {
      const { transactions, repository } = await setup();
      const txToFind = transactions[20];
      const transactionFound = await repository.getTransactionByHash(txToFind.hash);
      expect(transactionFound).toEqual(
        expect.objectContaining({
          height: txToFind.height,
          hash: txToFind.hash,
          isSuccess: !txToFind.hasProcessingError,
          error: txToFind.hasProcessingError && txToFind.log ? txToFind.log : null,
          gasUsed: txToFind.gasUsed,
          gasWanted: txToFind.gasWanted,
          fee: parseInt(txToFind.fee),
          memo: txToFind.memo
        })
      );
    });

    it("returns null if the transaction is not found", async () => {
      const { repository } = await setup();
      const transactionFound = await repository.getTransactionByHash("unknown-hash");
      expect(transactionFound).toBeNull();
    });
  });

  describe("getTransactionsByAddress", () => {
    it("returns a list of transactions by address", async () => {
      const { transactions, repository } = await setup();
      const address = createAkashAddress();
      const transactionsWithAddressRef = transactions.slice(0, 10);
      await Promise.all(
        transactionsWithAddressRef.map(async trx => {
          const message = await createAkashMessage({
            txId: trx.id,
            height: trx.height
          });
          return createAddressReferenceInDatabase({
            transactionId: trx.id,
            address,
            type: "sender",
            messageId: message.id
          });
        })
      );
      const transactionsFound = await repository.getTransactionsByAddress({ address, skip: 0, limit: 10 });
      expect(transactionsFound.count).toBe(transactionsWithAddressRef.length);
      expect(transactionsFound.results.map(trx => trx.hash).toSorted()).toEqual(transactionsWithAddressRef.map(trx => trx.hash).toSorted());
    });

    it("returns an empty list if the address has no transactions", async () => {
      const { repository } = await setup();
      const address = createAkashAddress();
      const transactionsFound = await repository.getTransactionsByAddress({ address, skip: 0, limit: 5 });
      expect(transactionsFound.count).toBe(0);
      expect(transactionsFound.results).toEqual([]);
    });
  });

  async function setup() {
    const repository = container.resolve(TransactionRepository);
    const block = await createAkashBlock();

    const transactions = await Promise.all(
      Array.from({ length: 101 }, (_, i) => {
        return createTransaction({
          height: block.height,
          index: i + 1
        });
      })
    );

    return { transactions, repository };
  }
});
