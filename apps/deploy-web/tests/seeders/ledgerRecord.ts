import type { BmeLedgerRecord } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

const akashAddress = () => `akash1${faker.string.alphanumeric(38)}`;

export function buildMintLedgerRecord(overrides?: Partial<{ height: string }>): BmeLedgerRecord {
  const address = akashAddress();
  const aktAmount = faker.number.int({ min: 10_000_000, max: 500_000_000 });
  const price = faker.number.float({ min: 0.4, max: 0.6, fractionDigits: 9 });
  const actAmount = Math.round(aktAmount * price);

  return {
    id: {
      denom: "uakt",
      to_denom: "uact",
      source: address,
      height: overrides?.height ?? faker.number.int({ min: 80000, max: 100000 }).toString(),
      sequence: "1"
    },
    status: "ledger_record_status_executed",
    executed_record: {
      burned_from: address,
      minted_to: address,
      burner: "bme",
      minter: "bme",
      burned: null,
      minted: { coin: { denom: "uact", amount: actAmount.toString() }, price: "1.000000000000000000" },
      remint_credit_issued: null,
      remint_credit_accrued: { coin: { denom: "uakt", amount: aktAmount.toString() }, price: price.toFixed(9) }
    },
    pending_record: null
  };
}

export function buildBurnLedgerRecord(overrides?: Partial<{ height: string }>): BmeLedgerRecord {
  const address = akashAddress();
  const actAmount = faker.number.int({ min: 10_000_000, max: 500_000_000 });
  const price = faker.number.float({ min: 0.4, max: 0.6, fractionDigits: 9 });
  const aktAmount = Math.round(actAmount / price);

  return {
    id: {
      denom: "uact",
      to_denom: "uakt",
      source: address,
      height: overrides?.height ?? faker.number.int({ min: 80000, max: 100000 }).toString(),
      sequence: "1"
    },
    status: "ledger_record_status_executed",
    executed_record: {
      burned_from: address,
      minted_to: address,
      burner: "bme",
      minter: "bme",
      burned: { coin: { denom: "uact", amount: actAmount.toString() }, price: "1.000000000000000000" },
      minted: null,
      remint_credit_issued: { coin: { denom: "uakt", amount: aktAmount.toString() }, price: price.toFixed(9) },
      remint_credit_accrued: null
    },
    pending_record: null
  };
}

export function buildPendingMintLedgerRecord(overrides?: Partial<{ height: string; amount: number }>): BmeLedgerRecord {
  const address = akashAddress();

  return {
    id: {
      denom: "uakt",
      to_denom: "uact",
      source: address,
      height: overrides?.height ?? faker.number.int({ min: 80000, max: 100000 }).toString(),
      sequence: "1"
    },
    status: "ledger_record_status_pending",
    executed_record: null,
    pending_record: {
      owner: address,
      to: address,
      coins_to_burn: { denom: "uakt", amount: (overrides?.amount ?? faker.number.int({ min: 10_000_000, max: 500_000_000 })).toString() },
      denom_to_mint: "uact"
    }
  };
}
