import { AkashBlock, AkashMessage } from "@akashnetwork/database/dbSchemas/akash";
import { Day, Transaction, Validator } from "@akashnetwork/database/dbSchemas/base";
import { get } from "lodash";

import { app } from "@src/app";

import { BlockSeeder } from "@test/seeders/block.seeder";
import { MessageSeeder } from "@test/seeders/message.seeder";
import { TransactionSeeder } from "@test/seeders/transaction.seeder";
import { ValidatorSeeder } from "@test/seeders/validator.seeder";

jest.setTimeout(20000);

const getMaxHeight = async () => {
  const height = await AkashBlock.max("height");

  return (height as number) ?? 0;
};

describe("Transactions", () => {
  describe("GET /v1/transactions", () => {
    it("resolves list of most recent transactions", async () => {
      const response = await app.request("/v1/transactions?limit=2", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(200);
      const transactions = await response.json();
      expect(transactions.length).toBe(2);
      transactions.forEach((transaction: unknown) => {
        expect(transaction).toMatchObject({
          height: expect.any(Number),
          datetime: expect.any(String),
          hash: expect.any(String),
          isSuccess: expect.any(Boolean),
          error: expect.toBeTypeOrNull(String),
          gasUsed: expect.any(Number),
          gasWanted: expect.any(Number),
          fee: expect.any(Number),
          memo: expect.any(String)
        });

        get(transaction, "messages", []).forEach((message: unknown) => {
          expect(message).toMatchObject({
            id: expect.any(String),
            type: expect.any(String),
            amount: expect.any(Number)
          });
        });
      });
    });

    it("will not resolve more than 100 transactions", async () => {
      const response = await app.request("/v1/transactions?limit=101", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(200);
      const blocks = await response.json();
      expect(blocks.length).toBe(100);
    });

    it("responds 400 when limit is not set", async () => {
      const response = await app.request("/v1/transactions", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/transactions/{hash}", () => {
    it("resolves transaction by hash", async () => {
      const maxHeight = await getMaxHeight();
      const nextHeight = maxHeight + 1;

      const day = await Day.findOne({ order: [["date", "DESC"]] });

      const validator = ValidatorSeeder.create();
      await Validator.create(validator);

      const block = BlockSeeder.create({
        height: nextHeight,
        proposer: validator.hexAddress,
        dayId: day.id
      });
      await AkashBlock.create(block);

      const transaction = TransactionSeeder.create({
        height: nextHeight,
        hasProcessingError: false
      });
      await Transaction.create(transaction);

      const message = MessageSeeder.create({
        txId: transaction.id,
        height: nextHeight,
        amount: "1000"
      });
      await AkashMessage.create(message);

      const response = await app.request(`/v1/transactions/${transaction.hash}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(200);
      const transactionLoaded = await response.json();
      expect(transactionLoaded).toEqual({
        height: block.height,
        datetime: block.datetime,
        hash: transaction.hash,
        isSuccess: !transaction.hasProcessingError,
        multisigThreshold: null,
        signers: [],
        error: transaction.hasProcessingError ? transaction.log : null,
        gasUsed: transaction.gasUsed,
        gasWanted: transaction.gasWanted,
        fee: parseInt(transaction.fee),
        memo: transaction.memo,
        messages: [
          {
            id: message.id,
            type: message.type,
            data: {
              amount: [
                {
                  amount: "10000",
                  denom: "uakt"
                }
              ],
              fromAddress: "akash10ml4dz5npgyhzx3xq0myl44dzycmkgytmc9rhe",
              toAddress: "akash1gxglu3ny085vnwearp3kf6tvhqagadyawy05gq"
            },
            relatedDeploymentId: null
          }
        ]
      });
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
