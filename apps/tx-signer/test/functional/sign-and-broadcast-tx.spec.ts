import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import {
  BaseAccount,
  BasicAllowance,
  type Coin,
  MsgGrantAllowance,
  QueryAccountResponse,
  SimulateResponse,
  TxBody,
  TxRaw
} from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { fromBase64, fromHex, toBase64 } from "@cosmjs/encoding";
import type { Registry } from "@cosmjs/proto-signing";
import { SimulateRequest } from "cosmjs-types/cosmos/tx/v1beta1/service";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { TxController } from "@src/controllers/tx/tx.controller";
import { app } from "@src/index";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { TxManagerService } from "@src/services/tx-manager/tx-manager.service";

import { createAkashAddress } from "@test/seeders";

const DERIVATION_INDEX = 1;

interface JsonRpcRequest {
  id: number | string;
  method: string;
  params?: { path?: string; tx?: string; data?: string };
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
      body: JSON.stringify({ data: { derivationIndex: DERIVATION_INDEX, messages: await buildDerivedMessages() } }),
      headers: authorizedHeaders()
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
      body: JSON.stringify({ data: { messages: await buildFundingMessages() } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { code: 0, hash: txHash, rawLog: "" } });
  });

  it("retries a gas simulation that failed at the transport with a transaction window opened for the retry", async () => {
    const { txHash, getSimulatedTimeoutTimestamps } = mockRpcNode({ failSimulateTimes: 1 });

    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: DERIVATION_INDEX, messages: await buildDerivedMessages() } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { code: 0, hash: txHash, rawLog: "" } });

    const [firstAttempt, secondAttempt] = getSimulatedTimeoutTimestamps();
    expect(getSimulatedTimeoutTimestamps()).toHaveLength(2);
    expect(secondAttempt).toBeGreaterThan(firstAttempt);
  });

  it("reports the transport failure and stops after four gas simulation attempts when every one fails", async () => {
    const { getSimulatedTimeoutTimestamps } = mockRpcNode({ failSimulateTimes: 10 });

    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: DERIVATION_INDEX, messages: await buildDerivedMessages() } }),
      headers: authorizedHeaders()
    });

    const body = await res.text();

    expect(getSimulatedTimeoutTimestamps()).toHaveLength(4);
    expect(res.status).toBe(503);
    expect(body).toMatch(/Bad status on response: 503/);
    expect(body).not.toMatch(/tx timeout/);
  });

  it("rejects a tx request that carries no API key", async () => {
    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: DERIVATION_INDEX, messages: await buildDerivedMessages() } }),
      headers: new Headers({ "Content-Type": "application/json" })
    });

    expect(res.status).toBe(401);
  });

  it("rejects a tx request that carries the wrong API key", async () => {
    const res = await app.request("/v1/tx/funding", {
      method: "POST",
      body: JSON.stringify({ data: { messages: await buildFundingMessages() } }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": "not-the-configured-api-key-0000000000000" })
    });

    expect(res.status).toBe(401);
  });

  it("serves healthz without an API key", async () => {
    const res = await app.request("/v1/healthz/readiness");

    expect(res.status).toBe(200);
  });

  it("rejects a derived tx acting on behalf of an account other than the requested wallet", async () => {
    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: DERIVATION_INDEX, messages: await buildDerivedMessages(createAkashAddress()) } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(403);
  });

  it("rejects a derived tx that names a fee granter other than the funding wallet", async () => {
    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({
        data: {
          derivationIndex: DERIVATION_INDEX,
          messages: await buildDerivedMessages(),
          options: { fee: { granter: createAkashAddress() } }
        }
      }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(403);
  });

  it("rejects a funding tx whose grant declares no spend limit", async () => {
    const res = await app.request("/v1/tx/funding", {
      method: "POST",
      body: JSON.stringify({ data: { messages: await buildFundingMessages({ spendLimit: [] }) } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(403);
  });

  it("rejects a funding tx granting a denom that is not grantable", async () => {
    const res = await app.request("/v1/tx/funding", {
      method: "POST",
      body: JSON.stringify({ data: { messages: await buildFundingMessages({ spendLimit: [{ denom: "ibc/SOMETHING", amount: "1" }] }) } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(403);
  });

  it("rejects a derived tx carrying a message type the derived wallet is not allowed to sign", async () => {
    const res = await app.request("/v1/tx/derived", {
      method: "POST",
      body: JSON.stringify({ data: { derivationIndex: DERIVATION_INDEX, messages: await buildFundingMessages() } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "validation_error" });
  });

  it("rejects a funding tx carrying a message type the funding wallet is not allowed to sign", async () => {
    const res = await app.request("/v1/tx/funding", {
      method: "POST",
      body: JSON.stringify({ data: { messages: await buildDerivedMessages() } }),
      headers: authorizedHeaders()
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "validation_error" });
  });

  function authorizedHeaders() {
    return new Headers({ "Content-Type": "application/json", "x-api-key": container.resolve(AppConfigService).get("ACCESS_API_KEY") });
  }

  async function buildDerivedMessages(owner?: string) {
    return encodeMessages({
      typeUrl: `/${MsgCreateCertificate.$type}`,
      value: MsgCreateCertificate.fromPartial({
        owner: owner ?? (await container.resolve(TxManagerService).getDerivedWalletAddress(DERIVATION_INDEX)),
        cert: Uint8Array.from([1, 2, 3]),
        pubkey: Uint8Array.from([4, 5, 6])
      })
    });
  }

  async function buildFundingMessages(input: { granter?: string; spendLimit?: Coin[] } = {}) {
    const txManagerService = container.resolve(TxManagerService);
    const spendLimit = input.spendLimit ?? [{ denom: "uakt", amount: "1000" }];

    return encodeMessages({
      typeUrl: `/${MsgGrantAllowance.$type}`,
      value: MsgGrantAllowance.fromPartial({
        granter: input.granter ?? (await txManagerService.getFundingWalletAddress()),
        grantee: await txManagerService.getDerivedWalletAddress(DERIVATION_INDEX),
        allowance: {
          typeUrl: `/${BasicAllowance.$type}`,
          value: Uint8Array.from(BasicAllowance.encode(BasicAllowance.fromPartial({ spendLimit })).finish())
        }
      })
    });
  }

  function encodeMessages(message: { typeUrl: string; value: object }) {
    const registry = container.resolve<Registry>(TYPE_REGISTRY);
    return [{ typeUrl: message.typeUrl, value: toBase64(registry.encode(message)) }];
  }

  function mockRpcNode(
    input: { chainId?: string; accountNumber?: number; sequence?: number; gasUsed?: number; height?: number; txHash?: string; failSimulateTimes?: number } = {}
  ) {
    const chainId = input.chainId ?? "sandbox-01";
    const accountNumber = input.accountNumber ?? 42;
    const sequence = input.sequence ?? 7;
    const gasUsed = input.gasUsed ?? 100_000;
    const height = input.height ?? 1_000;
    const txHash = input.txHash ?? "AB".repeat(32);
    const broadcastedTxs: string[] = [];
    const simulatedTxs: string[] = [];
    let simulateFailuresLeft = input.failSimulateTimes ?? 0;

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

    const isSimulate = (request: JsonRpcRequest) => request.method === "abci_query" && request.params?.path?.includes("Simulate") === true;

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
          const value = isSimulate(request) ? simulateValue : accountValue;
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
      .reply((_uri, requestBody) => {
        const request = requestBody as JsonRpcRequest;

        if (isSimulate(request)) {
          simulatedTxs.push(request.params!.data!);

          if (simulateFailuresLeft > 0) {
            simulateFailuresLeft -= 1;
            return [503, ""];
          }
        }

        return [200, reply(request)];
      });

    return {
      txHash,
      chainId,
      accountNumber,
      sequence,
      gasUsed,
      height,
      getBroadcastedTxs: () => broadcastedTxs,
      getSimulatedTimeoutTimestamps: () =>
        simulatedTxs.map(data => TxBody.decode(TxRaw.decode(SimulateRequest.decode(fromHex(data)).txBytes).bodyBytes).timeoutTimestamp!.getTime())
    };
  }
});
