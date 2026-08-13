import { parseCoins } from "@src/pipeline/balance/coin-amount";
import type { ModuleAddressRegistry } from "@src/pipeline/balance/module-address-registry";
import type { BalanceReason } from "@src/pipeline/balance/reason-classifier";
import { classifyReason } from "@src/pipeline/balance/reason-classifier";
import type { DecodedBlock, DecodedEvent, DecodedTransaction } from "@src/pipeline/decoded-block";

/** A single balance movement before its address is interned to an account id. Deltas come only from coin_spent/coin_received. */
export interface DerivedBalanceChange {
  address: string;
  counterpartyAddress: string | null;
  denom: string;
  delta: bigint;
  reason: BalanceReason;
  height: number;
  txIndex: number | null;
  eventIndex: number;
}

const BLOCK_SCOPE = "block";

interface ParsedTransfer {
  sender: string;
  recipient: string;
  denoms: Set<string>;
}

/**
 * Per-scope classification context: the transfers to correlate a counterparty against, plus which addresses
 * minted/burned and whether a slash occurred. `slashed` is scope-wide because a `slash` event names the
 * validator, not the staking pool whose coins actually move, so it is only trusted to reclassify the
 * coincident burn leg (see `deriveBalanceChanges`), never every movement sharing the scope.
 */
interface ScopeContext {
  transfers: ParsedTransfer[];
  minters: Set<string>;
  burners: Set<string>;
  slashed: boolean;
}

interface EventSource {
  events: DecodedEvent[];
  txIndex: number | null;
  msgTypeByIndex: Map<number, string>;
}

function scopeKeyOf(event: DecodedEvent): number | string {
  return event.msgIndex ?? BLOCK_SCOPE;
}

function buildScopeContexts(events: DecodedEvent[]): Map<number | string, ScopeContext> {
  const scopes = new Map<number | string, ScopeContext>();
  const scopeOf = (event: DecodedEvent) => {
    const key = scopeKeyOf(event);
    const existing = scopes.get(key);
    if (existing) {
      return existing;
    }
    const created: ScopeContext = { transfers: [], minters: new Set(), burners: new Set(), slashed: false };
    scopes.set(key, created);
    return created;
  };

  for (const event of events) {
    const scope = scopeOf(event);
    if (event.type === "transfer") {
      scope.transfers.push({
        sender: event.attributes.sender,
        recipient: event.attributes.recipient,
        denoms: new Set(parseCoins(event.attributes.amount ?? "").map(coin => coin.denom))
      });
    } else if (event.type === "coinbase" && event.attributes.minter) {
      scope.minters.add(event.attributes.minter);
    } else if (event.type === "burn" && event.attributes.burner) {
      scope.burners.add(event.attributes.burner);
    } else if (event.type === "slash") {
      scope.slashed = true;
    }
  }

  return scopes;
}

function correlateCounterparty(scope: ScopeContext, holder: string, denom: string, direction: "spent" | "received"): string | null {
  const matchesHolder = (transfer: ParsedTransfer) => (direction === "spent" ? transfer.sender === holder : transfer.recipient === holder);
  const other = (transfer: ParsedTransfer) => (direction === "spent" ? transfer.recipient : transfer.sender);

  const byDenom = scope.transfers.find(transfer => matchesHolder(transfer) && transfer.denoms.has(denom));
  const byHolder = scope.transfers.find(matchesHolder);
  const match = byDenom ?? byHolder;

  return match ? other(match) : null;
}

/**
 * Turns a block's coin events into ordered balance movements. Deltas come solely from `coin_spent`
 * (holder −amount) and `coin_received` (holder +amount); `transfer`/`coinbase`/`burn`/`slash` only
 * inform the counterparty and reason. The `event_index` is a deterministic block-wide sequence — each tx
 * in ascending order, its coin events in array order expanded per denom, then block-level events — so a
 * re-derivation of the same block reproduces the exact `(height, event_index)` idempotency keys.
 */
export function deriveBalanceChanges(block: DecodedBlock, registry: ModuleAddressRegistry): DerivedBalanceChange[] {
  const sources: EventSource[] = [
    ...[...block.transactions].sort((a, b) => a.index - b.index).map(tx => ({ events: tx.events, txIndex: tx.index, msgTypeByIndex: msgTypeByIndexOf(tx) })),
    { events: block.blockEvents, txIndex: null, msgTypeByIndex: new Map<number, string>() }
  ];

  const changes: DerivedBalanceChange[] = [];
  let eventIndex = 0;

  for (const source of sources) {
    const scopes = buildScopeContexts(source.events);

    for (const event of source.events) {
      const direction = event.type === "coin_spent" ? "spent" : event.type === "coin_received" ? "received" : null;
      if (!direction) {
        continue;
      }

      const holder = direction === "spent" ? event.attributes.spender : event.attributes.receiver;
      const scope = scopes.get(scopeKeyOf(event)) ?? { transfers: [], minters: new Set<string>(), burners: new Set<string>(), slashed: false };
      const msgTypeUrl = event.msgIndex === undefined ? null : source.msgTypeByIndex.get(event.msgIndex) ?? null;
      const isMint = direction === "received" && scope.minters.has(holder);
      const isBurn = direction === "spent" && scope.burners.has(holder);
      const isSlash = scope.slashed && isBurn;

      for (const coin of parseCoins(event.attributes.amount ?? "")) {
        const counterpartyAddress = correlateCounterparty(scope, holder, coin.denom, direction);
        const reason = classifyReason({ address: holder, counterpartyAddress, denom: coin.denom, isMint, isBurn, isSlash, msgTypeUrl }, registry);

        changes.push({
          address: holder,
          counterpartyAddress,
          denom: coin.denom,
          delta: direction === "spent" ? -coin.amount : coin.amount,
          reason,
          height: block.height,
          txIndex: source.txIndex,
          eventIndex: eventIndex++
        });
      }
    }
  }

  return changes;
}

function msgTypeByIndexOf(tx: DecodedTransaction): Map<number, string> {
  return new Map(tx.messages.map(message => [message.index, message.typeUrl]));
}
