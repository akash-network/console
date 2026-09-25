import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { BulkInserter } from "@src/db/bulk-inserter.service";
import { Accounts, BalanceChanges, Blocks, Messages, MessageTypes } from "@src/db/schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

describe(BulkInserter.name, () => {
  it("inserts rows of every column type used by the chain tables and reads them back unchanged", async () => {
    const { inserter, db } = setup();
    const rows = [
      { height: 1, datetime: new Date("2026-08-11T00:00:00.123Z"), hash: Buffer.from("00ff10", "hex"), parentHash: null, proposerAddress: "PROP", txCount: 0 },
      {
        height: 2,
        datetime: new Date("2026-08-11T00:00:06.000Z"),
        hash: Buffer.from("abcd", "hex"),
        parentHash: Buffer.from("00ff10", "hex"),
        proposerAddress: "PROP",
        txCount: 3
      }
    ];

    await db.transaction(tx => inserter.insert(tx, Blocks, rows));

    expect(await db.select().from(Blocks).orderBy(Blocks.height)).toEqual(rows);
  });

  it("stores jsonb bodies as nested json and null bodies as sql null", async () => {
    const { inserter, db } = setup();
    const [type] = await db.insert(MessageTypes).values({ type: "/cosmos.bank.v1beta1.MsgSend" }).returning();
    const body = { amount: [{ denom: "uakt", amount: "1" }], memo: 'quote " and \\ backslash, brace } and comma', nested: { flag: true, list: [1, null] } };

    await db.transaction(tx =>
      inserter.insert(tx, Messages, [
        { height: 10, txIndex: 0, index: 0, typeId: type.id, body },
        { height: 10, txIndex: 0, index: 1, typeId: type.id, body: null }
      ])
    );

    expect(await db.select({ index: Messages.index, body: Messages.body }).from(Messages).orderBy(Messages.index)).toEqual([
      { index: 0, body },
      { index: 1, body: null }
    ]);
  });

  it("ignores conflicting rows by default and returns only the rows it inserted when asked", async () => {
    const { inserter, db } = setup();
    const [account] = await db.insert(Accounts).values({ address: "akash1bulkinserter" }).returning();
    const change = {
      accountId: account.id,
      denom: "uakt",
      delta: "-5",
      balanceAfter: "95",
      reason: "fee" as const,
      height: 20,
      txIndex: 0,
      eventIndex: 0,
      counterpartyAccountId: null
    };
    const returning = sql`account_id AS "accountId", delta`;

    const first = await db.transaction(tx => inserter.insert(tx, BalanceChanges, [change], { returning }));
    const second = await db.transaction(tx =>
      inserter.insert(tx, BalanceChanges, [change, { ...change, eventIndex: 1, delta: "7", balanceAfter: "102" }], { returning })
    );

    expect(first).toEqual([{ accountId: account.id, delta: "-5" }]);
    expect(second).toEqual([{ accountId: account.id, delta: "7" }]);
    expect(await db.select({ delta: BalanceChanges.delta, reason: BalanceChanges.reason }).from(BalanceChanges).orderBy(BalanceChanges.eventIndex)).toEqual([
      { delta: "-5", reason: "fee" },
      { delta: "7", reason: "fee" }
    ]);
  });

  it("applies a custom conflict clause", async () => {
    const { inserter, db } = setup();
    const [type] = await db.insert(MessageTypes).values({ type: "/akash.v1.MsgHealed" }).returning();
    await db.insert(Messages).values({ height: 30, txIndex: 0, index: 0, typeId: type.id, body: null });

    await db.transaction(tx =>
      inserter.insert(tx, Messages, [{ height: 30, txIndex: 0, index: 0, typeId: type.id, body: { healed: true } }], {
        onConflict: sql`ON CONFLICT (height, tx_index, index) DO UPDATE SET body = excluded.body WHERE ${Messages.body} IS NULL`
      })
    );

    expect(
      await db
        .select({ body: Messages.body })
        .from(Messages)
        .where(sql`${Messages.height} = 30`)
    ).toEqual([{ body: { healed: true } }]);
  });

  it("raises on conflict when conflict handling is disabled", async () => {
    const { inserter, db } = setup();
    const row = {
      height: 40,
      datetime: new Date("2026-08-11T00:00:00Z"),
      hash: Buffer.from("40", "hex"),
      parentHash: null,
      proposerAddress: "PROP",
      txCount: 0
    };
    await db.transaction(tx => inserter.insert(tx, Blocks, [row]));

    await expect(db.transaction(tx => inserter.insert(tx, Blocks, [row], { onConflict: "error" }))).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("does nothing for an empty batch", async () => {
    const { inserter, db } = setup();

    await expect(db.transaction(tx => inserter.insert(tx, Blocks, []))).resolves.toEqual([]);
  });

  function setup() {
    const db: ChainDatabase = container.resolve(CHAIN_DB);
    const inserter = container.resolve(BulkInserter);
    return { inserter, db };
  }
});
