import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BmeBlockChanges, BmeChange } from "@src/bme/bme-deriver";
import { BmeWriter } from "@src/bme/bme-writer.service";
import { BmeCanceledRecords, BmeLedgerRecords, BmeStatusChanges } from "@src/db/schema";
import type { LoggerService } from "@src/providers/logging.provider";

import { buildTxFake, rowsFor } from "@test/fakes/build-tx-fake";

const BURNER = "akash1burner";
const MINTER = "akash1minter";
const OWNER = "akash1owner";
const DEST = "akash1dest";
const ACCOUNT_IDS = new Map([
  [BURNER, 3],
  [MINTER, 4],
  [OWNER, 5],
  [DEST, 6]
]);

describe(BmeWriter.name, () => {
  it("writes executed records with interned account ids and flattened coin prices", async () => {
    const { writer, tx, inserts } = setup();

    await writer.write(
      tx,
      [
        blockChanges(100, [
          {
            kind: "ledgerRecordExecuted",
            id: { denom: "uakt", toDenom: "uact", source: "bme", recordHeight: 90, sequence: 3 },
            burnedFrom: BURNER,
            mintedTo: MINTER,
            burned: { denom: "uakt", amount: "1000000", price: "1.150000000000000000" },
            minted: { denom: "uact", amount: "1150000", price: "1.000000000000000000" },
            spread: { denom: "uakt", amount: "25" },
            remintCreditIssued: null,
            remintCreditAccrued: { denom: "uakt", amount: "1000000", price: "1.150000000000000000" },
            txIndex: null,
            ordinal: 0
          }
        ])
      ],
      ACCOUNT_IDS
    );

    expect(rowsFor(inserts, BmeLedgerRecords)).toEqual([
      {
        denom: "uakt",
        toDenom: "uact",
        source: "bme",
        recordHeight: 90,
        sequence: 3,
        height: 100,
        txIndex: null,
        burnedFromAccountId: 3,
        mintedToAccountId: 4,
        burnedDenom: "uakt",
        burnedAmount: "1000000",
        burnedPrice: "1.150000000000000000",
        mintedDenom: "uact",
        mintedAmount: "1150000",
        mintedPrice: "1.000000000000000000",
        spreadDenom: "uakt",
        spreadAmount: "25",
        remintCreditIssuedAmount: null,
        remintCreditAccruedAmount: "1000000"
      }
    ]);
  });

  it("defaults absent coin sides to zero amounts and null denoms", async () => {
    const { writer, tx, inserts } = setup();

    await writer.write(
      tx,
      [
        blockChanges(100, [
          {
            kind: "ledgerRecordExecuted",
            id: { denom: "uakt", toDenom: "uact", source: "bme", recordHeight: 100, sequence: 1 },
            burnedFrom: BURNER,
            mintedTo: MINTER,
            burned: null,
            minted: null,
            spread: null,
            remintCreditIssued: null,
            remintCreditAccrued: null,
            txIndex: 2,
            ordinal: 0
          }
        ])
      ],
      ACCOUNT_IDS
    );

    expect(rowsFor(inserts, BmeLedgerRecords)).toEqual([
      expect.objectContaining({
        txIndex: 2,
        burnedDenom: null,
        burnedAmount: "0",
        burnedPrice: null,
        mintedDenom: null,
        mintedAmount: "0",
        mintedPrice: null,
        spreadDenom: null,
        spreadAmount: null
      })
    ]);
  });

  it("writes status changes and canceled records to their tables", async () => {
    const { writer, tx, inserts } = setup();

    await writer.write(
      tx,
      [
        blockChanges(200, [
          {
            kind: "mintStatusChange",
            previousStatus: "mint_status_healthy",
            newStatus: "mint_status_halt_oracle",
            collateralRatio: "0.900000000000000000",
            txIndex: null,
            ordinal: 0
          },
          {
            kind: "ledgerRecordCanceled",
            id: { denom: "uakt", toDenom: "uact", source: "bme", recordHeight: 195, sequence: 7 },
            cancelReason: "insufficient_funds",
            owner: OWNER,
            to: DEST,
            coinsToBurn: { denom: "uakt", amount: "42" },
            denomToMint: "uact",
            txIndex: null,
            ordinal: 1
          }
        ])
      ],
      ACCOUNT_IDS
    );

    expect(rowsFor(inserts, BmeStatusChanges)).toEqual([
      {
        height: 200,
        ordinal: 0,
        previousStatus: "mint_status_healthy",
        newStatus: "mint_status_halt_oracle",
        collateralRatio: "0.900000000000000000"
      }
    ]);
    expect(rowsFor(inserts, BmeCanceledRecords)).toEqual([
      {
        denom: "uakt",
        toDenom: "uact",
        source: "bme",
        recordHeight: 195,
        sequence: 7,
        height: 200,
        txIndex: null,
        cancelReason: "insufficient_funds",
        ownerAccountId: 5,
        toAccountId: 6,
        coinsToBurnDenom: "uakt",
        coinsToBurnAmount: "42",
        denomToMint: "uact"
      }
    ]);
  });

  it("does nothing for blocks without changes or warnings", async () => {
    const { writer, tx, inserts, logger } = setup();

    await writer.write(tx, [blockChanges(100, [])], ACCOUNT_IDS);

    expect(inserts).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("throws when a change references an address that was not interned", async () => {
    const { writer, tx } = setup();

    const write = writer.write(
      tx,
      [
        blockChanges(100, [
          {
            kind: "ledgerRecordExecuted",
            id: { denom: "uakt", toDenom: "uact", source: "bme", recordHeight: 100, sequence: 1 },
            burnedFrom: "akash1unknown",
            mintedTo: MINTER,
            burned: null,
            minted: null,
            spread: null,
            remintCreditIssued: null,
            remintCreditAccrued: null,
            txIndex: null,
            ordinal: 0
          }
        ])
      ],
      ACCOUNT_IDS
    );

    await expect(write).rejects.toThrow("akash1unknown");
  });

  it("logs deriver warnings once with count and samples", async () => {
    const { writer, tx, logger } = setup();

    await writer.write(
      tx,
      [
        { height: 100, changes: [], warnings: ["height=100 ordinal=0 type=akash.bme.v1.EventLedgerRecordExecuted: unparseable id attribute: x"] },
        { height: 101, changes: [], warnings: ["height=101 ordinal=0 type=akash.bme.v1.EventMintStatusChange: unknown mint status: a -> b"] }
      ],
      ACCOUNT_IDS
    );

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith({
      event: "BME_EVENT_PARSE_FAILED",
      count: 2,
      samples: [
        "height=100 ordinal=0 type=akash.bme.v1.EventLedgerRecordExecuted: unparseable id attribute: x",
        "height=101 ordinal=0 type=akash.bme.v1.EventMintStatusChange: unknown mint status: a -> b"
      ]
    });
  });

  function blockChanges(height: number, changes: BmeChange[]): BmeBlockChanges {
    return { height, changes, warnings: [] };
  }

  function setup() {
    const { tx, inserts } = buildTxFake();
    const logger = mock<LoggerService>();
    const writer = new BmeWriter(logger);
    return { writer, tx, inserts, logger };
  }
});
