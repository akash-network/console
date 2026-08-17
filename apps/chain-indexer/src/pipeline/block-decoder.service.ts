import { fromBase64 } from "@cosmjs/encoding";
import { decodeTxRaw } from "@cosmjs/proto-signing";
import { createHash } from "node:crypto";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { toCanonicalJson } from "@src/pipeline/canonical-json";
import { decodeIfBase64 } from "@src/pipeline/decode-if-base64";
import type { DecodedBlock, DecodedEvent, DecodedMessage, DecodedTransaction, MessageDecodeFailure } from "@src/pipeline/decoded-block";
import { MAX_EXEC_DEPTH, MSG_EXEC_TYPE_URL } from "@src/pipeline/msg-exec";
import { deriveSignerAddresses } from "@src/pipeline/signer-addresses";
import { isIgnoredTypeUrl } from "@src/proto/type-catalog";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { Registry } from "@src/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import type { RpcBlockResult, RpcBlockResultsResult, RpcEvent, RpcTxResult } from "@src/rpc/rpc-types";

/**
 * The ledger derives balances and reasons from the coin/transfer/mint/burn/slash events; the gov events carry
 * proposal ids and lifecycle transitions for the governance handler; the akash events catch deployment and
 * lease closes that happen as side effects of other messages (group close, overdraw) — `akash.v1` is the
 * legacy string-attribute event of early mainnet, the typed events are the current chain's. The bme events
 * carry the executed/canceled ledger records and mint status transitions the BME handler derives from
 * (EventVaultFunded is deliberately absent: the vault's balance is already exact in the balance ledger).
 * Capturing the rest would waste memory across backfill batches.
 */
const RELEVANT_EVENT_TYPES = new Set([
  "coin_spent",
  "coin_received",
  "transfer",
  "coinbase",
  "burn",
  "slash",
  "submit_proposal",
  "active_proposal",
  "inactive_proposal",
  "akash.v1",
  "akash.deployment.v1.EventDeploymentClosed",
  "akash.market.v1.EventLeaseClosed",
  "akash.bme.v1.EventLedgerRecordExecuted",
  "akash.bme.v1.EventMintStatusChange",
  "akash.bme.v1.EventLedgerRecordCanceled"
]);

const MSG_INDEX_ATTRIBUTE = "msg_index";

@singleton()
export class BlockDecoderService {
  readonly #registry: Registry;
  readonly #maxBodyBytes: number;

  constructor(@inject(TYPE_REGISTRY) registry: Registry, @inject(APP_CONFIG) config: EnvConfig) {
    this.#registry = registry;
    this.#maxBodyBytes = config.MESSAGE_BODY_MAX_BYTES;
  }

  decode(block: RpcBlockResult, blockResults: RpcBlockResultsResult): DecodedBlock {
    const rawTxs = block.block.data.txs;
    const txResults = blockResults.txs_results ?? [];

    if (rawTxs.length !== txResults.length) {
      throw new Error(`Block ${block.block.header.height} has ${rawTxs.length} txs but ${txResults.length} tx results`);
    }

    return {
      height: parseInt(block.block.header.height),
      datetime: new Date(block.block.header.time),
      hash: Buffer.from(block.block_id.hash, "hex"),
      parentHash: block.block.header.last_block_id?.hash ? Buffer.from(block.block.header.last_block_id.hash, "hex") : null,
      proposerAddress: block.block.header.proposer_address,
      transactions: rawTxs.map((rawTx, index) => this.#decodeTransaction(rawTx, txResults[index], index)),
      blockEvents: this.#decodeBlockEvents(blockResults)
    };
  }

  #decodeTransaction(rawTxBase64: string, txResult: RpcTxResult, index: number): DecodedTransaction {
    const rawTx = fromBase64(rawTxBase64);
    const decodedTx = decodeTxRaw(rawTx);

    return {
      index,
      hash: createHash("sha256").update(rawTx).digest(),
      code: txResult.code ?? 0,
      gasUsed: parseInt(txResult.gas_used ?? "0"),
      gasWanted: parseInt(txResult.gas_wanted ?? "0"),
      fee: decodedTx.authInfo.fee?.amount.map(({ denom, amount }) => ({ denom, amount })) ?? [],
      messages: decodedTx.body.messages.map((message, messageIndex) => this.#decodeMessage(message, messageIndex)),
      events: this.#decodeEvents(txResult.events),
      signerAddresses: deriveSignerAddresses(decodedTx.authInfo.signerInfos)
    };
  }

  /**
   * ABCI 2.0 (CometBFT 0.38+) merges begin/end block events into `finalize_block_events`; older nodes split
   * them. Mirrors the legacy indexer's `finalize_block_events ?? [...begin, ...end]` normalization.
   */
  #decodeBlockEvents(blockResults: RpcBlockResultsResult): DecodedEvent[] {
    const rawEvents = blockResults.finalize_block_events ?? [...(blockResults.begin_block_events ?? []), ...(blockResults.end_block_events ?? [])];
    return this.#decodeEvents(rawEvents);
  }

  #decodeEvents(rawEvents: RpcEvent[] | undefined): DecodedEvent[] {
    if (!rawEvents) {
      return [];
    }

    return rawEvents.filter(event => RELEVANT_EVENT_TYPES.has(event.type)).map(event => this.#decodeEvent(event));
  }

  #decodeEvent(event: RpcEvent): DecodedEvent {
    const attributes: Record<string, string> = {};
    let msgIndex: number | undefined;

    for (const attribute of event.attributes) {
      const key = decodeIfBase64(attribute.key);
      const value = attribute.value ? decodeIfBase64(attribute.value) : "";
      attributes[key] = value;

      if (key === MSG_INDEX_ATTRIBUTE) {
        msgIndex = parseInt(value);
      }
    }

    return msgIndex === undefined ? { type: event.type, attributes } : { type: event.type, attributes, msgIndex };
  }

  #decodeMessage(message: { typeUrl: string; value: Uint8Array }, index: number): DecodedMessage {
    const { body, failure } = this.#decodeBody(message);

    return failure ? { index, typeUrl: message.typeUrl, body, decodeFailure: failure } : { index, typeUrl: message.typeUrl, body };
  }

  #decodeBody(message: { typeUrl: string; value: Uint8Array }): { body: unknown | null; failure?: MessageDecodeFailure } {
    if (isIgnoredTypeUrl(message.typeUrl)) {
      return { body: null };
    }

    try {
      const decoded = this.#registry.decode(message);
      const enriched = message.typeUrl === MSG_EXEC_TYPE_URL ? this.#decodeExecMessages(decoded, 1) : decoded;
      return { body: toCanonicalJson(enriched, this.#maxBodyBytes) };
    } catch (error) {
      return { body: null, failure: { raw: message.value, error: error instanceof Error ? error.message : String(error) } };
    }
  }

  /**
   * MsgExec carries its inner messages as Any, which canonical JSON would keep as opaque base64. Each
   * inner message additionally gets a `decoded` field so handlers can read authz-wrapped messages
   * (every managed-wallet deployment arrives this way). The raw `typeUrl`/`value` pair is kept, and an
   * inner message that fails to decode gets `decoded: null` rather than dead-lettering the whole exec.
   */
  #decodeExecMessages(decoded: unknown, depth: number): unknown {
    const record = decoded as { msgs?: Array<{ typeUrl: string; value: Uint8Array }> };
    if (!Array.isArray(record.msgs)) {
      return decoded;
    }

    const msgs = record.msgs.map(inner => {
      try {
        const innerDecoded = isIgnoredTypeUrl(inner.typeUrl) ? null : this.#registry.decode(inner);
        const enriched = inner.typeUrl === MSG_EXEC_TYPE_URL && depth < MAX_EXEC_DEPTH ? this.#decodeExecMessages(innerDecoded, depth + 1) : innerDecoded;
        return { ...inner, decoded: enriched };
      } catch {
        return { ...inner, decoded: null };
      }
    });

    return { ...record, msgs };
  }
}
