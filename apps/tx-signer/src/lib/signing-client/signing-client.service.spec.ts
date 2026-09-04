import { TxBody, TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { BroadcastTxError, type IndexedTx } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppConfigService } from "../../services/app-config/app-config.service";
import type { SigningStargateWithUnorderedSupportClient } from "../signing-stargate-client-factory/signing-stargate-client.factory";
import { SigningClientService } from "./signing-client.service";
import { TxNotIncludedError, TxOutcomeUnknownError } from "./tx-outcome.error";

const DEFAULT_TTL_MS = 180_000;
const DEFAULT_RPC_REQUEST_TIMEOUT_MS = 10_000;

describe(SigningClientService.name, () => {
  it("signs and broadcasts a transaction and returns the recovered transaction", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockResolvedValue("broadcast-hash");

    const result = await service.signAndBroadcast(createMessages(1));

    expect(result.hash).toBe("broadcast-hash");
    expect(result.code).toBe(0);
    expect(client.signUnordered).toHaveBeenCalledTimes(1);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(1);
    expect(client.getTx).toHaveBeenCalledWith("broadcast-hash");
  });

  it("forwards the fee granter to the signing client", async () => {
    const { service, client } = setup();

    await service.signAndBroadcast(createMessages(1), { fee: { granter: "akash1granter" } });

    expect(client.signUnordered).toHaveBeenCalledWith(expect.anything(), { granter: "akash1granter" });
  });

  it("resolves multiple concurrent transactions independently", async () => {
    const { service, client } = setup();

    const results = await Promise.all(Array.from({ length: 4 }, (_, index) => service.signAndBroadcast(createMessages(index))));

    expect(results).toHaveLength(4);
    expect(results.every(tx => tx.code === 0)).toBe(true);
    expect(client.signUnordered).toHaveBeenCalledTimes(4);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(4);
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
    const { service, client } = setup();
    client.signUnordered.mockImplementation(async messages => {
      if (messages.some(message => message.typeUrl === "/test.MsgFail")) {
        throw new Error("signing failed");
      }
      return signedTx();
    });

    const results = await Promise.allSettled([
      service.signAndBroadcast(createMessages(1)),
      service.signAndBroadcast([{ typeUrl: "/test.MsgFail", value: {} }]),
      service.signAndBroadcast(createMessages(2))
    ]);

    expect(results.map(r => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });

  it("reports an undecided outcome without retrying when the poll query itself fails", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockResolvedValue("broadcast-hash");
    client.getTx.mockRejectedValue(Object.assign(new Error("Invalid argument"), { code: "INVALID_ARGUMENT" }));

    const error = await service.signAndBroadcast(createMessages(1)).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxOutcomeUnknownError);
    expect(error).toMatchObject({ data: { outcome: "unknown", txHash: "broadcast-hash" } });
    expect(client.getTx).toHaveBeenCalledTimes(1);
  });

  it("reports an undecided outcome when the broadcast request fails without the node refusing the transaction", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockRejectedValue(new Error("fetch failed"));

    const error = await service.signAndBroadcast(createMessages(1)).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(TxOutcomeUnknownError);
    expect(error).toMatchObject({ data: { outcome: "unknown", txHash: expect.stringMatching(/^[0-9A-F]{64}$/) } });
    expect(client.getTx).not.toHaveBeenCalled();
  });

  it("rejects with a not-included outcome once polling has outlasted the transaction TTL", async () => {
    vi.useFakeTimers();
    try {
      // ceil(10_000ms TTL × 1.2 window / 2_000ms poll interval) = 6 retries, so 1 initial + 6 = 7 getTx polls before giving up.
      const { service, client } = setup({ ttlMs: 10_000 });
      client.broadcastTxSync.mockResolvedValue("broadcast-hash");
      client.getTx.mockResolvedValue(null);

      const promise = service.signAndBroadcast(createMessages(1));
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(promise).rejects.toBeInstanceOf(TxNotIncludedError);
      await expect(promise).rejects.toMatchObject({ status: 502, data: { outcome: "not_included", txHash: "broadcast-hash" } });
      expect(client.getTx).toHaveBeenCalledTimes(7);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects with an undecided outcome when the deadline cuts polling short of the transaction expiry", async () => {
    vi.useFakeTimers();
    try {
      const { service, client } = setup({ ttlMs: 10_000, deadlineMs: 14_000 });
      client.broadcastTxSync.mockResolvedValue("broadcast-hash");
      client.signUnordered.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 8_000);
        return signedTx(10_000);
      });
      client.getTx.mockResolvedValue(null);

      const promise = service.signAndBroadcast(createMessages(1));
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(promise).rejects.toBeInstanceOf(TxOutcomeUnknownError);
      await expect(promise).rejects.toMatchObject({ status: 504, data: { outcome: "unknown", txHash: "broadcast-hash" } });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not poll at all once the deadline has passed, and reports the outcome as undecided", async () => {
    vi.useFakeTimers();
    try {
      const { service, client } = setup({ ttlMs: 10_000, deadlineMs: 5_000 });
      client.broadcastTxSync.mockResolvedValue("broadcast-hash");
      client.signUnordered.mockImplementation(async () => {
        vi.setSystemTime(Date.now() + 6_000);
        return signedTx(10_000);
      });

      const promise = service.signAndBroadcast(createMessages(1));
      promise.catch(() => {});
      await vi.advanceTimersByTimeAsync(60_000);

      await expect(promise).rejects.toBeInstanceOf(TxOutcomeUnknownError);
      expect(client.getTx).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-signs with a higher gas limit derived from the on-chain gasUsed when the transaction lands out of gas", async () => {
    const { service, client } = setup();
    client.getTx
      .mockResolvedValueOnce(outOfGasTx({ gasUsed: 100n, gasWanted: 80n }))
      .mockResolvedValueOnce(mock<IndexedTx>({ hash: "recovered", code: 0, height: 101 }));

    const result = await service.signAndBroadcast(createMessages(1));

    expect(client.signUnordered).toHaveBeenCalledTimes(2);
    // ceil(100 gasUsed × 1.3 margin) = 130.
    expect(client.signUnordered).toHaveBeenLastCalledWith(expect.anything(), { granter: undefined, gas: 130 });
    expect(result.code).toBe(0);
  });

  it("stops retrying and returns the out-of-gas transaction after exhausting the retry limit", async () => {
    const { service, client } = setup();
    client.getTx.mockResolvedValue(outOfGasTx({ gasUsed: 100n, gasWanted: 80n }));

    const result = await service.signAndBroadcast(createMessages(1));

    // 1 initial attempt + OUT_OF_GAS_RETRY_LIMIT (3) retries = 4 signs.
    expect(client.signUnordered).toHaveBeenCalledTimes(4);
    expect(result.code).toBe(11);
  });

  it("stops the out-of-gas recovery when the remaining budget cannot fit another attempt", async () => {
    const { service, client } = setup({ ttlMs: 10_000, deadlineMs: 20_000 });
    client.getTx.mockResolvedValue(outOfGasTx({ gasUsed: 100n, gasWanted: 80n }));

    const result = await service.signAndBroadcast(createMessages(1));

    expect(client.signUnordered).toHaveBeenCalledTimes(1);
    expect(result.code).toBe(11);
  });

  it("does not retry a transaction that fails with a non-out-of-gas error", async () => {
    const { service, client } = setup();
    client.getTx.mockResolvedValue(mock<IndexedTx>({ hash: "failed", code: 5, gasUsed: 40n, gasWanted: 80n, height: 100 }));

    const result = await service.signAndBroadcast(createMessages(1));

    expect(client.signUnordered).toHaveBeenCalledTimes(1);
    expect(result.code).toBe(5);
  });

  it("re-signs with a higher gas limit when the broadcast is rejected out of gas at CheckTx", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockRejectedValueOnce(
      new BroadcastTxError(11, "sdk", "out of gas in location: unordered tx; gasWanted: 40000, gasUsed: 50000: out of gas")
    );

    const result = await service.signAndBroadcast(createMessages(1));

    expect(client.signUnordered).toHaveBeenCalledTimes(2);
    // ceil(50000 gasUsed × 1.3 multiplier) = 65000.
    expect(client.signUnordered).toHaveBeenLastCalledWith(expect.anything(), { granter: undefined, gas: 65000 });
    expect(result.code).toBe(0);
  });

  it("throws the broadcast out-of-gas error after exhausting the retry limit", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockRejectedValue(
      new BroadcastTxError(11, "sdk", "out of gas in location: unordered tx; gasWanted: 40000, gasUsed: 50000: out of gas")
    );

    await expect(service.signAndBroadcast(createMessages(1))).rejects.toThrow(BroadcastTxError);
    // 1 initial attempt + OUT_OF_GAS_RETRY_LIMIT (3) retries = 4 signs.
    expect(client.signUnordered).toHaveBeenCalledTimes(4);
  });

  it("does not retry a broadcast error that is not out of gas", async () => {
    const { service, client } = setup();
    client.broadcastTxSync.mockRejectedValue(new BroadcastTxError(13, "sdk", "insufficient fee"));

    await expect(service.signAndBroadcast(createMessages(1))).rejects.toThrow(BroadcastTxError);
    expect(client.signUnordered).toHaveBeenCalledTimes(1);
  });

  it("does not retry a code 11 broadcast error from another codespace whose log lacks the out-of-gas marker", async () => {
    const { service, client } = setup();
    // Some other module reuses error code 11; its log happens to carry gas figures but is not an out-of-gas abort.
    client.broadcastTxSync.mockRejectedValue(new BroadcastTxError(11, "othermodule", "rejected; gasWanted: 40000, gasUsed: 50000"));

    await expect(service.signAndBroadcast(createMessages(1))).rejects.toThrow(BroadcastTxError);
    expect(client.signUnordered).toHaveBeenCalledTimes(1);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(1);
  });

  it("does not retry a broadcast out-of-gas log whose gasUsed is below gasWanted", async () => {
    const { service, client } = setup();
    // A genuine out-of-gas abort consumes at least the whole limit; gasUsed < gasWanted marks a non-genuine or malformed log.
    client.broadcastTxSync.mockRejectedValue(new BroadcastTxError(11, "othermodule", "out of gas in location: unordered tx; gasWanted: 50000, gasUsed: 40000"));

    await expect(service.signAndBroadcast(createMessages(1))).rejects.toThrow(BroadcastTxError);
    expect(client.signUnordered).toHaveBeenCalledTimes(1);
    expect(client.broadcastTxSync).toHaveBeenCalledTimes(1);
  });

  function createMessages(seed: number): readonly EncodeObject[] {
    return [{ typeUrl: "/test.MsgTest", value: { seed } }];
  }

  function signedTx(ttlMs = DEFAULT_TTL_MS) {
    const bodyBytes = TxBody.encode(TxBody.fromPartial({ memo: "akash console", unordered: true, timeoutTimestamp: new Date(Date.now() + ttlMs) })).finish();

    return TxRaw.fromPartial({ bodyBytes, authInfoBytes: new Uint8Array([2]), signatures: [new Uint8Array([3])] });
  }

  function outOfGasTx(input: { gasUsed: bigint; gasWanted: bigint }) {
    return mock<IndexedTx>({ hash: "out-of-gas", code: 11, gasUsed: input.gasUsed, gasWanted: input.gasWanted, height: 100 });
  }

  function setup(input?: { ttlMs?: number; deadlineMs?: number; gasRecoveryMultiplier?: number; rpcRequestTimeoutMs?: number }) {
    const ttlMs = input?.ttlMs ?? DEFAULT_TTL_MS;
    const config = mock<AppConfigService>({
      get: vi.fn().mockImplementation(key => {
        const values = {
          UNORDERED_TX_TTL_MS: ttlMs,
          SIGN_AND_BROADCAST_DEADLINE_MS: input?.deadlineMs ?? 600_000,
          GAS_RECOVERY_MULTIPLIER: input?.gasRecoveryMultiplier ?? 1.3,
          RPC_REQUEST_TIMEOUT_MS: input?.rpcRequestTimeoutMs ?? DEFAULT_RPC_REQUEST_TIMEOUT_MS
        };
        return values[key as keyof typeof values];
      })
    });

    const client = mock<SigningStargateWithUnorderedSupportClient>({
      signUnordered: vi.fn().mockImplementation(async () => signedTx(ttlMs)),
      broadcastTxSync: vi.fn(async (bytes: Uint8Array) => toHex(sha256(bytes))),
      getTx: vi.fn(async (hash: string) => mock<IndexedTx>({ hash, code: 0, height: 100 }))
    });

    const service = new SigningClientService(client, config);

    return { service, client, config };
  }
});
