import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { BaseAccount, QueryAccountResponse, SimulateResponse, TxBody, TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import type { Registry } from "@cosmjs/proto-signing";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { TxController } from "@src/controllers/tx/tx.controller";
import { app } from "@src/index";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";

import { createAkashAddress } from "@test/seeders";

interface JsonRpcRequest {
  id: number | string;
  method: string;
  params?: { path?: string; tx?: string };
}

describe(TxController.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  it("signs and broadcasts an unordered transaction through the derived wallet against a mocked RPC node", async () => {
    const { txHash, getBroadcastedTxs } = mockRpcNode();

    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: 1, messages: buildMessages() } }),
      headers: new Headers({ "Content-Type": "application/json" })
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { code: 0, hash: txHash, rawLog: "" } });

    const body = TxBody.decode(TxRaw.decode(fromBase64(getBroadcastedTxs()[0])).bodyBytes);
    expect(body.unordered).toBe(true);
    expect(body.timeoutTimestamp).toBeInstanceOf(Date);
  });

  it("signs and broadcasts an unordered transaction through the funding wallet against a mocked RPC node", async () => {
    const { txHash } = mockRpcNode();

    const res = await app.request("/v1/tx/funding", {
      method: "POST",
      body: JSON.stringify({ data: { messages: buildMessages() } }),
      headers: new Headers({ "Content-Type": "application/json" })
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { code: 0, hash: txHash, rawLog: "" } });
  });

  function buildMessages() {
    const registry = container.resolve<Registry>(TYPE_REGISTRY);
    const message = {
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: createAkashAddress(),
        cert: Uint8Array.from([1, 2, 3]),
        pubkey: Uint8Array.from([4, 5, 6])
      })
    };

    return [{ typeUrl: message.typeUrl, value: toBase64(registry.encode(message)) }];
  }

  function mockRpcNode(input: { chainId?: string; accountNumber?: number; sequence?: number; gasUsed?: number; height?: number; txHash?: string } = {}) {
    const chainId = input.chainId ?? "sandbox-01";
    const accountNumber = input.accountNumber ?? 42;
    const sequence = input.sequence ?? 7;
    const gasUsed = input.gasUsed ?? 100_000;
    const height = input.height ?? 1_000;
    const txHash = input.txHash ?? "AB".repeat(32);
    const broadcastedTxs: string[] = [];

    const accountValue = toBase64(
      QueryAccountResponse.encode(
        QueryAccountResponse.fromPartial({
          account: {
            typeUrl: "/cosmos.auth.v1beta1.BaseAccount",
            value: BaseAccount.encode(
              BaseAccount.fromPartial({ address: createAkashAddress(), accountNumber: BigInt(accountNumber), sequence: BigInt(sequence) })
            ).finish()
          }
        })
      ).finish()
    );

    const simulateValue = toBase64(
      SimulateResponse.encode(SimulateResponse.fromPartial({ gasInfo: { gasUsed: BigInt(gasUsed), gasWanted: BigInt(gasUsed) } })).finish()
    );

    const reply = (request: JsonRpcRequest) => {
      const base = { jsonrpc: "2.0", id: request.id };

      switch (request.method) {
        case "status":
          return {
            ...base,
            result: {
              node_info: {
                protocol_version: { p2p: "8", block: "11", app: "0" },
                id: "AB".repeat(20),
                listen_addr: "tcp://0.0.0.0:26656",
                network: chainId,
                version: "0.38.17",
                channels: "40202122233038606100",
                moniker: "test-node",
                other: { tx_index: "on", rpc_address: "tcp://0.0.0.0:26657" }
              },
              sync_info: {
                latest_block_hash: "AB".repeat(32),
                latest_app_hash: "AB".repeat(32),
                latest_block_height: String(height),
                latest_block_time: "2024-01-01T00:00:00.000Z",
                catching_up: false
              },
              validator_info: {
                address: "AB".repeat(20),
                pub_key: { type: "tendermint/PubKeyEd25519", value: toBase64(new Uint8Array(32)) },
                voting_power: "0"
              }
            }
          };
        case "abci_query": {
          const value = request.params?.path?.includes("Simulate") ? simulateValue : accountValue;
          return { ...base, result: { response: { code: 0, log: "", info: "", index: "0", value, height: String(height), codespace: "" } } };
        }
        case "broadcast_tx_sync":
          broadcastedTxs.push(request.params!.tx!);
          return { ...base, result: { code: 0, data: "", log: "", codespace: "", hash: txHash } };
        case "tx_search":
          return {
            ...base,
            result: {
              total_count: "1",
              txs: [
                {
                  hash: txHash,
                  height: String(height),
                  index: 0,
                  tx_result: { code: 0, log: "", gas_wanted: String(gasUsed), gas_used: String(gasUsed), events: [] },
                  tx: toBase64(Uint8Array.from([1, 2, 3]))
                }
              ]
            }
          };
        default:
          throw new Error(`Unexpected RPC method: ${request.method}`);
      }
    };

    nock(process.env.RPC_NODE_ENDPOINT ?? "http://localhost:26657")
      .persist()
      .post(/.*/)
      .reply(200, (_uri, requestBody) => reply(requestBody as JsonRpcRequest));

    return { txHash, chainId, accountNumber, sequence, gasUsed, height, getBroadcastedTxs: () => broadcastedTxs };
  }
});
