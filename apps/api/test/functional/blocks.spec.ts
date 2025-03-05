import { AkashBlock, AkashMessage } from "@akashnetwork/database/dbSchemas/akash";
import { Day, Transaction, Validator } from "@akashnetwork/database/dbSchemas/base";

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

describe("Blocks", () => {
  describe("GET /v1/blocks", () => {
    it("resolves list of most recent blocks", async () => {
      const response = await app.request("/v1/blocks?limit=2", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(200);
      const blocks = await response.json();
      expect(blocks.length).toBe(2);
      blocks.forEach((block: unknown) => {
        expect(block).toMatchObject({
          height: expect.any(Number),
          proposer: {
            address: expect.any(String),
            operatorAddress: expect.any(String),
            moniker: expect.any(String),
            avatarUrl: expect.toBeTypeOrNull(String)
          },
          transactionCount: expect.any(Number),
          totalTransactionCount: expect.any(Number),
          datetime: expect.dateTimeZ()
        });
      });
    });

    it("will not resolve more than 100 blocks", async () => {
      const response = await app.request("/v1/blocks?limit=101", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(200);
      const blocks = await response.json();
      expect(blocks.length).toBe(100);
    });
  });

  describe("GET /v1/blocks/{height}", () => {
    it("resolves block by height", async () => {
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

      const response = await app.request(`/v1/blocks/${block.height}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(200);
      const blockLoaded = await response.json();
      expect(blockLoaded).toEqual({
        height: block.height,
        datetime: block.datetime,
        proposer: {
          address: validator.accountAddress,
          operatorAddress: validator.operatorAddress,
          moniker: validator.moniker,
          avatarUrl: validator.keybaseAvatarUrl
        },
        hash: blockLoaded.hash,
        gasUsed: blockLoaded.gasUsed,
        gasWanted: blockLoaded.gasWanted,
        transactions: [
          {
            hash: transaction.hash,
            isSuccess: true,
            error: null,
            fee: parseInt(transaction.fee),
            datetime: block.datetime,
            messages: [
              {
                id: message.id,
                type: message.type,
                amount: parseInt(message.amount)
              }
            ]
          }
        ]
      });
    });

    it("responds 400 for invalid height", async () => {
      const response = await app.request("/v1/blocks/a", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(400);
    });

    it("responds 404 for a block not found", async () => {
      const response = await app.request("/v1/blocks/0", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(404);
    });
  });
});
