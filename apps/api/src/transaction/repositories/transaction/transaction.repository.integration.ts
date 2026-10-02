import type { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

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

  describe("findTransactionsByAddress", () => {
    it("fills the page with distinct transactions when the address is referenced by several messages of one", async () => {
      const { repository } = await setup();
      const address = createAkashAddress();
      const [older, newer] = await seedAddressTransactions({
        address,
        positions: [
          { height: 0, index: 1 },
          { height: 1, index: 1 }
        ]
      });
      await referenceAddressInNewMessage({ transaction: newer, address, type: "Receiver" });

      const transactionsFound = await repository.findTransactionsByAddress(address, 0, 2);

      expect(transactionsFound.map(trx => trx.hash)).toEqual([newer.hash, older.hash]);
    });

    it("pages through the newest transactions first, by height and then by position in the block", async () => {
      const { repository } = await setup();
      const address = createAkashAddress();
      const [olderBlockLast, newerBlockFirst, newerBlockLast] = await seedAddressTransactions({
        address,
        positions: [
          { height: 0, index: 9 },
          { height: 1, index: 1 },
          { height: 1, index: 2 }
        ]
      });

      const pages = await Promise.all([0, 1, 2].map(skip => repository.findTransactionsByAddress(address, skip, 1)));

      expect(pages.flat().map(trx => trx.hash)).toEqual([newerBlockLast.hash, newerBlockFirst.hash, olderBlockLast.hash]);
    });

    it("returns the requested page of the address's transactions", async () => {
      const { repository } = await setup();
      const address = createAkashAddress();
      const transactions = await seedAddressTransactions({
        address,
        positions: [0, 1, 2, 3, 4].map(height => ({ height, index: 1 }))
      });

      const transactionsFound = await repository.findTransactionsByAddress(address, 1, 2);

      expect(transactionsFound.map(trx => trx.hash)).toEqual([transactions[3].hash, transactions[2].hash]);
    });

    it("returns an empty list if the address has no transactions", async () => {
      const { repository } = await setup();

      const transactionsFound = await repository.findTransactionsByAddress(createAkashAddress(), 0, 5);

      expect(transactionsFound).toEqual([]);
    });

    async function seedAddressTransactions(input: { address: string; positions: { height: number; index: number }[] }) {
      const baseHeight = faker.number.int({ min: 20_000_000, max: 2_000_000_000 });
      const heights = [...new Set(input.positions.map(position => baseHeight + position.height))];
      await Promise.all(heights.map(height => createAkashBlock({ height })));

      return Promise.all(
        input.positions.map(async position => {
          const transaction = await createTransaction({ height: baseHeight + position.height, index: position.index });
          await referenceAddressInNewMessage({ transaction, address: input.address, type: "Signer" });
          return transaction;
        })
      );
    }

    async function referenceAddressInNewMessage(input: { transaction: Transaction; address: string; type: string }) {
      const message = await createAkashMessage({ txId: input.transaction.id, height: input.transaction.height });
      await createAddressReferenceInDatabase({
        transactionId: input.transaction.id,
        messageId: message.id,
        address: input.address,
        type: input.type,
        height: input.transaction.height
      });
    }
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
