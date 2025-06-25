import type { Transaction } from "@akashnetwork/database/dbSchemas/base";
import { map } from "lodash";

import { app } from "@src/app";

import { createAkashBlock, createTransaction } from "@test/seeders";

describe("Transactions", () => {
  const expectTransactions = (transactionsFound: Transaction[], transactionsExpected: Transaction[]) => {
    expect(transactionsFound.length).toBe(transactionsExpected.length);

    const hashesFound = map(transactionsFound, "hash");
    transactionsExpected.forEach(transactionExpected => {
      expect(hashesFound).toContain(transactionExpected.hash);
    });
  };

  describe("GET /v1/transactions", () => {
    it("resolves list of most recent transactions", async () => {
      const { transactions } = await setup();
      const response = await app.request("/v1/transactions?limit=2", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const transactionsFound = (await response.json()) as any;

      expect(response.status).toBe(200);
      expectTransactions(transactionsFound, transactions.slice(0, 2));
    });

    it("will not resolve more than 100 transactions", async () => {
      await setup();
      const response = await app.request("/v1/transactions?limit=101", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/transactions/{hash}", () => {
    it("resolves transaction by hash", async () => {
      const { transactions } = await setup();
      const response = await app.request(`/v1/transactions/${transactions[0].hash}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const transactionFound = (await response.json()) as any;

      expect(response.status).toBe(200);
      expectTransactions([transactions[0]], [transactionFound]);
    });

    it("responds 404 for an unknown hash", async () => {
      await setup();
      const response = await app.request("/v1/transactions/unknown-hash", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(404);
    });
  });

  async function setup() {
    const block = await createAkashBlock();

    const transactions = await Promise.all(
      Array.from({ length: 101 }, (_, i) => {
        return createTransaction({
          height: block.height,
          index: i + 1
        });
      })
    );

    return { transactions };
  }
});
