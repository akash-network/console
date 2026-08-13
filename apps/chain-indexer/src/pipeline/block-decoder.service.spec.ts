import { Registry } from "@cosmjs/proto-signing";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { AuthInfo, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { envSchema } from "@src/config/env.config";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { RpcBlockResult, RpcBlockResultsResult, RpcEvent, RpcTxResult } from "@src/rpc/rpc-types";

describe(BlockDecoderService.name, () => {
  it("decodes block metadata with hashes as buffers", () => {
    const { decoder } = setup();

    const decoded = decoder.decode(buildBlock({ txs: [] }), buildBlockResults([]));

    expect(decoded.height).toBe(1234);
    expect(decoded.datetime).toEqual(new Date("2026-08-11T00:00:00Z"));
    expect(decoded.hash).toEqual(Buffer.from("aa".repeat(32), "hex"));
    expect(decoded.parentHash).toEqual(Buffer.from("bb".repeat(32), "hex"));
    expect(decoded.proposerAddress).toBe("PROPOSER");
    expect(decoded.transactions).toEqual([]);
  });

  it("decodes a transaction with its sha256 hash, gas, fee, and typed message body", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "51000", gas_wanted: "70000" }]));

    const [tx] = decoded.transactions;
    expect(tx.hash).toEqual(createHash("sha256").update(rawTx).digest());
    expect(tx.code).toBe(0);
    expect(tx.gasUsed).toBe(51000);
    expect(tx.gasWanted).toBe(70000);
    expect(tx.fee).toEqual([{ denom: "uakt", amount: "5000" }]);
    expect(tx.messages).toHaveLength(1);
    expect(tx.messages[0].typeUrl).toBe("/cosmos.bank.v1beta1.MsgSend");
    expect(tx.messages[0].body).toMatchObject({
      fromAddress: "akash1from",
      toAddress: "akash1to",
      amount: [{ denom: "uakt", amount: "42" }]
    });
  });

  it("stores a null body for message types missing from the registry", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx("/akash.unknown.v1.MsgMystery");

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    expect(decoded.transactions[0].messages[0].typeUrl).toBe("/akash.unknown.v1.MsgMystery");
    expect(decoded.transactions[0].messages[0].body).toBeNull();
  });

  it("stores a null body when the decoded message exceeds the size cap", () => {
    const { decoder } = setup({ maxBodyBytes: 10 });
    const rawTx = buildMsgSendTx();

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    expect(decoded.transactions[0].messages[0].body).toBeNull();
  });

  it("throws when the tx results count does not match the block txs", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();

    expect(() => decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), { height: "1234", txs_results: null })).toThrow(
      "Block 1234 has 1 txs but 0 tx results"
    );
  });

  it("marks failed transactions with their error code", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 11, gas_used: "70000", gas_wanted: "70000" }]));

    expect(decoded.transactions[0].code).toBe(11);
  });

  it("captures relevant tx events with their msg_index and drops irrelevant ones", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();
    const txResult: RpcTxResult = {
      code: 0,
      gas_used: "0",
      gas_wanted: "0",
      events: [
        event("coin_spent", { spender: "akash1from", amount: "42uakt", msg_index: "0" }),
        event("tx", { fee: "5000uakt" }),
        event("message", { action: "/cosmos.bank.v1beta1.MsgSend" }),
        event("coin_received", { receiver: "akash1to", amount: "42uakt", msg_index: "0" })
      ]
    };

    const [tx] = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([txResult])).transactions;

    expect(tx.events).toEqual([
      { type: "coin_spent", attributes: { spender: "akash1from", amount: "42uakt", msg_index: "0" }, msgIndex: 0 },
      { type: "coin_received", attributes: { receiver: "akash1to", amount: "42uakt", msg_index: "0" }, msgIndex: 0 }
    ]);
  });

  it("normalizes base64-encoded event attributes", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();
    const txResult: RpcTxResult = {
      code: 0,
      gas_used: "0",
      gas_wanted: "0",
      events: [event("coin_spent", { "c3BlbmRlcg==": "YWthc2gxZnJvbQ==" })]
    };

    const [tx] = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([txResult])).transactions;

    expect(tx.events[0].attributes).toEqual({ spender: "akash1from" });
  });

  it("keeps a failed transaction's fee coin events", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();
    const txResult: RpcTxResult = {
      code: 11,
      gas_used: "70000",
      gas_wanted: "70000",
      events: [
        event("coin_spent", { spender: "akash1payer", amount: "5000uakt" }),
        event("coin_received", { receiver: "akash1feecollector", amount: "5000uakt" })
      ]
    };

    const [tx] = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([txResult])).transactions;

    expect(tx.code).toBe(11);
    expect(tx.events.map(e => e.type)).toEqual(["coin_spent", "coin_received"]);
  });

  it("prefers finalize_block_events for block-level events", () => {
    const { decoder } = setup();

    const decoded = decoder.decode(
      buildBlock({ txs: [] }),
      buildBlockResults([], {
        finalize_block_events: [event("coinbase", { minter: "akash1mint", amount: "10uakt" })],
        begin_block_events: [event("transfer", { sender: "ignored", recipient: "ignored", amount: "1uakt" })]
      })
    );

    expect(decoded.blockEvents).toEqual([{ type: "coinbase", attributes: { minter: "akash1mint", amount: "10uakt" } }]);
  });

  it("falls back to begin and end block events when finalize is absent", () => {
    const { decoder } = setup();

    const decoded = decoder.decode(
      buildBlock({ txs: [] }),
      buildBlockResults([], {
        begin_block_events: [event("coin_received", { receiver: "akash1begin", amount: "1uakt" })],
        end_block_events: [event("coin_spent", { spender: "akash1end", amount: "2uakt" })]
      })
    );

    expect(decoded.blockEvents.map(e => e.type)).toEqual(["coin_received", "coin_spent"]);
  });

  function setup(input?: { maxBodyBytes?: number }) {
    const config = envSchema.parse({
      POSTGRES_DB_URI: "postgres://unit:unit@localhost:5432/unit",
      ...(input?.maxBodyBytes ? { MESSAGE_BODY_MAX_BYTES: input.maxBodyBytes } : {})
    });
    const decoder = new BlockDecoderService(new Registry(defaultRegistryTypes), config);
    return { decoder };
  }

  function buildBlock(input: { txs: string[] }): RpcBlockResult {
    return {
      block_id: { hash: "AA".repeat(32) },
      block: {
        header: {
          height: "1234",
          time: "2026-08-11T00:00:00Z",
          proposer_address: "PROPOSER",
          last_block_id: { hash: "BB".repeat(32) }
        },
        data: { txs: input.txs }
      }
    };
  }

  function buildBlockResults(
    txsResults: RpcTxResult[],
    blockEvents?: Partial<Pick<RpcBlockResultsResult, "finalize_block_events" | "begin_block_events" | "end_block_events">>
  ): RpcBlockResultsResult {
    return { height: "1234", txs_results: txsResults, ...blockEvents };
  }

  function event(type: string, attributes: Record<string, string>): RpcEvent {
    return { type, attributes: Object.entries(attributes).map(([key, value]) => ({ key, value })) };
  }

  function buildMsgSendTx(typeUrl = "/cosmos.bank.v1beta1.MsgSend"): Buffer {
    const message = MsgSend.encode({
      fromAddress: "akash1from",
      toAddress: "akash1to",
      amount: [{ denom: "uakt", amount: "42" }]
    }).finish();

    const bodyBytes = TxBody.encode(TxBody.fromPartial({ messages: [{ typeUrl, value: message }] })).finish();
    const authInfoBytes = AuthInfo.encode(
      AuthInfo.fromPartial({ fee: { amount: [{ denom: "uakt", amount: "5000" }], gasLimit: 70_000n, payer: "", granter: "" }, signerInfos: [] })
    ).finish();

    return Buffer.from(TxRaw.encode(TxRaw.fromPartial({ bodyBytes, authInfoBytes, signatures: [new Uint8Array(64)] })).finish());
  }
});
