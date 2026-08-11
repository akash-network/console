import { Registry } from "@cosmjs/proto-signing";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { AuthInfo, TxBody, TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { envSchema } from "@src/config/env.config";
import { BlockDecoderService } from "@src/pipeline/block-decoder.service";
import type { RpcBlockResult, RpcBlockResultsResult } from "@src/rpc/rpc-types";

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

  it("marks failed transactions with their error code", () => {
    const { decoder } = setup();
    const rawTx = buildMsgSendTx();

    const decoded = decoder.decode(buildBlock({ txs: [rawTx.toString("base64")] }), buildBlockResults([{ code: 11, gas_used: "70000", gas_wanted: "70000" }]));

    expect(decoded.transactions[0].code).toBe(11);
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

  function buildBlockResults(txsResults: { code: number; gas_used: string; gas_wanted: string }[]): RpcBlockResultsResult {
    return { height: "1234", txs_results: txsResults };
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
