import { fromBase64 } from "@cosmjs/encoding";
import { decodeTxRaw } from "@cosmjs/proto-signing";
import { createHash } from "node:crypto";
import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { toCanonicalJson } from "@src/pipeline/canonical-json";
import type { DecodedBlock, DecodedMessage, DecodedTransaction } from "@src/pipeline/decoded-block";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import type { Registry } from "@src/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import type { RpcBlockResult, RpcBlockResultsResult, RpcTxResult } from "@src/rpc/rpc-types";

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
      transactions: rawTxs.map((rawTx, index) => this.#decodeTransaction(rawTx, txResults[index], index))
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
      messages: decodedTx.body.messages.map((message, messageIndex) => this.#decodeMessage(message, messageIndex))
    };
  }

  #decodeMessage(message: { typeUrl: string; value: Uint8Array }, index: number): DecodedMessage {
    return {
      index,
      typeUrl: message.typeUrl,
      body: this.#decodeBody(message)
    };
  }

  #decodeBody(message: { typeUrl: string; value: Uint8Array }): unknown | null {
    try {
      return toCanonicalJson(this.#registry.decode(message), this.#maxBodyBytes);
    } catch {
      return null;
    }
  }
}
