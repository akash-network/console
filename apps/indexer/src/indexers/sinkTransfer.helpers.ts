import type { EventAttribute } from "./sinkIndexer.helpers";
import { parseCoinAmount, parseInteger, parseJson } from "./sinkIndexer.helpers";

export type SinkTransferStatus = "pending" | "minted" | "voided" | "refund_pending" | "refunded";

export type SinkTransferKey = { height: number; sequence: number };

export type SinkTransferState = { status: SinkTransferStatus; hasVoidOrder: boolean };

type SinkTransferResolution = "restart" | "confirmMint" | "confirmVoid";

export type SinkTransferCreation = { kind: "created"; key: SinkTransferKey; owner: string; recipient: string; amount: string };

export type SinkTransferStatusChange =
  | { kind: "voidOrdered" | "mintConfirmed" | "voidConfirmed" | "reportedWithoutSettlement" | "refunded"; key: SinkTransferKey }
  | { kind: "resolved"; key: SinkTransferKey; resolution: SinkTransferResolution };

export type SinkTransferChange = SinkTransferCreation | SinkTransferStatusChange | { kind: "malformed"; eventType: string };

type ChainEvent = { type: string; attributes?: EventAttribute[] };

type AttributeValues = Map<string, string | null | undefined>;

const EVENT_TYPE_PREFIX = "akash.sink.v1.";
const TRANSFER_CREATED = `${EVENT_TYPE_PREFIX}EventTransferCreated`;
const VOID_ORDERED = `${EVENT_TYPE_PREFIX}EventVoidOrdered`;
const MINT_CONFIRMED = `${EVENT_TYPE_PREFIX}EventMintConfirmed`;
const VOID_CONFIRMED = `${EVENT_TYPE_PREFIX}EventVoidConfirmed`;
const REPORT_CONFLICT = `${EVENT_TYPE_PREFIX}EventReportConflict`;
const OUTCOME_REPORTED = `${EVENT_TYPE_PREFIX}EventOutcomeReported`;
const TRANSFER_RESOLVED = `${EVENT_TYPE_PREFIX}EventTransferResolved`;
const TRANSFER_REFUNDED = `${EVENT_TYPE_PREFIX}EventTransferRefunded`;

const RESOLUTIONS = new Map<unknown, SinkTransferResolution>([
  ["DECISION_RESTART", "restart"],
  ["DECISION_CONFIRM_MINT", "confirmMint"],
  ["DECISION_CONFIRM_VOID", "confirmVoid"]
]);

const TRANSFER_EVENT_TYPES = new Set([
  TRANSFER_CREATED,
  VOID_ORDERED,
  MINT_CONFIRMED,
  VOID_CONFIRMED,
  REPORT_CONFLICT,
  OUTCOME_REPORTED,
  TRANSFER_RESOLVED,
  TRANSFER_REFUNDED
]);

/** Address columns are varchar(255), so a longer value would fail the insert and halt indexing. */
const MAX_ADDRESS_LENGTH = 255;

/** A report that settles or blocks a transfer follows a confirmation or conflict event in its message, so a report without one can only restart the settlement under a new reporter policy. */
export function readSinkTransferChanges(events: ChainEvent[]): SinkTransferChange[] {
  const changes: SinkTransferChange[] = [];
  let settledTransfer: SinkTransferKey | null = null;

  for (const event of events) {
    if (!TRANSFER_EVENT_TYPES.has(event.type)) continue;

    const values: AttributeValues = new Map((event.attributes ?? []).map(attribute => [attribute.key, attribute.value]));
    const key = parseTransferKey(values);
    if (!key) {
      changes.push({ kind: "malformed", eventType: event.type });
      continue;
    }

    if (event.type === OUTCOME_REPORTED) {
      if (!isSameTransfer(settledTransfer, key)) changes.push({ kind: "reportedWithoutSettlement", key });
      settledTransfer = null;
      continue;
    }

    if (event.type === MINT_CONFIRMED || event.type === VOID_CONFIRMED || event.type === REPORT_CONFLICT) settledTransfer = key;
    if (event.type !== REPORT_CONFLICT) changes.push(readChange(event.type, key, values));
  }

  return changes;
}

function readChange(eventType: string, key: SinkTransferKey, values: AttributeValues): SinkTransferChange {
  switch (eventType) {
    case TRANSFER_CREATED:
      return readCreation(key, values) ?? { kind: "malformed", eventType };
    case TRANSFER_RESOLVED:
      return readResolution(key, values) ?? { kind: "malformed", eventType };
    case VOID_ORDERED:
      return { kind: "voidOrdered", key };
    case MINT_CONFIRMED:
      return { kind: "mintConfirmed", key };
    case VOID_CONFIRMED:
      return { kind: "voidConfirmed", key };
    default:
      return { kind: "refunded", key };
  }
}

function readResolution(key: SinkTransferKey, values: AttributeValues): SinkTransferStatusChange | null {
  const resolution = RESOLUTIONS.get(parseJson(values.get("decision")));

  return resolution ? { kind: "resolved", key, resolution } : null;
}

function readCreation(key: SinkTransferKey, values: AttributeValues): SinkTransferCreation | null {
  const owner = parseAddress(readJsonField(values.get("id"), "owner"));
  const recipient = parseAddress(parseJson(values.get("recipient")));
  const amount = parseCoinAmount(values.get("amount"));
  if (!owner || !recipient || !amount) return null;

  return { kind: "created", key, owner, recipient, amount };
}

function parseTransferKey(values: AttributeValues): SinkTransferKey | null {
  const height = parseInteger(readJsonField(values.get("id"), "height"));
  const sequence = parseInteger(readJsonField(values.get("id"), "sequence"));

  return height === null || sequence === null ? null : { height, sequence };
}

function readJsonField(value: string | null | undefined, field: string): unknown {
  const parsed = parseJson(value);

  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>)[field] : undefined;
}

function parseAddress(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ADDRESS_LENGTH ? value : null;
}

function isSameTransfer(left: SinkTransferKey | null, right: SinkTransferKey) {
  return left?.height === right.height && left.sequence === right.sequence;
}

export function applySinkTransferChange(transfer: SinkTransferState, change: SinkTransferStatusChange): SinkTransferState {
  switch (change.kind) {
    case "voidOrdered":
      return { hasVoidOrder: true, status: transfer.status === "pending" ? "voided" : transfer.status };
    case "mintConfirmed":
      return { ...transfer, status: "minted" };
    case "voidConfirmed":
      return { ...transfer, status: "refund_pending" };
    case "reportedWithoutSettlement":
      return transfer.status === "refund_pending" ? { ...transfer, status: restartedStatus(transfer) } : transfer;
    case "refunded":
      return { ...transfer, status: "refunded" };
    case "resolved":
      return { ...transfer, status: resolvedStatus(transfer, change.resolution) };
  }
}

function resolvedStatus(transfer: SinkTransferState, resolution: SinkTransferResolution): SinkTransferStatus {
  if (resolution === "restart") return restartedStatus(transfer);
  if (resolution === "confirmMint") return "minted";

  return transfer.status === "refunded" ? "refunded" : "refund_pending";
}

function restartedStatus(transfer: SinkTransferState): SinkTransferStatus {
  return transfer.hasVoidOrder ? "voided" : "pending";
}
