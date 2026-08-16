import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AkashBlockChanges, AkashChangeBody } from "@src/akash/akash-changes";
import { AkashWriter } from "@src/akash/akash-writer.service";
import { Bids, DeploymentEvents, DeploymentGroupResources, DeploymentGroups, Deployments, Leases } from "@src/db/schema";
import type { ChainTransaction } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

const OWNER = "akash1owner";
const PROVIDER = "akash1prov";
const KEY = { owner: OWNER, dseq: "42" };
const LEASE_KEY = { ...KEY, gseq: 1, oseq: 1, bseq: 0, provider: PROVIDER };
const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");
const ACCOUNT_IDS = new Map([
  [OWNER, 7],
  [PROVIDER, 8]
]);

describe(AkashWriter.name, () => {
  it("does nothing for blocks without akash changes", async () => {
    const { writer, tx, inserts, selects } = setup();

    await writer.write(tx, [block(100, [])], ACCOUNT_IDS);

    expect(inserts).toEqual([]);
    expect(selects).toEqual([]);
  });

  it("persists a full lifecycle batch as one consistent set of rows", async () => {
    const { writer, tx, inserts, upserts } = setup();

    await writer.write(
      tx,
      [block(100, [create(), bidCreated("10")]), block(110, [{ kind: "leaseCreated", key: LEASE_KEY }]), block(200, [{ kind: "deploymentClosed", key: KEY }])],
      ACCOUNT_IDS
    );

    const [deploymentRow] = rowsFor(inserts, Deployments);
    expect(deploymentRow).toMatchObject({
      ownerAccountId: 7,
      dseq: "42",
      denom: "uakt",
      deposit: "5000000",
      balance: "4999100",
      withdrawnAmount: "900",
      blockRate: "0",
      lastWithdrawHeight: 200,
      lastProcessedHeight: 200,
      createdHeight: 100,
      closedHeight: 200,
      closeReason: "close_message",
      cpuUnits: 2000
    });

    expect(rowsFor(inserts, DeploymentGroups)).toEqual([{ deploymentId: 1, gseq: 1, state: "open", closedHeight: null }]);
    expect(rowsFor(inserts, DeploymentGroupResources)).toEqual([
      expect.objectContaining({ deploymentGroupId: 2, idx: 0, count: 2, cpuUnits: 1000, price: "1" })
    ]);
    expect(rowsFor(inserts, Bids)).toEqual([
      expect.objectContaining({ deploymentId: 1, providerAccountId: 8, price: "10", state: "closed", closedHeight: 200 })
    ]);
    expect(rowsFor(inserts, Leases)).toEqual([
      expect.objectContaining({
        deploymentId: 1,
        deploymentGroupId: 2,
        providerAccountId: 8,
        price: "10",
        withdrawnAmount: "900",
        createdHeight: 110,
        closedHeight: 200,
        cpuUnits: 2000
      })
    ]);
    expect(rowsFor(inserts, DeploymentEvents).map(row => [row.type, row.height, row.ordinal])).toEqual([
      ["created", 100, 0],
      ["bid_created", 100, 1],
      ["lease_created", 110, 0],
      ["closed", 200, 0]
    ]);

    const deploymentUpsert = upserts.find(upsert => upsert.table === Deployments);
    expect(whereSql(deploymentUpsert?.config.setWhere as SQL)).toContain('excluded.last_processed_height >= "akash"."deployments"."last_processed_height"');
  });

  it("skips flushing entirely when every block is at or below the stored watermark", async () => {
    const { writer, tx, inserts } = setup({
      deployments: [deploymentRow({ lastProcessedHeight: 500 })]
    });

    await writer.write(tx, [block(400, [{ kind: "deploymentDeposited", key: KEY, amount: "10", depositor: null }])], ACCOUNT_IDS);

    expect(inserts).toEqual([]);
  });

  it("logs orphan references without aborting the batch", async () => {
    const { writer, tx, logger, inserts } = setup();

    await writer.write(tx, [block(100, [{ kind: "leaseWithdrawn", key: LEASE_KEY }])], ACCOUNT_IDS);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "AKASH_ORPHAN_REFERENCE", count: 1 }));
    expect(inserts).toEqual([]);
  });

  it("applies new blocks on top of loaded state", async () => {
    const { writer, tx, inserts } = setup({
      deployments: [deploymentRow({ lastProcessedHeight: 110, lastWithdrawHeight: 110, balance: "1000.000000000000000000" })],
      leases: [leaseRow()]
    });

    await writer.write(tx, [block(150, [{ kind: "leaseWithdrawn", key: LEASE_KEY }])], ACCOUNT_IDS);

    const [row] = rowsFor(inserts, Deployments);
    expect(row).toMatchObject({ balance: "600", withdrawnAmount: "400", lastWithdrawHeight: 150, lastProcessedHeight: 150 });
    const [lease] = rowsFor(inserts, Leases);
    expect(lease).toMatchObject({ withdrawnAmount: "400" });
  });

  function setup(input?: {
    deployments?: Record<string, unknown>[];
    groups?: Record<string, unknown>[];
    bids?: Record<string, unknown>[];
    leases?: Record<string, unknown>[];
  }) {
    const inserts: { table: unknown; rows: Record<string, unknown>[] }[] = [];
    const upserts: { table: unknown; config: Record<string, SQL | unknown> }[] = [];
    const selects: unknown[] = [];
    let nextId = 1;

    const deployments = input?.deployments ?? [];
    const rowsByTable = new Map<unknown, Record<string, unknown>[]>([
      [Deployments, deployments],
      [DeploymentGroups, input?.groups ?? (deployments.length > 0 ? [{ id: 2, deploymentId: 1, gseq: 1, state: "open", closedHeight: null }] : [])],
      [Bids, input?.bids ?? []],
      [Leases, input?.leases ?? []]
    ]);

    const selectChain = (table: unknown) => {
      const rows = rowsByTable.get(table) ?? providerAccountRows(table);
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        innerJoin: () => chain,
        for: () => chain,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject)
      };
      return chain;
    };

    const providerAccountRows = (table: unknown) => {
      void table;
      return [
        { id: 7, address: OWNER },
        { id: 8, address: PROVIDER }
      ];
    };

    const tx = {
      insert: (table: unknown) => ({
        values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows: rowArray });
          const returning = () => Promise.resolve(rowArray.map(row => ({ id: nextId++, ...row })));
          return Object.assign(Promise.resolve(), {
            returning,
            onConflictDoNothing: () => Object.assign(Promise.resolve(), { returning }),
            onConflictDoUpdate: (config: Record<string, unknown>) => {
              upserts.push({ table, config });
              return Object.assign(Promise.resolve(), { returning });
            }
          });
        }
      }),
      select: (fields?: unknown) => {
        selects.push(fields);
        return { from: (table: unknown) => selectChain(table) };
      }
    };

    const logger = mock<LoggerService>();
    return { writer: new AkashWriter(logger), tx: tx as unknown as ChainTransaction, inserts, upserts, selects, logger };
  }

  function deploymentRow(overrides: Record<string, unknown>) {
    return {
      id: 1,
      ownerAccountId: 7,
      dseq: "42",
      denom: "uakt",
      deposit: "1000",
      balance: "1000.000000000000000000",
      withdrawnAmount: "0.000000000000000000",
      blockRate: "10.000000000000000000",
      lastWithdrawHeight: null,
      lastProcessedHeight: 100,
      createdHeight: 100,
      createdAt: BLOCK_TIME,
      closedHeight: null,
      closedAt: null,
      closeReason: null,
      cpuUnits: 2000,
      gpuUnits: 0,
      memoryBytes: 0,
      ephemeralStorageBytes: 0,
      persistentStorageBytes: 0,
      ...overrides
    };
  }

  function leaseRow() {
    return {
      deploymentId: 1,
      deploymentGroupId: 2,
      gseq: 1,
      oseq: 1,
      bseq: 0,
      providerAccountId: 8,
      price: "10.000000000000000000",
      denom: "uakt",
      balance: "0.000000000000000000",
      withdrawnAmount: "0.000000000000000000",
      predictedClosedHeight: "210",
      createdHeight: 110,
      createdAt: BLOCK_TIME,
      closedHeight: null,
      closedAt: null,
      cpuUnits: 2000,
      gpuUnits: 0,
      memoryBytes: 0,
      ephemeralStorageBytes: 0,
      persistentStorageBytes: 0
    };
  }

  function block(height: number, bodies: AkashChangeBody[]): AkashBlockChanges {
    return { height, datetime: BLOCK_TIME, changes: bodies.map((body, index) => ({ ...body, txIndex: 0, msgIndex: index })) };
  }

  function create(): AkashChangeBody {
    return {
      kind: "deploymentCreated",
      key: KEY,
      denom: "uakt",
      deposit: "5000000",
      depositor: null,
      groups: [
        {
          gseq: 1,
          resources: [
            {
              count: 2,
              cpuUnits: 1000,
              gpuUnits: 0,
              gpuVendor: null,
              gpuModel: null,
              memoryBytes: 0,
              ephemeralStorageBytes: 0,
              persistentStorageBytes: 0,
              price: "1",
              priceDenom: "uakt"
            }
          ]
        }
      ]
    };
  }

  function bidCreated(price: string): AkashChangeBody {
    return { kind: "bidCreated", key: LEASE_KEY, price, priceDenom: "uakt" };
  }

  function rowsFor(inserts: { table: unknown; rows: Record<string, unknown>[] }[], table: unknown): Record<string, unknown>[] {
    return inserts.filter(insert => insert.table === table).flatMap(insert => insert.rows);
  }

  function whereSql(where: SQL): string {
    return new PgDialect().sqlToQuery(where).sql;
  }
});
