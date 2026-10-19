import { Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { GroupSpec, MsgCloseDeployment, MsgCreateDeployment, QueryDeploymentResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { Bid, QueryBidResponse, QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { EncodeObject } from "@cosmjs/proto-signing";
import type { DeliverTxResponse, SigningStargateClient } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentConfig } from "@src/deployment/config/config.provider";
import type { GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import type { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import type { GpuModel, PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { GpuBidsCreatorService } from "./gpu-bids-creator.service";
import type { GpuBotSigningClientFactory } from "./gpu-bot-signing-client.factory";

import { mockConfigService } from "@test/mocks/config-service.mock";

const BOT_ADDRESS = "akash1bot";

describe(GpuBidsCreatorService.name, () => {
  it("throws when GPU_BOT_WALLET_MNEMONIC is not set", async () => {
    const { service } = setup({ gpuBotWalletMnemonic: undefined });

    await expect(service.createGpuBids()).rejects.toThrow("GPU_BOT_WALLET_MNEMONIC");
  });

  it("throws when RPC_NODE_ENDPOINT is not set", async () => {
    const { service } = setup({ rpcNodeEndpoint: undefined });

    await expect(service.createGpuBids()).rejects.toThrow("RPC_NODE_ENDPOINT");
  });

  it("connects with the bot wallet", async () => {
    const { service, signingClientFactory } = setup();

    await service.createGpuBids();

    expect(signingClientFactory.connect).toHaveBeenCalledWith("test mnemonic words here");
  });

  it("checks every model in one deployment with a pricing group and a typical group per model, pinning only the model", async () => {
    const { service, signingClient } = setup({ models: [nvidia("a100"), nvidia("h100")] });

    await service.createGpuBids();

    expect(createdDeployments(signingClient)).toEqual([
      [
        { gpu: "vendor/nvidia/model/a100", cpuMillis: 100n },
        { gpu: "vendor/nvidia/model/a100", cpuMillis: 4000n },
        { gpu: "vendor/nvidia/model/h100", cpuMillis: 100n },
        { gpu: "vendor/nvidia/model/h100", cpuMillis: 4000n }
      ]
    ]);
  });

  it("creates the deployment under the bot's address with a 0.5 act deposit from its balance, and closes that same deployment", async () => {
    const { service, signingClient } = setup({ models: [nvidia("h100")] });

    await service.createGpuBids();

    const [created, closed] = sentMessages(signingClient).map(message => message.value as MsgCreateDeployment);
    expect(created.id).toEqual({ owner: BOT_ADDRESS, dseq: expect.any(BigInt) });
    expect(created.deposit).toEqual({ amount: { denom: "uact", amount: "500000" }, sources: [Source.balance] });
    expect(closed.id).toEqual(created.id);
  });

  it("reads the bids of the deployment it created", async () => {
    const { service, signingClient, chainSdk } = setup({ models: [nvidia("h100")] });

    await service.createGpuBids();

    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledWith({
      filters: { owner: BOT_ADDRESS, dseq: createdDseq(signingClient) },
      pagination: { key: undefined, limit: 1000n }
    });
  });

  it("splits more than 10 models across deployments so none exceeds 20 groups", async () => {
    const models = Array.from({ length: 25 }, (_, index) => nvidia(`model${index}`));
    const { service, signingClient } = setup({ models });

    await service.createGpuBids();

    expect(createdDeployments(signingClient).map(groups => groups.length)).toEqual([20, 20, 10]);
  });

  it("creates no deployment when no gpu is available", async () => {
    const { service, signingClient, logger } = setup({ models: [] });

    await service.createGpuBids();

    expect(signingClient.broadcastTx).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_BIDS_CREATED", gpuCount: 0, deploymentCount: 0 }));
  });

  it("skips models of a vendor the SDL cannot express", async () => {
    const { service, signingClient, logger } = setup({ models: [{ vendor: "amd", model: "mi300x" }, nvidia("h100")] });

    await service.createGpuBids();

    expect(createdModels(signingClient)).toEqual([["vendor/nvidia/model/h100"]]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS" }));
  });

  it("does not report skipped models when every model is supported", async () => {
    const { service, logger } = setup({ models: [nvidia("h100")] });

    await service.createGpuBids();

    expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS" }));
  });

  it.each(["h100\n          ram: 80Gi", "h100: true", "a100/ram/80Gi", ""])(
    "skips a reported model name an SDL attribute key cannot carry: %j",
    async model => {
      const { service, signingClient } = setup({ models: [nvidia(model), nvidia("rtx-4090_d.v2")] });

      await service.createGpuBids();

      expect(createdModels(signingClient)).toEqual([["vendor/nvidia/model/rtx-4090_d.v2"]]);
    }
  );

  it.each(["4090", "1.5", "true", "null"])("checks a model whose name yaml would otherwise read as another type: %j", async model => {
    const { service, signingClient } = setup({ models: [nvidia(model)] });

    await service.createGpuBids();

    expect(createdModels(signingClient)).toEqual([[`vendor/nvidia/model/${model}`]]);
  });

  it("screens every group before creating the deployment", async () => {
    const { service, signingClient, bidScreeningHttpService } = setup({ models: [nvidia("a100"), nvidia("h100")] });

    await service.createGpuBids();

    const screenedGroups = bidScreeningHttpService.findScreenedProviders.mock.calls.map(([groupSpec]) => groupSpec);
    expect(screenedGroups).toEqual(sentDeployments(signingClient)[0].groups);
    expect(bidScreeningHttpService.findScreenedProviders.mock.invocationCallOrder.at(-1)).toBeLessThan(signingClient.broadcastTx.mock.invocationCallOrder[0]);
  });

  it("waits the bid window before reading bids", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const { service, chainSdk, logger } = setup({ models: [nvidia("h100")], bidWindowSeconds: 90 });

      const run = service.createGpuBids();
      await untilLogged(logger, "GPU_CHECK_DEPLOYMENT_CREATED");
      await vi.advanceTimersByTimeAsync(89_999);
      expect(chainSdk.akash.market.v1beta5.getBids).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await run;
      expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records, per model, every provider screening expected and every provider that bid", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-19T12:00:00Z") });
    try {
      const { service, signingClient, gpuBidCheckRepository } = setup({
        models: [nvidia("a100"), nvidia("h100")],
        screened: { gpu00: ["akash1both", "akash1silent"], gpu02: ["akash1both"] },
        bidPages: [{ bids: [aBid({ gseq: 1, provider: "akash1both" }), aBid({ gseq: 4, provider: "akash1unscreened" })] }]
      });

      await service.createGpuBids();

      const check = { vendor: "nvidia", source: "pricing-bot", dseq: createdDseq(signingClient), checkedAt: new Date("2026-10-19T12:00:00Z") };
      expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([
        { ...check, provider: "akash1both", model: "a100", screened: true, bid: true },
        { ...check, provider: "akash1silent", model: "a100", screened: true, bid: false },
        { ...check, provider: "akash1both", model: "h100", screened: true, bid: false },
        { ...check, provider: "akash1unscreened", model: "h100", screened: false, bid: true }
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts a provider that bid on either shape as having bid on the model, and one screened for either shape as expected", async () => {
    const { service, gpuBidCheckRepository } = setup({
      models: [nvidia("h100")],
      screened: { gpu00: ["akash1pricing"], gpu01: ["akash1typical"] },
      bidPages: [{ bids: [aBid({ gseq: 2, provider: "akash1pricing" }), aBid({ gseq: 1, provider: "akash1typical" })] }]
    });

    await service.createGpuBids();

    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ provider: "akash1pricing", screened: true, bid: true }),
      expect.objectContaining({ provider: "akash1typical", screened: true, bid: true })
    ]);
  });

  it("ignores bids without an id", async () => {
    const { service, gpuBidCheckRepository } = setup({
      models: [nvidia("h100")],
      bidPages: [
        {
          bids: [
            { bid: mock<Bid>({ id: undefined }), escrowAccount: undefined },
            { bid: undefined, escrowAccount: undefined }
          ]
        }
      ]
    });

    await service.createGpuBids();

    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([]);
  });

  it("reports the providers each model was expected to get a bid from and did not", async () => {
    const { service, logger } = setup({
      models: [nvidia("a100"), nvidia("h100")],
      screened: { gpu00: ["akash1both", "akash1silent"], gpu03: ["akash1both"] },
      bidPages: [{ bids: [aBid({ gseq: 1, provider: "akash1both" }), aBid({ gseq: 3, provider: "akash1both" })] }]
    });

    await service.createGpuBids();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "GPU_CHECK_BIDS_RECEIVED",
        models: [
          { model: "a100", screenedCount: 2, bidders: ["akash1both"] },
          { model: "h100", screenedCount: 1, bidders: ["akash1both"] }
        ],
        missed: [{ model: "a100", providers: ["akash1silent"] }]
      })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "GPU_BIDS_CREATED", bidCount: 2, missed: [{ model: "a100", providers: ["akash1silent"] }] })
    );
  });

  it("still checks the gpus when screening fails, recording the bids without blaming any provider for a miss", async () => {
    const { service, signingClient, bidScreeningHttpService, gpuBidCheckRepository, logger } = setup({
      models: [nvidia("h100")],
      bidPages: [{ bids: [aBid({ gseq: 1, provider: "akash1bidder" })] }]
    });
    bidScreeningHttpService.findScreenedProviders.mockRejectedValue(new Error("provider inventory unavailable"));

    await service.createGpuBids();

    expect(logger.warn).toHaveBeenCalledWith({ event: "GPU_CHECK_SCREENING_FAILED", error: new Error("provider inventory unavailable") });
    expect(broadcastTypes(signingClient)).toEqual(["/akash.deployment.v1beta4.MsgCreateDeployment", "/akash.deployment.v1beta4.MsgCloseDeployment"]);
    expect(gpuBidCheckRepository.insertMany).toHaveBeenCalledWith([expect.objectContaining({ provider: "akash1bidder", screened: false, bid: true })]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "GPU_CHECK_BIDS_RECEIVED", models: [{ model: "h100", screenedCount: null, bidders: ["akash1bidder"] }], missed: [] })
    );
  });

  it("deletes checks older than 30 days once the run is over", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-19T12:00:00Z") });
    try {
      const { service, gpuBidCheckRepository } = setup({ models: [nvidia("h100")] });

      await service.createGpuBids();

      expect(gpuBidCheckRepository.deleteCheckedBefore).toHaveBeenCalledWith(new Date("2026-09-19T12:00:00Z"));
      expect(gpuBidCheckRepository.deleteCheckedBefore.mock.invocationCallOrder[0]).toBeGreaterThan(
        gpuBidCheckRepository.insertMany.mock.invocationCallOrder[0]
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes the deployment and reports the batch as failed when recording the checks fails", async () => {
    const { service, signingClient, gpuBidCheckRepository, logger } = setup({ models: [nvidia("h100")] });
    gpuBidCheckRepository.insertMany.mockRejectedValue(new Error("database unavailable"));

    await expect(service.createGpuBids()).rejects.toThrow("1 of 1 gpu check deployments failed");

    expect(broadcastTypes(signingClient)).toEqual(["/akash.deployment.v1beta4.MsgCreateDeployment", "/akash.deployment.v1beta4.MsgCloseDeployment"]);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_CHECK_BATCH_FAILED", error: new Error("database unavailable") }));
  });

  it("reads every page of bids", async () => {
    const nextKey = new Uint8Array([1, 2, 3]);
    const { service, chainSdk, logger } = setup({
      models: [nvidia("h100")],
      bidPages: [{ bids: [aBid({ gseq: 1, provider: "akash1first" })], nextKey }, { bids: [aBid({ gseq: 1, provider: "akash1second" })] }]
    });

    await service.createGpuBids();

    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pagination: expect.objectContaining({ key: nextKey }) })
    );
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_BIDS_CREATED", bidCount: 2 }));
  });

  it("stops reading bids when the chain answers without pagination", async () => {
    const { service, chainSdk, logger } = setup({ models: [nvidia("h100")] });
    chainSdk.akash.market.v1beta5.getBids.mockReset();
    chainSdk.akash.market.v1beta5.getBids.mockResolvedValue({ bids: [aBid({ gseq: 1, provider: "akash1first" })], pagination: undefined });

    await service.createGpuBids();

    expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_BIDS_CREATED", bidCount: 1 }));
  });

  it("closes every deployment it creates", async () => {
    const { service, signingClient } = setup({ models: Array.from({ length: 11 }, (_, index) => nvidia(`model${index}`)) });

    await service.createGpuBids();

    expect(broadcastTypes(signingClient)).toEqual([
      "/akash.deployment.v1beta4.MsgCreateDeployment",
      "/akash.deployment.v1beta4.MsgCloseDeployment",
      "/akash.deployment.v1beta4.MsgCreateDeployment",
      "/akash.deployment.v1beta4.MsgCloseDeployment"
    ]);
  });

  it("closes the deployment and checks the next batch when reading bids fails, then reports the failure", async () => {
    const { service, signingClient, chainSdk, gpuBidCheckRepository, logger } = setup({
      models: Array.from({ length: 11 }, (_, index) => nvidia(`model${index}`))
    });
    chainSdk.akash.market.v1beta5.getBids.mockReset();
    chainSdk.akash.market.v1beta5.getBids.mockRejectedValueOnce(new Error("rpc unavailable")).mockResolvedValue(bidsResponse([]));

    await expect(service.createGpuBids()).rejects.toThrow("1 of 2 gpu check deployments failed");

    expect(broadcastTypes(signingClient)).toEqual([
      "/akash.deployment.v1beta4.MsgCreateDeployment",
      "/akash.deployment.v1beta4.MsgCloseDeployment",
      "/akash.deployment.v1beta4.MsgCreateDeployment",
      "/akash.deployment.v1beta4.MsgCloseDeployment"
    ]);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_CHECK_BATCH_FAILED" }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "GPU_BIDS_CREATED", deploymentCount: 1, failedDeploymentCount: 1 }));
    expect(gpuBidCheckRepository.deleteCheckedBefore).toHaveBeenCalledTimes(1);
  });

  it("closes nothing when the deployment could not be created", async () => {
    const { service, signingClient, logger } = setup({ models: [nvidia("h100")] });
    signingClient.broadcastTx.mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 5, rawLog: "insufficient funds" }));

    await expect(service.createGpuBids()).rejects.toThrow("1 of 1 gpu check deployments failed");

    expect(broadcastTypes(signingClient)).toEqual(["/akash.deployment.v1beta4.MsgCreateDeployment"]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "GPU_CHECK_BATCH_FAILED", error: new Error("Error broadcasting transaction: insufficient funds") })
    );
  });

  it("closes the deployments an earlier run left open before checking", async () => {
    const { service, signingClient, chainSdk, logger } = setup({ models: [nvidia("h100")], leftoverDseqs: [111n, 222n] });

    await service.createGpuBids();

    expect(chainSdk.akash.deployment.v1beta4.getDeployments).toHaveBeenCalledWith({
      filters: { owner: BOT_ADDRESS, state: "active" },
      pagination: { limit: 100n }
    });
    expect(closedDseqs(signingClient).slice(0, 2)).toEqual([111n, 222n]);
    expect(broadcastTypes(signingClient)[2]).toBe("/akash.deployment.v1beta4.MsgCreateDeployment");
    expect(logger.info).toHaveBeenCalledWith({ event: "GPU_CHECK_LEFTOVER_DEPLOYMENT_CLOSED", dseq: "111" });
  });

  it("keeps closing leftovers and checking when a leftover cannot be closed", async () => {
    const { service, signingClient, logger } = setup({ models: [nvidia("h100")], leftoverDseqs: [111n, 222n] });
    signingClient.broadcastTx.mockResolvedValueOnce(mock<DeliverTxResponse>({ code: 5, rawLog: "deployment closed" }));

    await service.createGpuBids();

    expect(logger.error).toHaveBeenCalledWith({
      event: "GPU_CHECK_LEFTOVER_DEPLOYMENT_CLOSE_FAILED",
      dseq: "111",
      error: new Error("Error broadcasting transaction: deployment closed")
    });
    expect(closedDseqs(signingClient)).toContain(222n);
    expect(createdModels(signingClient)).toEqual([["vendor/nvidia/model/h100"]]);
  });

  it("checks the gpus even when the open deployments cannot be read", async () => {
    const { service, signingClient, chainSdk, logger } = setup({ models: [nvidia("h100")] });
    chainSdk.akash.deployment.v1beta4.getDeployments.mockRejectedValue(new Error("rpc unavailable"));

    await service.createGpuBids();

    expect(logger.error).toHaveBeenCalledWith({ event: "GPU_CHECK_LEFTOVER_DEPLOYMENTS_UNREAD", error: new Error("rpc unavailable") });
    expect(createdModels(signingClient)).toEqual([["vendor/nvidia/model/h100"]]);
  });

  it("doubles the simulated gas when calculating the fee", async () => {
    const { service, signingClient } = setup({ models: [nvidia("h100")] });
    signingClient.simulate.mockResolvedValue(205481);

    await service.createGpuBids();

    expect(signingClient.simulate).toHaveBeenCalledWith(BOT_ADDRESS, expect.any(Array), "");
    expect(signingClient.sign).toHaveBeenCalledWith(BOT_ADDRESS, expect.any(Array), expect.objectContaining({ gas: "410962" }), "");
  });

  it("reports the run's fee cost in akt from the uakt balance", async () => {
    const { service, signingClient, logger } = setup({ models: [nvidia("h100")] });
    signingClient.getBalance.mockResolvedValueOnce({ denom: "uakt", amount: "5000000" }).mockResolvedValueOnce({ denom: "uakt", amount: "4750000" });

    await service.createGpuBids();

    expect(signingClient.getBalance).toHaveBeenCalledWith(BOT_ADDRESS, "uakt");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "GPU_BIDS_CREATED", gpuCount: 1, deploymentCount: 1, failedDeploymentCount: 0, feeAkt: 0.25 })
    );
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: GpuBidsCreatorService.name });
  });

  async function untilLogged(logger: ReturnType<CreateLogger>, event: string) {
    while (!vi.mocked(logger.info).mock.calls.some(([log]) => (log as { event?: string }).event === event)) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  function nvidia(model: string): GpuModel {
    return { vendor: "nvidia", model };
  }

  function aBid(input: { gseq: number; provider: string }): QueryBidResponse {
    return {
      bid: mock<Bid>({ id: { owner: BOT_ADDRESS, dseq: 1n, gseq: input.gseq, oseq: 1, provider: input.provider, bseq: 0 } }),
      escrowAccount: undefined
    };
  }

  function bidsResponse(bids: QueryBidResponse[], nextKey: Uint8Array = new Uint8Array()): QueryBidsResponse {
    return { bids, pagination: { nextKey, total: 0n } };
  }

  function sentMessages(signingClient: SigningStargateClient): EncodeObject[] {
    return vi.mocked(signingClient.sign).mock.calls.flatMap(([, messages]) => messages);
  }

  function broadcastTypes(signingClient: SigningStargateClient): string[] {
    return sentMessages(signingClient).map(message => message.typeUrl);
  }

  function closedDseqs(signingClient: SigningStargateClient): bigint[] {
    return sentMessages(signingClient)
      .filter(message => message.typeUrl.endsWith("MsgCloseDeployment"))
      .map(message => (message.value as MsgCloseDeployment).id!.dseq);
  }

  function sentDeployments(signingClient: SigningStargateClient): MsgCreateDeployment[] {
    return sentMessages(signingClient)
      .filter(message => message.typeUrl.endsWith("MsgCreateDeployment"))
      .map(message => message.value as MsgCreateDeployment);
  }

  function createdDseq(signingClient: SigningStargateClient): string {
    return sentDeployments(signingClient)[0].id!.dseq.toString();
  }

  function createdDeployments(signingClient: SigningStargateClient) {
    return sentDeployments(signingClient).map(({ groups }) =>
      groups.map(({ resources: [{ resource }] }) => ({ gpu: resource!.gpu!.attributes[0].key, cpuMillis: resource!.cpu!.units!.val }))
    );
  }

  function createdModels(signingClient: SigningStargateClient): string[][] {
    return createdDeployments(signingClient).map(groups => [...new Set(groups.map(({ gpu }) => gpu))]);
  }

  function setup(
    input: {
      gpuBotWalletMnemonic?: string;
      rpcNodeEndpoint?: string;
      models?: GpuModel[];
      screened?: Record<string, string[]>;
      bidPages?: Array<{ bids: QueryBidResponse[]; nextKey?: Uint8Array }>;
      bidWindowSeconds?: number;
      leftoverDseqs?: bigint[];
    } = {}
  ) {
    const config = mockConfigService<BillingConfigService>({
      AVERAGE_GAS_PRICE: 0.025,
      RPC_NODE_ENDPOINT: "rpcNodeEndpoint" in input ? input.rpcNodeEndpoint : "https://rpc.example.com"
    });

    const chainSdk = mockDeep<ChainSDK>();
    for (const page of input.bidPages ?? []) {
      chainSdk.akash.market.v1beta5.getBids.mockResolvedValueOnce(bidsResponse(page.bids, page.nextKey));
    }
    chainSdk.akash.market.v1beta5.getBids.mockResolvedValue(bidsResponse([]));
    chainSdk.akash.deployment.v1beta4.getDeployments.mockResolvedValue({
      deployments: (input.leftoverDseqs ?? []).map(dseq => mock<QueryDeploymentResponse>({ deployment: { id: { owner: BOT_ADDRESS, dseq } } })),
      pagination: undefined
    });

    const placementOptionsHttpService = mock<PlacementOptionsHttpService>();
    placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue(input.models ?? []);

    const bidScreeningHttpService = mock<BidScreeningHttpService>();
    bidScreeningHttpService.findScreenedProviders.mockImplementation(async (groupSpec: GroupSpec) => input.screened?.[groupSpec.name] ?? []);

    const gpuBidCheckRepository = mock<GpuBidCheckRepository>();

    const signingClient = mock<SigningStargateClient>();
    signingClient.simulate.mockResolvedValue(100000);
    signingClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] });
    signingClient.broadcastTx.mockResolvedValue(mock<DeliverTxResponse>({ code: 0, rawLog: "" }));
    signingClient.getBalance.mockResolvedValue({ amount: "1000000", denom: "uakt" });

    const signingClientFactory = mock<GpuBotSigningClientFactory>();
    signingClientFactory.connect.mockResolvedValue({ address: BOT_ADDRESS, client: signingClient });

    const deploymentConfig = mock<DeploymentConfig>({
      GPU_BOT_WALLET_MNEMONIC: "gpuBotWalletMnemonic" in input ? input.gpuBotWalletMnemonic : "test mnemonic words here",
      GPU_BOT_BID_WINDOW_SECONDS: input.bidWindowSeconds ?? 0
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new GpuBidsCreatorService(
      config,
      chainSdk,
      placementOptionsHttpService,
      bidScreeningHttpService,
      gpuBidCheckRepository,
      signingClientFactory,
      deploymentConfig,
      createLogger
    );

    return {
      service,
      config,
      chainSdk,
      placementOptionsHttpService,
      bidScreeningHttpService,
      gpuBidCheckRepository,
      signingClientFactory,
      signingClient,
      logger,
      createLogger
    };
  }
});
