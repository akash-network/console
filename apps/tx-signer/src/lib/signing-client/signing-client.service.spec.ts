import { AuthInfo, TxBody } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { sha256 } from "@cosmjs/crypto";
import { toBase64, toHex } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { Account, IndexedTx, SigningStargateClient } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createAkashAddress } from "../../../test/seeders";
import type { AppConfigService } from "../../services/app-config/app-config.service";
import type { Wallet } from "../wallet/wallet";
import { SigningClientService } from "./signing-client.service";

describe(SigningClientService.name, () => {
  it("signs and broadcasts a transaction and returns the recovered transaction", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockResolvedValue("broadcast-hash");

    const result = await service.signAndBroadcast(createMessages(1));

    expect(result.hash).toBe("broadcast-hash");
    expect(result.code).toBe(0);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(1);
    expect(client.getTx).toHaveBeenCalledWith("broadcast-hash");
  });

  it("signs the transaction as unordered with a zero sequence and a future timeout", async () => {
    const ttlMs = 120_000;
    const { service, wallet } = setup({ ttlMs });
    const before = Date.now();

    await service.signAndBroadcast(createMessages(1));

    const [, signDoc] = wallet.signDirect.mock.calls[0];
    const body = TxBody.decode(signDoc.bodyBytes);
    const authInfo = AuthInfo.decode(signDoc.authInfoBytes);

    expect(body.unordered).toBe(true);
    expect(body.timeoutTimestamp).toBeInstanceOf(Date);
    expect(body.timeoutTimestamp!.getTime()).toBeGreaterThanOrEqual(before + ttlMs);
    expect(authInfo.signerInfos[0].sequence).toBe(0n);
  });

  it("resolves multiple concurrent transactions and fetches account data only once", async () => {
    const { service, client, wallet } = setup();

    const results = await Promise.all(Array.from({ length: 4 }, (_, index) => service.signAndBroadcast(createMessages(index))));

    expect(results).toHaveLength(4);
    expect(results.every(tx => tx.code === 0)).toBe(true);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(4);
    expect(wallet.signDirect).toHaveBeenCalledTimes(4);
    expect(client.getAccount).toHaveBeenCalledTimes(1);
    expect(client.getChainId).toHaveBeenCalledTimes(1);
    expect(wallet.getAccounts).toHaveBeenCalledTimes(1);
  });

  it("treats an 'already exists in cache' broadcast error as a successful broadcast", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockRejectedValue(new Error("tx already exists in cache: ..."));

    const result = await service.signAndBroadcast(createMessages(1));

    const [txBytes] = client.broadcastTxSync.mock.calls[0];
    const expectedHash = toHex(sha256(txBytes));
    expect(client.getTx).toHaveBeenCalledWith(expectedHash);
    expect(result.hash).toBe(expectedHash);
  });

  it("does not let a failing transaction affect the others", async () => {
    const { service, registry } = setup();
    registry.encodeAsAny.mockImplementation((message: EncodeObject) => {
      if (message.typeUrl === "/test.MsgFail") {
        throw new Error("encoding failed");
      }
      return { typeUrl: message.typeUrl, value: new TextEncoder().encode(JSON.stringify(message.value)) };
    });

    const results = await Promise.allSettled([
      service.signAndBroadcast(createMessages(1)),
      service.signAndBroadcast([{ typeUrl: "/test.MsgFail", value: {} }]),
      service.signAndBroadcast(createMessages(2))
    ]);

    expect(results.map(r => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("propagates getTx errors without retrying", async () => {
    const { service, client } = setup();
    const nonNetworkError = Object.assign(new Error("Invalid argument"), { code: "INVALID_ARGUMENT" });
    client.getTx.mockRejectedValue(nonNetworkError);

    await expect(service.signAndBroadcast(createMessages(1))).rejects.toThrow("Invalid argument");
    expect(client.getTx).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting recovery retries when the transaction is never found", async () => {
    vi.useFakeTimers();
    try {
      const { service, client } = setup();
      client.getTx.mockResolvedValue(null);

      const promise = service.signAndBroadcast(createMessages(1));
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(promise).rejects.toThrow("Failed to sign and broadcast transaction");
      // initial attempt + 5 retries (cockatiel maxAttempts is the retry count)
      expect(client.getTx).toHaveBeenCalledTimes(6);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports pending transactions only while a broadcast is in flight", async () => {
    const { service } = setup();

    expect(service.hasPendingTransactions).toBe(false);

    const promise = service.signAndBroadcast(createMessages(1));
    expect(service.hasPendingTransactions).toBe(true);

    await promise;
    expect(service.hasPendingTransactions).toBe(false);
  });

  function createMessages(seed: number): readonly EncodeObject[] {
    return [{ typeUrl: "/test.MsgTest", value: { seed } }];
  }

  function setup(input?: { ttlMs?: number }) {
    const address = createAkashAddress();
    const accountNumber = faker.number.int({ min: 1, max: 1000 });
    const chainId = "test-chain";

    // A valid 33-byte compressed secp256k1 public key so the real encodeSecp256k1Pubkey pipeline accepts it.
    const pubkey = new Uint8Array(33);
    pubkey[0] = 0x02;

    const wallet = mock<Wallet>({
      getFirstAddress: vi.fn().mockResolvedValue(address),
      getAccounts: vi.fn().mockResolvedValue([{ address, algo: "secp256k1", pubkey }])
    });
    wallet.signDirect.mockImplementation(async (_address, signDoc) => ({
      signature: { pub_key: { type: "", value: "" }, signature: toBase64(new Uint8Array(64)) },
      signed: {
        bodyBytes: signDoc.bodyBytes,
        authInfoBytes: signDoc.authInfoBytes,
        chainId: signDoc.chainId,
        accountNumber: signDoc.accountNumber
      }
    }));

    const config = mock<AppConfigService>({
      get: vi.fn().mockImplementation(key => {
        const values = {
          RPC_NODE_ENDPOINT: "http://localhost:26657",
          GAS_SAFETY_MULTIPLIER: 1.2,
          AVERAGE_GAS_PRICE: 0.025,
          UNORDERED_TX_TTL_MS: input?.ttlMs ?? 180_000
        };
        return values[key as keyof typeof values];
      })
    });

    const registry = mock<Registry>({
      encodeAsAny: vi.fn((message: EncodeObject) => ({
        typeUrl: message.typeUrl,
        value: new TextEncoder().encode(JSON.stringify(message.value))
      }))
    });

    const client = mock<SigningStargateClient>({
      getChainId: vi.fn().mockResolvedValue(chainId),
      getAccount: vi.fn(async (addr: string) => mock<Account>({ address: addr, accountNumber })),
      simulate: vi.fn().mockResolvedValue(2000),
      broadcastTxSync: vi.fn(async (bytes: Uint8Array) => toHex(sha256(bytes))),
      getTx: vi.fn(async (hash: string) => mock<IndexedTx>({ hash, code: 0, height: 100 }))
    });

    const createClientWithSigner = vi.fn(() => client);
    const service = new SigningClientService(config, wallet, registry, createClientWithSigner);

    return { service, client, wallet, registry, config, address, accountNumber, chainId };
  }
});
