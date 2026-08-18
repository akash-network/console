import { describe, expect, it } from "vitest";

import { BME_MODULE_ADDRESS, deriveActMigrationSignals } from "@src/bme/act-migration-deriver";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";

const BLOCK_TIME = new Date("2026-08-13T00:00:00Z");

const VAULT_FUNDED_EVENT_TYPE = "akash.bme.v1.EventVaultFunded";
const EXECUTED_EVENT_TYPE = "akash.bme.v1.EventLedgerRecordExecuted";
const PRICE_DATA_EVENT_TYPE = "akash.oracle.v1.EventPriceData";
const SANDBOX_USDC_DENOM = "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E";

describe("deriveActMigrationSignals", () => {
  it("flags any native BME event by prefix, including types the BME deriver does not parse", () => {
    const signals = deriveActMigrationSignals(block({ blockEvents: [event(VAULT_FUNDED_EVENT_TYPE, { amount: '{"denom":"uakt","amount":"1000"}' })] }));

    expect(signals.hasNativeBmeEvent).toBe(true);
  });

  it("ignores synthetic legacy-indexer event types and unrelated events", () => {
    const signals = deriveActMigrationSignals(
      block({
        blockEvents: [event("indexer.bme.MigrationMinted", { amount: "1000" }), event("transfer", { amount: "1uakt" })]
      })
    );

    expect(signals.hasNativeBmeEvent).toBe(false);
  });

  it("keeps the last AKT/USD oracle price of the block for both uakt and akt denoms", () => {
    const signals = deriveActMigrationSignals(
      block({
        txEvents: [
          event(PRICE_DATA_EVENT_TYPE, priceDataAttributes({ denom: "uakt", price: "1.150000000000000000" })),
          event(PRICE_DATA_EVENT_TYPE, priceDataAttributes({ denom: "akt", price: "1.160000000000000000" }))
        ]
      })
    );

    expect(signals.lastAktUsdPrice).toBe("1.160000000000000000");
  });

  it("ignores oracle prices for other pairs, malformed attributes and non-decimal prices", () => {
    const signals = deriveActMigrationSignals(
      block({
        txEvents: [
          event(PRICE_DATA_EVENT_TYPE, priceDataAttributes({ denom: "uusdc", price: "1.000000000000000000" })),
          event(PRICE_DATA_EVENT_TYPE, { id: '{"denom":"uakt","base_denom":"eur"}', data: '{"price":"1.10","timestamp":"t"}' }),
          event(PRICE_DATA_EVENT_TYPE, { id: "not-json", data: '{"price":"1.10","timestamp":"t"}' }),
          event(PRICE_DATA_EVENT_TYPE, priceDataAttributes({ denom: "uakt", price: "-1.10" }))
        ]
      })
    );

    expect(signals.lastAktUsdPrice).toBeNull();
  });

  it("totals the BME module's burns and mints, keyed to the denoms the conversion moves", () => {
    const signals = deriveActMigrationSignals(
      block({
        blockEvents: [
          event("burn", { burner: BME_MODULE_ADDRESS, amount: "9034806372uakt" }),
          event("coinbase", { minter: BME_MODULE_ADDRESS, amount: "5658593148uact" }),
          event("burn", { burner: BME_MODULE_ADDRESS, amount: `19242170${SANDBOX_USDC_DENOM}` }),
          event("burn", { burner: "akash1someoneelse", amount: "5uakt" }),
          event("coinbase", { minter: BME_MODULE_ADDRESS, amount: "7uakt" })
        ]
      })
    );

    expect(signals.bankTotals).toEqual({ burnedUakt: 9034806372n, burnedUsdc: 19242170n, mintedUact: 5658593148n });
  });

  it("splits comma-separated multi-coin burn and mint amounts across their denoms", () => {
    const signals = deriveActMigrationSignals(
      block({
        blockEvents: [
          event("burn", { burner: BME_MODULE_ADDRESS, amount: `100uakt,50${SANDBOX_USDC_DENOM}` }),
          event("coinbase", { minter: BME_MODULE_ADDRESS, amount: "7uact,3uakt" })
        ]
      })
    );

    expect(signals.bankTotals).toEqual({ burnedUakt: 100n, burnedUsdc: 50n, mintedUact: 7n });
  });

  it("marks blocks with executed ledger records so bank totals are not treated as conversion-only", () => {
    const signals = deriveActMigrationSignals(block({ blockEvents: [event(EXECUTED_EVENT_TYPE, {})] }));

    expect(signals.hasLedgerExecutedEvent).toBe(true);
    expect(signals.hasNativeBmeEvent).toBe(true);
  });

  it("skips events of failed transactions entirely", () => {
    const signals = deriveActMigrationSignals(
      block({
        code: 5,
        txEvents: [event(VAULT_FUNDED_EVENT_TYPE, {}), event(PRICE_DATA_EVENT_TYPE, priceDataAttributes({ denom: "uakt", price: "1.15" }))]
      })
    );

    expect(signals.hasNativeBmeEvent).toBe(false);
    expect(signals.lastAktUsdPrice).toBeNull();
  });

  function priceDataAttributes(input: { denom: string; price: string }): Record<string, string> {
    return {
      source: '"band"',
      id: `{"denom":"${input.denom}","base_denom":"usd"}`,
      data: `{"price":"${input.price}","timestamp":"2026-08-13T00:00:00Z"}`
    };
  }

  function block(input: { height?: number; code?: number; txEvents?: DecodedEvent[]; blockEvents?: DecodedEvent[] }): DecodedBlock {
    return {
      height: input.height ?? 100,
      datetime: BLOCK_TIME,
      hash: Buffer.alloc(0),
      parentHash: null,
      proposerAddress: "P",
      transactions: input.txEvents
        ? [
            {
              index: 0,
              hash: Buffer.alloc(0),
              code: input.code ?? 0,
              gasUsed: 0,
              gasWanted: 0,
              fee: [],
              messages: [],
              events: input.txEvents,
              signerAddresses: []
            }
          ]
        : [],
      blockEvents: input.blockEvents ?? []
    };
  }

  function event(type: string, attributes: Record<string, string>): DecodedEvent {
    return { type, attributes };
  }
});
