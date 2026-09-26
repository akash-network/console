import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { Blocks, Messages, MessageTypes, Transactions, Validators } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { BlockQueryService } from "@src/services/block-query/block-query.service";

describe(BlockQueryService.name, () => {
  it("lists the most recent blocks newest first with their proposer resolved to a validator", async () => {
    const { service } = await setup();

    const blocks = await service.listLatest(2);

    expect(blocks).toEqual([
      {
        height: 3,
        datetime: "2026-08-11T00:00:12.000Z",
        hash: "AA03",
        proposer: { address: "PROPOSER-B", operatorAddress: null, moniker: null },
        transactionCount: 0
      },
      {
        height: 2,
        datetime: "2026-08-11T00:00:06.000Z",
        hash: "AA02",
        proposer: { address: "PROPOSER-A", operatorAddress: "akashvaloper1a", moniker: "Alice" },
        transactionCount: 2
      }
    ]);
  });

  it("returns a block with its transactions and message types by height", async () => {
    const { service } = await setup();

    const block = await service.getByHeight(2);

    expect(block).toEqual({
      height: 2,
      datetime: "2026-08-11T00:00:06.000Z",
      hash: "AA02",
      parentHash: "AA01",
      proposer: { address: "PROPOSER-A", operatorAddress: "akashvaloper1a", moniker: "Alice" },
      transactionCount: 2,
      transactions: [
        {
          index: 0,
          hash: "BB00",
          code: 0,
          gasUsed: 100,
          gasWanted: 200,
          fee: [{ denom: "uakt", amount: "5" }],
          messages: [
            { index: 0, type: "/cosmos.bank.v1beta1.MsgSend" },
            { index: 1, type: "/akash.deployment.v1beta4.MsgCreateDeployment" }
          ]
        },
        { index: 1, hash: "BB01", code: 5, gasUsed: 50, gasWanted: 60, fee: [], messages: [] }
      ]
    });
  });

  it("returns null for a height that is not indexed", async () => {
    const { service } = await setup();

    expect(await service.getByHeight(99)).toBeNull();
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(Messages);
    await db.delete(MessageTypes);
    await db.delete(Transactions);
    await db.delete(Blocks);
    await db.delete(Validators);

    await db.insert(Validators).values({ operatorAddress: "akashvaloper1a", hexAddress: "PROPOSER-A", moniker: "Alice" });
    await db.insert(Blocks).values([
      { height: 1, datetime: new Date("2026-08-11T00:00:00Z"), hash: Buffer.from("aa01", "hex"), parentHash: null, proposerAddress: "PROPOSER-A", txCount: 0 },
      {
        height: 2,
        datetime: new Date("2026-08-11T00:00:06Z"),
        hash: Buffer.from("aa02", "hex"),
        parentHash: Buffer.from("aa01", "hex"),
        proposerAddress: "PROPOSER-A",
        txCount: 2
      },
      {
        height: 3,
        datetime: new Date("2026-08-11T00:00:12Z"),
        hash: Buffer.from("aa03", "hex"),
        parentHash: Buffer.from("aa02", "hex"),
        proposerAddress: "PROPOSER-B",
        txCount: 0
      }
    ]);
    await db.insert(Transactions).values([
      { height: 2, index: 0, hash: Buffer.from("bb00", "hex"), code: 0, gasUsed: 100, gasWanted: 200, fee: [{ denom: "uakt", amount: "5" }] },
      { height: 2, index: 1, hash: Buffer.from("bb01", "hex"), code: 5, gasUsed: 50, gasWanted: 60, fee: [] }
    ]);
    const [send, create] = await db
      .insert(MessageTypes)
      .values([{ type: "/cosmos.bank.v1beta1.MsgSend" }, { type: "/akash.deployment.v1beta4.MsgCreateDeployment" }])
      .returning();
    await db.insert(Messages).values([
      { height: 2, txIndex: 0, index: 1, typeId: create.id, body: null },
      { height: 2, txIndex: 0, index: 0, typeId: send.id, body: { amount: [] } }
    ]);

    const service = container.resolve(BlockQueryService);
    return { service, db };
  }
});
