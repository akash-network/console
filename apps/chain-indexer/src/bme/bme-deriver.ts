import { asInteger, asRecord, asString, parseJsonRecord } from "@src/akash/json";
import { bmeMintStatus } from "@src/db/schema";
import type { DecodedBlock, DecodedEvent } from "@src/pipeline/decoded-block";

const LEDGER_RECORD_EXECUTED_EVENT_TYPE = "akash.bme.v1.EventLedgerRecordExecuted";
const MINT_STATUS_CHANGE_EVENT_TYPE = "akash.bme.v1.EventMintStatusChange";
const LEDGER_RECORD_CANCELED_EVENT_TYPE = "akash.bme.v1.EventLedgerRecordCanceled";

const MINT_STATUSES = new Set<string>(bmeMintStatus.enumValues);

type BmeMintStatus = (typeof bmeMintStatus.enumValues)[number];

/** The on-chain LedgerRecordID; `recordHeight` is the record's creation height, not the execution block. */
export interface BmeRecordId {
  denom: string;
  toDenom: string;
  source: string;
  recordHeight: number;
  sequence: number;
}

export interface BmeCoin {
  denom: string;
  amount: string;
}

export interface BmeCoinPrice extends BmeCoin {
  price: string | null;
}

export type BmeChangeBody =
  | {
      kind: "ledgerRecordExecuted";
      id: BmeRecordId;
      burnedFrom: string;
      mintedTo: string;
      burned: BmeCoinPrice | null;
      minted: BmeCoinPrice | null;
      spread: BmeCoin | null;
      remintCreditIssued: BmeCoinPrice | null;
      remintCreditAccrued: BmeCoinPrice | null;
    }
  | { kind: "mintStatusChange"; previousStatus: BmeMintStatus; newStatus: BmeMintStatus; collateralRatio: string }
  | {
      kind: "ledgerRecordCanceled";
      id: BmeRecordId;
      cancelReason: string;
      owner: string;
      to: string;
      coinsToBurn: BmeCoin | null;
      denomToMint: string;
    };

export type BmeChange = BmeChangeBody & { txIndex: number | null; ordinal: number };

export interface BmeBlockChanges {
  height: number;
  changes: BmeChange[];
  warnings: string[];
}

type ParsedChange = { change: BmeChangeBody } | { error: string };

/**
 * Extracts the BME (burn-mint-equilibrium) lifecycle from a block's events: executed ledger records,
 * mint status transitions and canceled records. Events of failed transactions are skipped; in practice
 * BME fires in the EndBlocker, but tx events are scanned too since the natural keys dedupe either way.
 * `ordinal` counts every BME-typed event in scan order — including ones that fail to parse — so a later
 * parser fix replays with stable ordinals. That stability only holds while the scanned event-type set is
 * fixed: adding a BME event type shifts every later ordinal on replay, duplicating `bme_status_changes`
 * rows unless previously derived rows are wiped first. Parse failures land in `warnings` for the writer
 * to log; a malformed event must not halt the block.
 */
export function deriveBmeChanges(block: DecodedBlock): BmeBlockChanges {
  const changes: BmeChange[] = [];
  const warnings: string[] = [];
  let ordinal = 0;

  const append = (events: DecodedEvent[], txIndex: number | null) => {
    for (const event of events) {
      const result = bmeChangeBody(event);
      if (!result) {
        continue;
      }
      if ("error" in result) {
        warnings.push(`height=${block.height} ordinal=${ordinal} type=${event.type}: ${result.error}`);
      } else {
        changes.push({ ...result.change, txIndex, ordinal });
      }
      ordinal += 1;
    }
  };

  for (const tx of block.transactions) {
    if (tx.code !== 0) {
      continue;
    }
    append(tx.events, tx.index);
  }
  append(block.blockEvents, null);

  return { height: block.height, changes, warnings };
}

export function collectBmeAddresses(blocks: BmeBlockChanges[]): Set<string> {
  const addresses = new Set<string>();
  for (const block of blocks) {
    for (const change of block.changes) {
      if (change.kind === "ledgerRecordExecuted") {
        addresses.add(change.burnedFrom);
        addresses.add(change.mintedTo);
      } else if (change.kind === "ledgerRecordCanceled") {
        addresses.add(change.owner);
        addresses.add(change.to);
      }
    }
  }
  return addresses;
}

function bmeChangeBody(event: DecodedEvent): ParsedChange | null {
  switch (event.type) {
    case LEDGER_RECORD_EXECUTED_EVENT_TYPE:
      return ledgerRecordExecuted(event.attributes);
    case MINT_STATUS_CHANGE_EVENT_TYPE:
      return mintStatusChange(event.attributes);
    case LEDGER_RECORD_CANCELED_EVENT_TYPE:
      return ledgerRecordCanceled(event.attributes);
    default:
      return null;
  }
}

function ledgerRecordExecuted(attributes: Record<string, string>): ParsedChange {
  const id = parseRecordId(attributes.id);
  if (!id) {
    return { error: `unparseable id attribute: ${attributes.id}` };
  }
  const burnedFrom = parseQuotedString(attributes.burned_from);
  const mintedTo = parseQuotedString(attributes.minted_to);
  if (!burnedFrom || !mintedTo) {
    return { error: "missing burned_from or minted_to" };
  }
  const burned = parseCoinPrice(attributes.burned);
  const minted = parseCoinPrice(attributes.minted);
  const spread = parseCoin(attributes.spread);
  const remintCreditIssued = parseCoinPrice(attributes.remint_credit_issued);
  const remintCreditAccrued = parseCoinPrice(attributes.remint_credit_accrued);
  const malformed = [burned, minted, spread, remintCreditIssued, remintCreditAccrued].some(coin => coin === undefined);
  if (malformed) {
    return { error: "malformed coin attribute" };
  }
  return {
    change: {
      kind: "ledgerRecordExecuted",
      id,
      burnedFrom,
      mintedTo,
      burned: burned ?? null,
      minted: minted ?? null,
      spread: spread ?? null,
      remintCreditIssued: remintCreditIssued ?? null,
      remintCreditAccrued: remintCreditAccrued ?? null
    }
  };
}

function mintStatusChange(attributes: Record<string, string>): ParsedChange {
  const previousStatus = parseQuotedString(attributes.previous_status);
  const newStatus = parseQuotedString(attributes.new_status);
  const collateralRatio = parseQuotedString(attributes.collateral_ratio);
  if (!isMintStatus(previousStatus) || !isMintStatus(newStatus)) {
    return { error: `unknown mint status: ${previousStatus} -> ${newStatus}` };
  }
  if (!collateralRatio || !isDecString(collateralRatio)) {
    return { error: `unparseable collateral_ratio: ${attributes.collateral_ratio}` };
  }
  return { change: { kind: "mintStatusChange", previousStatus, newStatus, collateralRatio } };
}

function ledgerRecordCanceled(attributes: Record<string, string>): ParsedChange {
  const id = parseRecordId(attributes.id);
  if (!id) {
    return { error: `unparseable id attribute: ${attributes.id}` };
  }
  const cancelReason = parseQuotedString(attributes.cancel_reason);
  const owner = parseQuotedString(attributes.owner);
  const to = parseQuotedString(attributes.to);
  const denomToMint = parseQuotedString(attributes.denom_to_mint);
  if (!cancelReason || !owner || !to || !denomToMint) {
    return { error: "missing cancel_reason, owner, to or denom_to_mint" };
  }
  const coinsToBurn = parseCoin(attributes.coins_to_burn);
  if (coinsToBurn === undefined) {
    return { error: "malformed coins_to_burn attribute" };
  }
  return { change: { kind: "ledgerRecordCanceled", id, cancelReason, owner, to, coinsToBurn: coinsToBurn ?? null, denomToMint } };
}

function parseRecordId(raw: string | undefined): BmeRecordId | null {
  const record = parseJsonRecord(raw);
  const denom = asString(record?.denom);
  const toDenom = asString(record?.to_denom);
  const source = asString(record?.source);
  const recordHeight = asInteger(record?.height);
  const sequence = asInteger(record?.sequence);
  if (!denom || !toDenom || !source || recordHeight === null || sequence === null) {
    return null;
  }
  return { denom, toDenom, source, recordHeight, sequence };
}

/**
 * `undefined` = the attribute is present but malformed; `null` = absent, which is a valid state.
 * An unset proto message field reaches the wire as the literal JSON `null` (e.g. `burned` on a pure
 * mint), so that counts as absent too.
 */
function parseCoinPrice(raw: string | undefined): BmeCoinPrice | null | undefined {
  const parsed = parseJsonAttribute(raw);
  if (parsed === null) {
    return null;
  }
  const record = asRecord(parsed);
  const coin = coinOf(asRecord(record?.coin));
  if (!coin) {
    return undefined;
  }
  const price = asString(record?.price);
  if (price !== null && !isDecString(price)) {
    return undefined;
  }
  return { ...coin, price };
}

function parseCoin(raw: string | undefined): BmeCoin | null | undefined {
  const parsed = parseJsonAttribute(raw);
  if (parsed === null) {
    return null;
  }
  return coinOf(asRecord(parsed)) ?? undefined;
}

/** `null` = absent (missing attribute or JSON null); `undefined` = present but not valid JSON. */
function parseJsonAttribute(raw: string | undefined): unknown {
  if (raw === undefined) {
    return null;
  }
  try {
    return JSON.parse(raw) ?? null;
  } catch {
    return undefined;
  }
}

function coinOf(record: Record<string, unknown> | null): BmeCoin | null {
  const denom = asString(record?.denom);
  const amount = asString(record?.amount);
  if (!denom || !amount || !/^\d+$/.test(amount)) {
    return null;
  }
  return { denom, amount };
}

/**
 * Strips the JSON string encoding CometBFT ABCI 2.0+ applies to proto string/Dec/enum attributes
 * (e.g. `"bme"` or `"1.75"`), falling back to the raw value for unquoted legacy attributes.
 */
function parseQuotedString(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      return asString(JSON.parse(raw));
    } catch {
      return raw;
    }
  }
  return raw;
}

function isMintStatus(value: string | null): value is BmeMintStatus {
  return value !== null && MINT_STATUSES.has(value);
}

export function isDecString(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value);
}
