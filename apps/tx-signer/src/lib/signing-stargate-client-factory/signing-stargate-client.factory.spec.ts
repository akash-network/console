import { AuthInfo, SimulateResponse, TxBody, TxRaw } from "@akashnetwork/chain-sdk/private-types/cosmos.v1beta1";
import { toBase64 } from "@cosmjs/encoding";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { Account } from "@cosmjs/stargate";
import type { Comet38Client, RpcClient } from "@cosmjs/tendermint-rpc";
import { faker } from "@faker-js/faker";
import { SimulateRequest } from "cosmjs-types/cosmos/tx/v1beta1/service";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { createAkashAddress } from "../../../test/seeders";
import type { Wallet } from "../wallet/wallet";
import type { UnorderedTxSignConfig } from "./signing-stargate-client.factory";
import { createSigningStargateClientFactory, SigningStargateWithUnorderedSupportClient } from "./signing-stargate-client.factory";

const SIGN_CONFIG: UnorderedTxSignConfig = { ttlMs: 180_000, gasMultiplier: 1.2, averageGasPrice: 0.025 };

describe(createSigningStargateClientFactory.name, () => {
  it("builds an RpcClient via the injected factory and passes it to Comet38Client", () => {
    const endpoint = faker.internet.url();
    const signer = mock<Wallet>();
    const mockClient = mock<SigningStargateWithUnorderedSupportClient>({});
    const mockCometClient = mock<Comet38Client>();
    const mockRpcClient = mock<RpcClient>();

    const createRpcClient = vi.fn().mockReturnValue(mockRpcClient);
    const mockFactory = vi.fn().mockReturnValue(mockClient);
    const MockComet38Client = {
      create: vi.fn().mockReturnValue(mockCometClient)
    } as unknown as typeof Comet38Client;

    const factory = createSigningStargateClientFactory(createRpcClient, MockComet38Client, mockFactory);
    const result = factory(endpoint, signer, { signConfig: SIGN_CONFIG });

    expect(createRpcClient).toHaveBeenCalledWith(endpoint);
    expect(MockComet38Client.create).toHaveBeenCalledWith(mockRpcClient);
    expect(mockFactory).toHaveBeenCalledWith(mockCometClient, signer, { signConfig: SIGN_CONFIG });
    expect(result).toBe(mockClient);
  });

  it("forwards the registry and sign config to the client factory", () => {
    const endpoint = faker.internet.url();
    const signer = mock<Wallet>();
    const mockClient = mock<SigningStargateWithUnorderedSupportClient>({});
    const mockCometClient = mock<Comet38Client>();
    const mockRpcClient = mock<RpcClient>();
    const registry = mock<Registry>();

    const createRpcClient = vi.fn().mockReturnValue(mockRpcClient);
    const mockFactory = vi.fn().mockReturnValue(mockClient);
    const MockComet38Client = {
      create: vi.fn().mockReturnValue(mockCometClient)
    } as unknown as typeof Comet38Client;

    const factory = createSigningStargateClientFactory(createRpcClient, MockComet38Client, mockFactory);
    factory(endpoint, signer, { registry, signConfig: SIGN_CONFIG });

    expect(mockFactory).toHaveBeenCalledWith(mockCometClient, signer, { registry, signConfig: SIGN_CONFIG });
  });
});

describe(SigningStargateWithUnorderedSupportClient.name, () => {
  it("signs an unordered transaction with a zero sequence and a future timeout", async () => {
    const ttlMs = 120_000;
    const { client } = setup({ ttlMs });
    const before = Date.now();

    const txRaw = await client.signUnordered(createMessages());

    const body = TxBody.decode(txRaw.bodyBytes);
    const authInfo = AuthInfo.decode(txRaw.authInfoBytes);

    expect(body.unordered).toBe(true);
    expect(body.timeoutTimestamp).toBeInstanceOf(Date);
    expect(body.timeoutTimestamp!.getTime()).toBeGreaterThanOrEqual(before + ttlMs);
    expect(authInfo.signerInfos[0].sequence).toBe(0n);
  });

  it("derives the timeout timestamp after gas simulation so estimation latency does not erode the ttl", async () => {
    vi.useFakeTimers();
    try {
      const ttlMs = 120_000;
      const simulationLatencyMs = 5_000;
      const startTime = 1_700_000_000_000;
      vi.setSystemTime(startTime);
      const { client } = setup({ ttlMs, onSimulate: () => vi.setSystemTime(startTime + simulationLatencyMs) });

      const txRaw = await client.signUnordered(createMessages());

      const body = TxBody.decode(txRaw.bodyBytes);
      expect(body.timeoutTimestamp!.getTime()).toBe(startTime + simulationLatencyMs + ttlMs);
    } finally {
      vi.useRealTimers();
    }
  });

  it("estimates gas by simulating the unordered tx body and applies the safety multiplier", async () => {
    const { client, abciQuery } = setup({ gasUsed: 2000, gasMultiplier: 1.2 });

    const txRaw = await client.signUnordered(createMessages());

    // The gas must be simulated for the exact unordered tx that gets broadcast so the estimate accounts for the extra
    // ante-handler nonce write; otherwise the tx lands out of gas (code 11).
    const simulatedTxBytes = SimulateRequest.decode(abciQuery.mock.calls[0][0].data).txBytes;
    expect(TxBody.decode(TxRaw.decode(simulatedTxBytes).bodyBytes).unordered).toBe(true);

    // 2000 simulated gas × 1.2 safety multiplier = 2400.
    expect(AuthInfo.decode(txRaw.authInfoBytes).fee!.gasLimit).toBe(2400n);
  });

  it("uses the provided gas limit verbatim and skips simulation when a gas override is passed", async () => {
    const { client, abciQuery } = setup({ gasMultiplier: 1.3 });

    const txRaw = await client.signUnordered(createMessages(), { gas: 5000 });

    // The gas-recovery path must not re-simulate — the override comes from the actual on-chain gasUsed, which is more
    // reliable than the simulate estimate that under-counted in the first place.
    expect(abciQuery).not.toHaveBeenCalled();
    expect(AuthInfo.decode(txRaw.authInfoBytes).fee!.gasLimit).toBe(5000n);
  });

  it("attaches the fee granter to the signed transaction when provided", async () => {
    const { client } = setup();

    const txRaw = await client.signUnordered(createMessages(), { granter: "akash1granter" });

    expect(AuthInfo.decode(txRaw.authInfoBytes).fee!.granter).toBe("akash1granter");
  });

  it("fetches chain id and account data only once across concurrent signs", async () => {
    const { client, wallet, getChainId, getAccount } = setup();

    await Promise.all(Array.from({ length: 4 }, () => client.signUnordered(createMessages())));

    expect(getChainId).toHaveBeenCalledTimes(1);
    expect(getAccount).toHaveBeenCalledTimes(1);
    expect(wallet.getAccounts).toHaveBeenCalledTimes(1);
  });

  function createMessages(): readonly EncodeObject[] {
    return [{ typeUrl: "/test.MsgTest", value: {} }];
  }

  function setup(input?: { ttlMs?: number; gasUsed?: number; gasMultiplier?: number; onSimulate?: () => void }) {
    const address = createAkashAddress();
    const accountNumber = faker.number.int({ min: 1, max: 1000 });
    const gasUsed = input?.gasUsed ?? 2000;

    // A valid 33-byte compressed secp256k1 public key so the real encodeSecp256k1Pubkey pipeline accepts it.
    const pubkey = new Uint8Array(33);
    pubkey[0] = 0x02;

    const wallet = mock<Wallet>({
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

    const registry = mock<Registry>({
      encodeAsAny: vi.fn((message: EncodeObject) => ({
        typeUrl: message.typeUrl,
        value: new TextEncoder().encode(JSON.stringify(message.value))
      }))
    });

    // Gas estimation runs the real #simulateRawTx through the query client, so mock the underlying ABCI query.
    const abciQuery = vi.fn().mockImplementation(async () => {
      input?.onSimulate?.();
      return {
        code: 0,
        value: SimulateResponse.encode(SimulateResponse.fromPartial({ gasInfo: { gasUsed: BigInt(gasUsed), gasWanted: BigInt(gasUsed) } })).finish(),
        height: 1
      };
    });
    const cometClient = mock<Comet38Client>({ abciQuery });

    const client = SigningStargateWithUnorderedSupportClient.createWithSigner(cometClient, wallet, {
      registry,
      signConfig: {
        ttlMs: input?.ttlMs ?? 180_000,
        gasMultiplier: input?.gasMultiplier ?? 1.2,
        averageGasPrice: 0.025
      }
    });

    const getChainId = vi.spyOn(client, "getChainId").mockResolvedValue("test-chain");
    const getAccount = vi.spyOn(client, "getAccount").mockResolvedValue(mock<Account>({ address, accountNumber }));

    return { client, wallet, registry, cometClient, abciQuery, getChainId, getAccount, address, accountNumber };
  }
});
