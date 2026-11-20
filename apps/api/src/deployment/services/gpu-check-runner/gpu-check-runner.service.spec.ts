import { generateManifest } from "@akashnetwork/chain-sdk";
import type { MsgCloseDeployment, MsgCreateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Bid, QueryBidResponse, QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { BroadcastTxError, type DeliverTxResponse, type SigningStargateClient } from "@cosmjs/stargate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, mockDeep, type MockProxy } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentConfig } from "@src/deployment/config/config.provider";
import type { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import type { GpuBotSigningClientFactory } from "@src/deployment/services/gpu-bids-creator/gpu-bot-signing-client.factory";
import { buildGpuCheckSdl, GPU_CHECK_SHAPES } from "@src/deployment/services/gpu-bids-creator/gpu-check-sdl";
import { type GpuCheckManifest, GpuCheckRunner } from "./gpu-check-runner.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const BOT_ADDRESS = "akash1bot";
const SEQUENCE_MISMATCH = "account sequence mismatch, expected 16, got 15: incorrect account sequence";

describe(GpuCheckRunner.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("connect", () => {
    it("connects with the bot wallet", async () => {
      const { runner, signingClient, signingClientFactory } = setup();

      const session = await runner.connect();

      expect(signingClientFactory.connect).toHaveBeenCalledWith("test mnemonic words here");
      expect(session).toEqual({ client: signingClient, owner: BOT_ADDRESS });
    });

    it("returns null when the mnemonic is not set", async () => {
      const { runner, signingClientFactory } = setup({ gpuBotWalletMnemonic: undefined });

      expect(await runner.connect()).toBeNull();
      expect(signingClientFactory.connect).not.toHaveBeenCalled();
    });

    it("returns null when the rpc endpoint is not set", async () => {
      const { runner, signingClientFactory } = setup({ rpcNodeEndpoint: undefined });

      expect(await runner.connect()).toBeNull();
      expect(signingClientFactory.connect).not.toHaveBeenCalled();
    });
  });

  describe("run", () => {
    it("creates every deployment in a single transaction", async () => {
      const { runner, session, signingClient } = setup();

      await runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }, { manifest: aManifest(["l40s"]) }]);

      const creates = sentTransactions(signingClient)[0];
      expect(creates.map(message => message.typeUrl)).toEqual(Array(3).fill("/akash.deployment.v1beta4.MsgCreateDeployment"));
      const dseqs = creates.map(message => (message.value as MsgCreateDeployment).id!.dseq);
      expect(new Set(dseqs).size).toBe(3);
      expect(dseqs).toEqual([dseqs[0], dseqs[0] + 1n, dseqs[0] + 2n]);
      expect(sentTransactions(signingClient).filter(([first]) => first.typeUrl.endsWith("MsgCreateDeployment"))).toHaveLength(1);
    });

    it("waits for bids once whatever the number of deployments", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      try {
        const { runner, session, chainSdk, logger } = setup({ bidWindowSeconds: 90 });

        const run = runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }]);
        await untilLogged(logger, "GPU_CHECK_DEPLOYMENT_CREATED");
        expect(vi.getTimerCount()).toBe(1);
        await vi.advanceTimersByTimeAsync(89_999);
        expect(chainSdk.akash.market.v1beta5.getBids).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        await run;
        expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("returns bids grouped by the deployment they were placed on, in input order", async () => {
      const { runner, session, signingClient, chainSdk } = setup();
      chainSdk.akash.market.v1beta5.getBids.mockImplementation(async ({ filters }) =>
        bidsResponse([aBid({ dseq: String(filters!.dseq), gseq: 1, provider: `akash1on${filters!.dseq}` })])
      );

      const results = await runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }]);

      const [first, second] = sentTransactions(signingClient)[0].map(message => (message.value as MsgCreateDeployment).id!.dseq.toString());
      expect(results.map(({ dseq }) => dseq)).toEqual([first, second]);
      expect(results.map(({ bids }) => bids.map(({ id }) => id!.provider))).toEqual([[`akash1on${first}`], [`akash1on${second}`]]);
    });

    it("returns what screening expected for each deployment, null when screening failed", async () => {
      const { runner, session, bidScreeningHttpService } = setup();
      bidScreeningHttpService.findScreenedProviders
        .mockResolvedValueOnce(["akash1first"])
        .mockResolvedValueOnce(["akash1second"])
        .mockRejectedValue(new Error("inventory unavailable"));

      const results = await runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }]);

      expect(results.map(({ screenedByGroup }) => screenedByGroup)).toEqual([[["akash1first"], ["akash1second"]], null]);
    });

    it("screens before creating the deployments", async () => {
      const { runner, session, signingClient, bidScreeningHttpService } = setup();

      await runner.run(session, [{ manifest: aManifest(["a100"]) }]);

      expect(bidScreeningHttpService.findScreenedProviders.mock.invocationCallOrder.at(-1)).toBeLessThan(signingClient.broadcastTx.mock.invocationCallOrder[0]);
    });

    it("closes every deployment in its own transaction", async () => {
      const { runner, session, signingClient } = setup();

      await runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }]);

      const transactions = sentTransactions(signingClient);
      expect(transactions.map(messages => messages.length)).toEqual([2, 1, 1]);
      expect(closedDseqs(signingClient)).toEqual(createdDseqs(signingClient));
    });

    it("closes every deployment even when reading bids fails", async () => {
      const { runner, session, signingClient, chainSdk } = setup();
      chainSdk.akash.market.v1beta5.getBids.mockRejectedValue(new Error("rpc unavailable"));

      await expect(runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }])).rejects.toThrow("rpc unavailable");

      expect(closedDseqs(signingClient)).toEqual(createdDseqs(signingClient));
    });

    it("closes the other deployments and still returns the bids read when one close fails", async () => {
      const { runner, session, signingClient, chainSdk, logger } = setup();
      chainSdk.akash.market.v1beta5.getBids.mockImplementation(async ({ filters }) =>
        bidsResponse([aBid({ dseq: String(filters!.dseq), gseq: 1, provider: "akash1bidder" })])
      );
      signingClient.broadcastTx
        .mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 0, rawLog: "" }))
        .mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 5, rawLog: "deployment closed" }));

      const results = await runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }]);

      expect(results.map(({ bids }) => bids.length)).toEqual([1, 1]);
      expect(closedDseqs(signingClient)).toHaveLength(2);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_CHECK_DEPLOYMENT_CLOSE_FAILED", dseq: results[0].dseq }));
    });

    it("starts no close while a bid read is still in flight", async () => {
      const { runner, session, signingClient, chainSdk } = setup();
      let releaseSecondRead!: () => void;
      chainSdk.akash.market.v1beta5.getBids
        .mockRejectedValueOnce(new Error("rpc unavailable"))
        .mockReturnValueOnce(new Promise(resolve => (releaseSecondRead = () => resolve(bidsResponse([])))));

      const run = runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }]);
      await new Promise(resolve => setImmediate(resolve));
      expect(closedDseqs(signingClient)).toHaveLength(0);

      releaseSecondRead();
      await expect(run).rejects.toThrow("rpc unavailable");
      expect(closedDseqs(signingClient)).toHaveLength(2);
    });

    it("reports the created dseqs before reading bids", async () => {
      const { runner, session, signingClient, chainSdk } = setup();
      const onCreated = vi.fn().mockResolvedValue(undefined);

      await runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }], { onCreated });

      expect(onCreated).toHaveBeenCalledExactlyOnceWith(createdDseqs(signingClient).map(String));
      expect(onCreated.mock.invocationCallOrder[0]).toBeLessThan(chainSdk.akash.market.v1beta5.getBids.mock.invocationCallOrder[0]);
    });

    it("closes every deployment without reading bids when reporting the creation fails", async () => {
      const { runner, session, signingClient, chainSdk } = setup();
      const onCreated = vi.fn().mockRejectedValue(new Error("database unavailable"));

      await expect(runner.run(session, [{ manifest: aManifest(["a100"]) }, { manifest: aManifest(["h100"]) }], { onCreated })).rejects.toThrow(
        "database unavailable"
      );

      expect(chainSdk.akash.market.v1beta5.getBids).not.toHaveBeenCalled();
      expect(closedDseqs(signingClient)).toEqual(createdDseqs(signingClient));
    });

    it("reports no creation when the create transaction fails", async () => {
      const { runner, session, signingClient } = setup();
      signingClient.broadcastTx.mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 5, rawLog: "insufficient funds" }));
      const onCreated = vi.fn().mockResolvedValue(undefined);

      await expect(runner.run(session, [{ manifest: aManifest(["a100"]) }], { onCreated })).rejects.toThrow("insufficient funds");

      expect(onCreated).not.toHaveBeenCalled();
    });

    it("closes nothing when the create transaction fails", async () => {
      const { runner, session, signingClient } = setup();
      signingClient.broadcastTx.mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 5, rawLog: "insufficient funds" }));

      await expect(runner.run(session, [{ manifest: aManifest(["a100"]) }])).rejects.toThrow("Error broadcasting transaction: insufficient funds");

      expect(signingClient.broadcastTx).toHaveBeenCalledTimes(1);
    });

    it("logs a failed transaction with its code and raw log", async () => {
      const { runner, session, signingClient, logger } = setup();
      signingClient.broadcastTx.mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 5, rawLog: "insufficient funds" }));

      await expect(runner.run(session, [{ manifest: aManifest(["a100"]) }])).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith({ event: "GPU_CHECK_TX_FAILED", code: 5, rawLog: "insufficient funds" });
    });

    it.each([
      {
        failure: "the simulation",
        failOnce: (signingClient: MockProxy<SigningStargateClient>) =>
          signingClient.simulate.mockRejectedValueOnce(
            new Error(`Query failed with (6): rpc error: code = Unknown desc = ${SEQUENCE_MISMATCH}: unknown request`)
          )
      },
      {
        failure: "the broadcast",
        failOnce: (signingClient: MockProxy<SigningStargateClient>) =>
          signingClient.broadcastTx.mockRejectedValueOnce(new BroadcastTxError(32, "sdk", SEQUENCE_MISMATCH))
      },
      {
        failure: "the delivered transaction",
        failOnce: (signingClient: MockProxy<SigningStargateClient>) =>
          signingClient.broadcastTx.mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 32, rawLog: SEQUENCE_MISMATCH }))
      }
    ])("signs the create transaction again with a fresh sequence after a block when $failure reports a sequence mismatch", async ({ failOnce }) => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      const { runner, session, signingClient, logger } = setup();
      failOnce(signingClient);

      const run = runner.run(session, [{ manifest: aManifest(["a100"]) }]);
      await untilWarned(logger, "GPU_CHECK_CREATE_SEQUENCE_MISMATCH");
      await vi.advanceTimersByTimeAsync(6_999);
      const createAttemptsBeforeABlock = createAttempts(signingClient);
      const results = await settleWithTimers(run);

      expect(createAttemptsBeforeABlock).toBe(1);
      expect(createAttempts(signingClient)).toBe(2);
      expect(results).toHaveLength(1);
    });

    it("gives up when the create transaction mismatches its sequence a second time", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout"] });
      const { runner, session, signingClient } = setup();
      signingClient.broadcastTx.mockRejectedValue(new BroadcastTxError(32, "sdk", SEQUENCE_MISMATCH));

      const run = runner.run(session, [{ manifest: aManifest(["a100"]) }]);

      await expect(settleWithTimers(run)).rejects.toThrow(SEQUENCE_MISMATCH);

      expect(signingClient.broadcastTx).toHaveBeenCalledTimes(2);
    });

    it("does not retry a create transaction that fails for another reason", async () => {
      const { runner, session, signingClient } = setup();
      signingClient.broadcastTx.mockRejectedValueOnce(new BroadcastTxError(5, "sdk", "insufficient funds"));

      await expect(runner.run(session, [{ manifest: aManifest(["a100"]) }])).rejects.toThrow("insufficient funds");

      expect(signingClient.broadcastTx).toHaveBeenCalledTimes(1);
    });

    it("does nothing when there is nothing to check", async () => {
      const { runner, session, signingClient } = setup();

      expect(await runner.run(session, [])).toEqual([]);
      expect(signingClient.broadcastTx).not.toHaveBeenCalled();
    });

    it("doubles the simulated gas when calculating the fee", async () => {
      const { runner, session, signingClient } = setup();
      signingClient.simulate.mockResolvedValue(205481);

      await runner.run(session, [{ manifest: aManifest(["a100"]) }]);

      expect(signingClient.sign).toHaveBeenCalledWith(BOT_ADDRESS, expect.any(Array), expect.objectContaining({ gas: "410962" }), "");
    });
  });

  describe("closeDeployment", () => {
    it("closes the deployment under the bot's address", async () => {
      const { runner, session, signingClient } = setup();

      await runner.closeDeployment(session, "123");

      expect(closedDseqs(signingClient)).toEqual([123n]);
    });
  });

  function aManifest(models: string[]): GpuCheckManifest {
    const checks = models.flatMap(model => GPU_CHECK_SHAPES.map(shape => ({ model, shape })));
    const manifest = generateManifest(buildGpuCheckSdl(checks));
    if (!manifest.ok) throw new Error("invalid sdl");
    const { groups, groupSpecs } = manifest.value;
    return { groups, groupSpecs, groupModels: groupSpecs.map(({ name }) => name) };
  }

  function aBid(input: { dseq: string; gseq: number; provider: string }): QueryBidResponse {
    return {
      bid: mock<Bid>({ id: { owner: BOT_ADDRESS, dseq: BigInt(input.dseq), gseq: input.gseq, oseq: 1, provider: input.provider, bseq: 0 } }),
      escrowAccount: undefined
    };
  }

  function bidsResponse(bids: QueryBidResponse[]): QueryBidsResponse {
    return { bids, pagination: { nextKey: new Uint8Array(), total: 0n } };
  }

  async function untilLogged(logger: ReturnType<CreateLogger>, event: string) {
    while (!vi.mocked(logger.info).mock.calls.some(([log]) => (log as { event?: string }).event === event)) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  function sentTransactions(signingClient: SigningStargateClient): EncodeObject[][] {
    return vi.mocked(signingClient.sign).mock.calls.map(([, messages]) => [...messages]);
  }

  async function untilWarned(logger: ReturnType<CreateLogger>, event: string) {
    while (!vi.mocked(logger.warn).mock.calls.some(([log]) => (log as { event?: string }).event === event)) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  async function settleWithTimers<T>(promise: Promise<T>): Promise<T> {
    let isSettled = false;
    const settled = promise.finally(() => {
      isSettled = true;
    });
    settled.catch(() => undefined);

    while (!isSettled) {
      await vi.advanceTimersByTimeAsync(1_000);
      await new Promise(resolve => setImmediate(resolve));
    }

    return await settled;
  }

  function createAttempts(signingClient: SigningStargateClient): number {
    return vi.mocked(signingClient.simulate).mock.calls.filter(([, messages]) => messages[0].typeUrl.endsWith("MsgCreateDeployment")).length;
  }

  function createdDseqs(signingClient: SigningStargateClient): bigint[] {
    return sentTransactions(signingClient)
      .flat()
      .filter(message => message.typeUrl.endsWith("MsgCreateDeployment"))
      .map(message => (message.value as MsgCreateDeployment).id!.dseq);
  }

  function closedDseqs(signingClient: SigningStargateClient): bigint[] {
    return sentTransactions(signingClient)
      .flat()
      .filter(message => message.typeUrl.endsWith("MsgCloseDeployment"))
      .map(message => (message.value as MsgCloseDeployment).id!.dseq);
  }

  function setup(input: { gpuBotWalletMnemonic?: string; rpcNodeEndpoint?: string; bidWindowSeconds?: number } = {}) {
    const config = mockConfigService<BillingConfigService>({
      AVERAGE_GAS_PRICE: 0.025,
      RPC_NODE_ENDPOINT: "rpcNodeEndpoint" in input ? input.rpcNodeEndpoint : "https://rpc.example.com"
    });

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.akash.market.v1beta5.getBids.mockResolvedValue(bidsResponse([]));

    const bidScreeningHttpService = mock<BidScreeningHttpService>();
    bidScreeningHttpService.findScreenedProviders.mockResolvedValue([]);

    const signingClient = mock<SigningStargateClient>();
    signingClient.simulate.mockResolvedValue(100000);
    signingClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] });
    signingClient.broadcastTx.mockResolvedValue(mock<DeliverTxResponse>({ code: 0, rawLog: "" }));

    const signingClientFactory = mock<GpuBotSigningClientFactory>();
    signingClientFactory.connect.mockResolvedValue({ address: BOT_ADDRESS, client: signingClient });

    const deploymentConfig = mock<DeploymentConfig>({
      GPU_BOT_WALLET_MNEMONIC: "gpuBotWalletMnemonic" in input ? input.gpuBotWalletMnemonic : "test mnemonic words here",
      GPU_BOT_BID_WINDOW_SECONDS: input.bidWindowSeconds ?? 0
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const runner = new GpuCheckRunner(config, chainSdk, bidScreeningHttpService, signingClientFactory, deploymentConfig, createLogger);
    const session = { client: signingClient, owner: BOT_ADDRESS };

    return { runner, session, chainSdk, bidScreeningHttpService, signingClient, signingClientFactory, logger };
  }
});
