import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AkashBlockChanges, AkashChangeBody } from "@src/akash/akash-changes";
import { ProviderWriter } from "@src/akash/provider-writer.service";
import { ProviderAuditSignatures, Providers } from "@src/db/schema";
import type { ChainTransaction } from "@src/providers/db.provider";
import type { LoggerService } from "@src/providers/logging.provider";

const OWNER = "akash1prov";
const AUDITOR = "akash1auditor";
const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");
const ACCOUNT_IDS = new Map([
  [OWNER, 7],
  [AUDITOR, 8]
]);

describe(ProviderWriter.name, () => {
  it("does nothing for blocks without provider changes", async () => {
    const { writer, tx, inserts, deletes, selects } = setup();

    await writer.write(tx, [block(100, [{ kind: "deploymentClosed", key: { owner: OWNER, dseq: "1" } }])], ACCOUNT_IDS);

    expect(inserts).toEqual([]);
    expect(deletes).toEqual([]);
    expect(selects).toEqual([]);
  });

  it("folds a create, update and delete across blocks into one guarded upsert with the final state", async () => {
    const { writer, tx, inserts, upserts } = setup();

    await writer.write(
      tx,
      [
        block(100, [created()]),
        block(110, [updated({ hostUri: "https://new.example.com:8443", email: "new@example.com", attributes: [{ key: "tier", value: "pro" }] })]),
        block(120, [{ kind: "providerDeleted", owner: OWNER }])
      ],
      ACCOUNT_IDS
    );

    expect(rowsFor(inserts, Providers)).toEqual([
      {
        ownerAccountId: 7,
        hostUri: "https://new.example.com:8443",
        email: "new@example.com",
        website: null,
        attributes: [{ key: "tier", value: "pro" }],
        lastProcessedHeight: 120,
        createdHeight: 100,
        updatedHeight: 110,
        deletedHeight: 120
      }
    ]);

    const upsert = upserts.find(entry => entry.table === Providers);
    expect(whereSql(upsert?.config.setWhere as SQL)).toContain('excluded.last_processed_height >= "akash"."providers"."last_processed_height"');
  });

  it("resets the row when a deleted provider re-registers", async () => {
    const { writer, tx, inserts } = setup({
      providers: [providerRow({ lastProcessedHeight: 120, updatedHeight: 110, deletedHeight: 120 })]
    });

    await writer.write(tx, [block(200, [created({ hostUri: "https://back.example.com:8443" })])], ACCOUNT_IDS);

    expect(rowsFor(inserts, Providers)).toEqual([
      expect.objectContaining({
        hostUri: "https://back.example.com:8443",
        lastProcessedHeight: 200,
        createdHeight: 200,
        updatedHeight: null,
        deletedHeight: null
      })
    ]);
  });

  it("skips blocks at or below the stored watermark", async () => {
    const { writer, tx, inserts } = setup({ providers: [providerRow({ lastProcessedHeight: 500 })] });

    await writer.write(tx, [block(400, [created()]), block(500, [{ kind: "providerDeleted", owner: OWNER }])], ACCOUNT_IDS);

    expect(inserts).toEqual([]);
  });

  it("warns on an update for an unknown provider without writing", async () => {
    const { writer, tx, logger, inserts } = setup();

    await writer.write(tx, [block(100, [updated({})])], ACCOUNT_IDS);

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "PROVIDER_ORPHAN_REFERENCE", count: 1 }));
    expect(inserts).toEqual([]);
  });

  it("upserts signed attributes deduped last-wins with a height guard", async () => {
    const { writer, tx, inserts, upserts } = setup();

    await writer.write(
      tx,
      [
        block(100, [
          {
            kind: "providerAttributesSigned",
            owner: OWNER,
            auditor: AUDITOR,
            attributes: [
              { key: "region", value: "us-east" },
              { key: "region", value: "us-west" },
              { key: "tier", value: "community" }
            ]
          }
        ])
      ],
      ACCOUNT_IDS
    );

    expect(rowsFor(inserts, ProviderAuditSignatures)).toEqual([
      { ownerAccountId: 7, auditorAccountId: 8, key: "region", value: "us-west", height: 100 },
      { ownerAccountId: 7, auditorAccountId: 8, key: "tier", value: "community", height: 100 }
    ]);

    const upsert = upserts.find(entry => entry.table === ProviderAuditSignatures);
    expect(whereSql(upsert?.config.setWhere as SQL)).toContain('excluded.height >= "akash"."provider_audit_signatures"."height"');
  });

  it("deletes the given keys with a height guard, and all of the auditor's keys when none are given", async () => {
    const { writer, tx, deletes } = setup();

    await writer.write(
      tx,
      [
        block(100, [
          { kind: "providerAttributesUnsigned", owner: OWNER, auditor: AUDITOR, keys: ["region", "tier"] },
          { kind: "providerAttributesUnsigned", owner: OWNER, auditor: AUDITOR, keys: [] }
        ])
      ],
      ACCOUNT_IDS
    );

    expect(deletes).toHaveLength(2);
    const [keyedDelete, deleteAll] = deletes.map(entry => whereSql(entry.where as SQL));
    expect(keyedDelete).toContain('"owner_account_id" = ');
    expect(keyedDelete).toContain('"auditor_account_id" = ');
    expect(keyedDelete).toContain('"height" <= ');
    expect(keyedDelete).toContain('"key" in ');
    expect(deleteAll).toContain('"height" <= ');
    expect(deleteAll).not.toContain('"key" in ');
  });

  it("applies audit changes even when the provider was never registered", async () => {
    const { writer, tx, inserts, logger } = setup();

    await writer.write(
      tx,
      [block(100, [{ kind: "providerAttributesSigned", owner: OWNER, auditor: AUDITOR, attributes: [{ key: "region", value: "us-west" }] }])],
      ACCOUNT_IDS
    );

    expect(rowsFor(inserts, ProviderAuditSignatures)).toHaveLength(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  function setup(input?: { providers?: Record<string, unknown>[] }) {
    const inserts: { table: unknown; rows: Record<string, unknown>[] }[] = [];
    const upserts: { table: unknown; config: Record<string, SQL | unknown> }[] = [];
    const deletes: { table: unknown; where: unknown }[] = [];
    const selects: unknown[] = [];

    const selectChain = () => {
      const chain = {
        where: () => chain,
        orderBy: () => chain,
        for: () => chain,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(input?.providers ?? []).then(resolve, reject)
      };
      return chain;
    };

    const tx = {
      insert: (table: unknown) => ({
        values: (rows: Record<string, unknown> | Record<string, unknown>[]) => {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows: rowArray });
          return Object.assign(Promise.resolve(), {
            onConflictDoUpdate: (config: Record<string, unknown>) => {
              upserts.push({ table, config });
              return Promise.resolve();
            }
          });
        }
      }),
      select: (fields?: unknown) => {
        selects.push(fields);
        return { from: () => selectChain() };
      },
      delete: (table: unknown) => ({
        where: (condition: unknown) => {
          deletes.push({ table, where: condition });
          return Promise.resolve();
        }
      })
    };

    const logger = mock<LoggerService>();
    return { writer: new ProviderWriter(logger), tx: tx as unknown as ChainTransaction, inserts, upserts, deletes, selects, logger };
  }

  function providerRow(overrides: Record<string, unknown>) {
    return {
      ownerAccountId: 7,
      hostUri: "https://provider.example.com:8443",
      email: null,
      website: null,
      attributes: [],
      lastProcessedHeight: 100,
      createdHeight: 100,
      updatedHeight: null,
      deletedHeight: null,
      ...overrides
    };
  }

  function created(overrides?: Partial<Extract<AkashChangeBody, { kind: "providerCreated" }>>): AkashChangeBody {
    return {
      kind: "providerCreated",
      owner: OWNER,
      hostUri: "https://provider.example.com:8443",
      email: null,
      website: null,
      attributes: [{ key: "region", value: "us-west" }],
      ...overrides
    };
  }

  function updated(overrides: Partial<Extract<AkashChangeBody, { kind: "providerUpdated" }>>): AkashChangeBody {
    return {
      kind: "providerUpdated",
      owner: OWNER,
      hostUri: "https://provider.example.com:8443",
      email: null,
      website: null,
      attributes: [],
      ...overrides
    };
  }

  function block(height: number, bodies: AkashChangeBody[]): AkashBlockChanges {
    return { height, datetime: BLOCK_TIME, changes: bodies.map((body, index) => ({ ...body, txIndex: 0, msgIndex: index })) };
  }

  function rowsFor(inserts: { table: unknown; rows: Record<string, unknown>[] }[], table: unknown): Record<string, unknown>[] {
    return inserts.filter(insert => insert.table === table).flatMap(insert => insert.rows);
  }

  function whereSql(where: SQL): string {
    return new PgDialect().sqlToQuery(where).sql;
  }
});
