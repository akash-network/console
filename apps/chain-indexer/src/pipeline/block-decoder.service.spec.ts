import { Registry } from "@cosmjs/proto-signing";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { MsgExec } from "cosmjs-types/cosmos/authz/v1beta1/tx";
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

  it("marks message types missing from the registry as decode failures with their raw bytes", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx("/akash.unknown.v1.MsgMystery");

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    const [message] = decoded.transactions[0].messages;
    expect(message.typeUrl).toBe("/akash.unknown.v1.MsgMystery");
    expect(message.body).toBeNull();
    expect(message.decodeFailure?.error).toContain("Unregistered type url");
    expect(message.decodeFailure?.raw).toEqual(encodeMsgSendValue());
  });

  it("marks registered message types with undecodable bytes as decode failures", () => {
    const { decoder } = setup();
    const corruptBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
    const rawTx = buildMsgSendTx("/cosmos.bank.v1beta1.MsgSend", corruptBytes);

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    const [message] = decoded.transactions[0].messages;
    expect(message.body).toBeNull();
    expect(message.decodeFailure?.raw).toEqual(corruptBytes);
    expect(message.decodeFailure?.error).toBeTruthy();
  });

  it("skips ignored message types without marking a decode failure", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx("/cosmwasm.wasm.v1.MsgExecuteContract");

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    const [message] = decoded.transactions[0].messages;
    expect(message.body).toBeNull();
    expect(message.decodeFailure).toBeUndefined();
  });

  it("stores a null body without a decode failure when the decoded message exceeds the size cap", () => {
    const { decoder } = setup({ maxBodyBytes: 10 });
    const rawTx = buildMsgSendTx();

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    expect(decoded.transactions[0].messages[0].body).toBeNull();
    expect(decoded.transactions[0].messages[0].decodeFailure).toBeUndefined();
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

  it("captures akash close events for the deployment handler", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();
    const txResult: RpcTxResult = {
      code: 0,
      gas_used: "0",
      gas_wanted: "0",
      events: [
        event("akash.v1", { action: "deployment-closed", owner: "akash1owner", dseq: "3" }),
        event("akash.deployment.v1.EventDeploymentClosed", { id: '{"owner":"akash1owner","dseq":"3"}' }),
        event("akash.market.v1.EventLeaseClosed", { id: '{"owner":"akash1owner","dseq":"3","gseq":1,"oseq":1,"provider":"akash1prov"}' })
      ]
    };

    const [tx] = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([txResult])).transactions;

    expect(tx.events.map(e => e.type)).toEqual(["akash.v1", "akash.deployment.v1.EventDeploymentClosed", "akash.market.v1.EventLeaseClosed"]);
  });

  it("additively decodes MsgExec inner messages, recursing into nested execs", () => {
    const { decoder } = setup();
    const innerExec = MsgExec.encode(
      MsgExec.fromPartial({ grantee: "akash1inner", msgs: [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: encodeMsgSendValue() }] })
    ).finish();
    const outerExec = MsgExec.encode(
      MsgExec.fromPartial({ grantee: "akash1outer", msgs: [{ typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: innerExec }] })
    ).finish();
    const rawTx = buildMsgSendTx("/cosmos.authz.v1beta1.MsgExec", outerExec);

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    const body = decoded.transactions[0].messages[0].body as {
      msgs: Array<{ typeUrl: string; value: string; decoded: { msgs: Array<{ decoded: unknown }> } }>;
    };
    expect(body.msgs[0].typeUrl).toBe("/cosmos.authz.v1beta1.MsgExec");
    expect(body.msgs[0].value).toBe(Buffer.from(innerExec).toString("base64"));
    expect(body.msgs[0].decoded.msgs[0].decoded).toMatchObject({ fromAddress: "akash1from", toAddress: "akash1to" });
  });

  it("marks undecodable MsgExec inner messages with a null decoded field without failing the exec", () => {
    const { decoder } = setup();
    const exec = MsgExec.encode(
      MsgExec.fromPartial({ grantee: "akash1outer", msgs: [{ typeUrl: "/akash.unknown.v1.MsgMystery", value: new Uint8Array([1, 2, 3]) }] })
    ).finish();
    const rawTx = buildMsgSendTx("/cosmos.authz.v1beta1.MsgExec", exec);

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 0, gas_used: "0", gas_wanted: "0" }]));

    const [message] = decoded.transactions[0].messages;
    expect(message.decodeFailure).toBeUndefined();
    expect((message.body as { msgs: Array<{ decoded: unknown }> }).msgs[0].decoded).toBeNull();
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

  it("captures bme lifecycle block events for the bme handler but drops vault funded ones", () => {
    const { decoder } = setup();

    const decoded = decoder.decode(
      buildBlock({ txs: [] }),
      buildBlockResults([], {
        finalize_block_events: [
          event("akash.bme.v1.EventLedgerRecordExecuted", { id: '{"denom":"uakt","to_denom":"uact","source":"bme","height":100,"sequence":1}' }),
          event("akash.bme.v1.EventMintStatusChange", { previous_status: '"mint_status_healthy"', new_status: '"mint_status_warning"' }),
          event("akash.bme.v1.EventLedgerRecordCanceled", { cancel_reason: '"epsilon"' }),
          event("akash.bme.v1.EventVaultFunded", { source: '"bme"' })
        ]
      })
    );

    expect(decoded.blockEvents.map(e => e.type)).toEqual([
      "akash.bme.v1.EventLedgerRecordExecuted",
      "akash.bme.v1.EventMintStatusChange",
      "akash.bme.v1.EventLedgerRecordCanceled"
    ]);
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

  function encodeMsgSendValue(): Uint8Array {
    return MsgSend.encode({
      fromAddress: "akash1from",
      toAddress: "akash1to",
      amount: [{ denom: "uakt", amount: "42" }]
    }).finish();
  }

  function buildMsgSendTx(typeUrl = "/cosmos.bank.v1beta1.MsgSend", messageValue = encodeMsgSendValue()): Buffer {
    const bodyBytes = TxBody.encode(TxBody.fromPartial({ messages: [{ typeUrl, value: messageValue }] })).finish();
    const authInfoBytes = AuthInfo.encode(
      AuthInfo.fromPartial({ fee: { amount: [{ denom: "uakt", amount: "5000" }], gasLimit: 70_000n, payer: "", granter: "" }, signerInfos: [] })
    ).finish();

    return Buffer.from(TxRaw.encode(TxRaw.fromPartial({ bodyBytes, authInfoBytes, signatures: [new Uint8Array(64)] })).finish());
  }
});
