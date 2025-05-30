import { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { map } from "lodash";

import { app } from "@src/app";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { TransactionSeeder } from "@test/seeders/transaction.seeder";

describe("Transactions", () => {
  let transactions: Transaction[];

  beforeAll(async () => {
    const blockSeed = BlockSeeder.create();
    const block = await AkashBlock.create(blockSeed);

    const transactionSeeds = Array.from({ length: 101 }, (_, i) => {
      return TransactionSeeder.create({
        height: block.height,
        index: i + 1
      });
    });

    transactions = await Promise.all(transactionSeeds.map(async transactionSeed => Transaction.create(transactionSeed)));
  });

  const expectTransactions = (transactionsFound: Transaction[], transactionsExpected: Transaction[]) => {
    expect(transactionsFound.length).toBe(transactionsExpected.length);

    const hashesFound = map(transactionsFound, "hash");
    transactionsExpected.forEach(transactionExpected => {
      expect(hashesFound).toContain(transactionExpected.hash);
    });
  };

  describe("GET /v1/transactions", () => {
    it("resolves list of most recent transactions", async () => {
      const response = await app.request("/v1/transactions?limit=2", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const transactionsFound = await response.json();

      expect(response.status).toBe(200);
      expectTransactions(transactionsFound, transactions.slice(0, 2));
    });

    it("will not resolve more than 100 transactions", async () => {
      const response = await app.request("/v1/transactions?limit=101", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/transactions/{hash}", () => {
    it("resolves transaction by hash", async () => {
      const response = await app.request(`/v1/transactions/${transactions[0].hash}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const transactionFound = await response.json();

      expect(response.status).toBe(200);
      expectTransactions([transactions[0]], [transactionFound]);
    });

    it("responds 404 for an unknown hash", async () => {
      const response = await app.request("/v1/transactions/unknown-hash", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(404);
    });
  });
});
