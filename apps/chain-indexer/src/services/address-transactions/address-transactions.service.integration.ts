import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { Accounts, AccountTxs, Blocks, Messages, MessageTypes, Transactions } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { AddressTransactionsService } from "@src/services/address-transactions/address-transactions.service";

const ALICE = "akash1alice000000000000000000000000000000000";
const BOB = "akash1bob00000000000000000000000000000000000";

describe(AddressTransactionsService.name, () => {
  it("lists an address's transactions newest first with every role it played, one entry per transaction", async () => {
    const { service } = await setup();

    const page = await service.list(ALICE, { skip: 0, limit: 10 });

    expect(page.total).toBe(3);
    expect(page.transactions).toEqual([
      {
        height: 3,
        datetime: "2026-08-11T00:00:12.000Z",
        hash: "CC00",
        code: 0,
        gasUsed: 10,
        gasWanted: 20,
        fee: [],
        roles: ["receiver"],
        messages: [{ index: 0, type: "/cosmos.bank.v1beta1.MsgSend" }]
      },
      expect.objectContaining({ height: 2, hash: "BB01", roles: ["sender", "signer"], messages: [] }),
      expect.objectContaining({ height: 2, hash: "BB00", roles: ["signer"], messages: [{ index: 0, type: "/cosmos.bank.v1beta1.MsgSend" }] })
    ]);
  });

  it("pages with skip and limit while keeping the total", async () => {
    const { service } = await setup();

    const page = await service.list(ALICE, { skip: 1, limit: 1 });

    expect(page.total).toBe(3);
    expect(page.transactions.map(tx => tx.hash)).toEqual(["BB01"]);
  });

  it("returns an empty page for an address the chain never touched", async () => {
    const { service } = await setup();

    expect(await service.list("akash1nobody0000000000000000000000000000000", { skip: 0, limit: 10 })).toEqual({ total: 0, transactions: [] });
  });

  async function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    await db.delete(AccountTxs);
    await db.delete(Messages);
    await db.delete(MessageTypes);
    await db.delete(Transactions);
    await db.delete(Blocks);
    await db.delete(Accounts);

    const [alice, bob] = await db
      .insert(Accounts)
      .values([{ address: ALICE }, { address: BOB }])
      .returning();
    await db.insert(Blocks).values([
      { height: 2, datetime: new Date("2026-08-11T00:00:06Z"), hash: Buffer.from("aa02", "hex"), parentHash: null, proposerAddress: "P", txCount: 2 },
      { height: 3, datetime: new Date("2026-08-11T00:00:12Z"), hash: Buffer.from("aa03", "hex"), parentHash: null, proposerAddress: "P", txCount: 1 }
    ]);
    await db.insert(Transactions).values([
      { height: 2, index: 0, hash: Buffer.from("bb00", "hex"), code: 0, gasUsed: 1, gasWanted: 2, fee: [] },
      { height: 2, index: 1, hash: Buffer.from("bb01", "hex"), code: 0, gasUsed: 1, gasWanted: 2, fee: [] },
      { height: 3, index: 0, hash: Buffer.from("cc00", "hex"), code: 0, gasUsed: 10, gasWanted: 20, fee: [] }
    ]);
    const [send] = await db.insert(MessageTypes).values({ type: "/cosmos.bank.v1beta1.MsgSend" }).returning();
    await db.insert(Messages).values([
      { height: 2, txIndex: 0, index: 0, typeId: send.id, body: null },
      { height: 3, txIndex: 0, index: 0, typeId: send.id, body: null }
    ]);
    await db.insert(AccountTxs).values([
      { accountId: alice.id, height: 2, txIndex: 0, role: "signer" },
      { accountId: alice.id, height: 2, txIndex: 1, role: "signer" },
      { accountId: alice.id, height: 2, txIndex: 1, role: "sender" },
      { accountId: alice.id, height: 3, txIndex: 0, role: "receiver" },
      { accountId: bob.id, height: 3, txIndex: 0, role: "signer" }
    ]);

    const service = container.resolve(AddressTransactionsService);
    return { service, db };
  }
});
