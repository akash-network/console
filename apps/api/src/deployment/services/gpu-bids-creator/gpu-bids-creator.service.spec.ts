import type { QueryBidsResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { Registry } from "@cosmjs/proto-signing";
import { calculateFee, type SigningStargateClient } from "@cosmjs/stargate";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentConfig } from "@src/deployment/config/config.provider";
import type { PlacementOptionsHttpService } from "@src/deployment/services/placement-options-http/placement-options-http.service";
import { GpuBidsCreatorService } from "./gpu-bids-creator.service";
import { sdlTemplate } from "./sdl-templates";

import { mockConfigService } from "@test/mocks/config-service.mock";

const mockSigningClient = mock<SigningStargateClient>();

vi.mock("timers/promises", () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@cosmjs/proto-signing", async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    DirectSecp256k1HdWallet: {
      fromMnemonic: vi.fn().mockResolvedValue({
        getAccounts: vi.fn().mockResolvedValue([{ address: "akash1testaddr" }])
      })
    }
  };
});

vi.mock("@cosmjs/stargate", async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    SigningStargateClient: {
      connectWithSigner: vi.fn().mockImplementation(() => Promise.resolve(mockSigningClient))
    },
    calculateFee: vi.fn().mockReturnValue({ amount: [{ denom: "uakt", amount: "2500" }], gas: "100000" })
  };
});

describe(GpuBidsCreatorService.name, () => {
  describe("getModelSdl", () => {
    it("pins only the vendor and the model, as the configure page does", () => {
      const { service } = setup();

      const result = service["getModelSdl"]({ vendor: "nvidia", model: "a100" });

      expect(result).toBe(sdlTemplate.replace("<VENDOR>", "nvidia").replace("<MODEL>", "a100"));
      expect(result).not.toContain("ram:");
      expect(result).not.toContain("interface:");
    });
  });

  describe("createDeployment", () => {
    it("creates deployment with valid SDL", async () => {
      const { service, signingClient } = setup();
      const sdlStr = sdlTemplate.replace("<VENDOR>", "nvidia").replace("<MODEL>", "a100");

      await service["createDeployment"](signingClient, sdlStr, "akash1owner", "12345");
      expect(signingClient.simulate).toHaveBeenCalled();
      expect(signingClient.sign).toHaveBeenCalled();
      expect(signingClient.broadcastTx).toHaveBeenCalled();
    });

    it("throws when SDL is invalid", async () => {
      const { service, signingClient } = setup();
      const sdlStr = "invalid sdl";

      await expect(service["createDeployment"](signingClient, sdlStr, "akash1owner", "12345")).rejects.toThrow();
    });
  });

  describe("createGpuBids", () => {
    it("throws when GPU_BOT_WALLET_MNEMONIC is not set", async () => {
      const { service } = setup({ gpuBotWalletMnemonic: undefined });

      await expect(service.createGpuBids()).rejects.toThrow("GPU_BOT_WALLET_MNEMONIC");
    });

    it("throws when RPC_NODE_ENDPOINT is not set", async () => {
      const { service } = setup({ rpcNodeEndpoint: undefined });

      await expect(service.createGpuBids()).rejects.toThrow("RPC_NODE_ENDPOINT");
    });

    it("fetches balances with uact denom and checks every available gpu model once", async () => {
      const { service, placementOptionsHttpService, chainSdk, logger } = setup();
      placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([
        { vendor: "nvidia", model: "a100" },
        { vendor: "nvidia", model: "h100" }
      ]);
      mockSigningClient.getBalance.mockResolvedValue({ amount: "1000000", denom: "uact" });
      mockSigningClient.simulate.mockResolvedValue(100000);
      mockSigningClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] } as any);
      mockSigningClient.broadcastTx.mockResolvedValue({ code: 0, rawLog: "" } as any);

      await service.createGpuBids();

      expect(mockSigningClient.getBalance).toHaveBeenCalledWith("akash1testaddr", "uact");
      expect(mockSigningClient.getBalance).toHaveBeenCalledTimes(2);
      expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(2);
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS" }));
    });

    it("skips models of a vendor the SDL cannot express", async () => {
      const { service, placementOptionsHttpService, chainSdk, logger } = setup();
      placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([
        { vendor: "amd", model: "mi300x" },
        { vendor: "nvidia", model: "h100" }
      ]);
      mockSigningClient.getBalance.mockResolvedValue({ amount: "1000000", denom: "uact" });
      mockSigningClient.simulate.mockResolvedValue(100000);
      mockSigningClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] } as any);
      mockSigningClient.broadcastTx.mockResolvedValue({ code: 0, rawLog: "" } as any);

      await service.createGpuBids();

      expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "SKIPPING_UNSUPPORTED_GPU_MODELS" }));
    });

    it.each(["h100\n          ram: 80Gi", "h100: true", "a100/ram/80Gi", ""])(
      "skips a reported model name an SDL attribute key cannot carry: %j",
      async model => {
        const { service, placementOptionsHttpService, chainSdk } = setup();
        placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([
          { vendor: "nvidia", model },
          { vendor: "nvidia", model: "rtx-4090_d.v2" }
        ]);
        mockSigningClient.getBalance.mockResolvedValue({ amount: "1000000", denom: "uact" });
        mockSigningClient.simulate.mockResolvedValue(100000);
        mockSigningClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] } as any);
        mockSigningClient.broadcastTx.mockResolvedValue({ code: 0, rawLog: "" } as any);

        await service.createGpuBids();

        expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(1);
      }
    );
  });

  describe("createBidsForAllModels", () => {
    it("creates one deployment per gpu model, reads its bids, and closes it", async () => {
      const { service, signingClient, chainSdk } = setup();

      await service["createBidsForAllModels"](
        [
          { vendor: "nvidia", model: "a100" },
          { vendor: "nvidia", model: "h100" }
        ],
        signingClient,
        "akash1owner"
      );

      expect(signingClient.simulate).toHaveBeenCalledTimes(4);
      expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledTimes(2);
      expect(chainSdk.akash.market.v1beta5.getBids).toHaveBeenCalledWith({ filters: { owner: "akash1owner", dseq: expect.any(String) } });
    });

    it("creates no deployment when no gpu is available", async () => {
      const { service, signingClient, chainSdk } = setup();

      await service["createBidsForAllModels"]([], signingClient, "akash1owner");

      expect(signingClient.simulate).not.toHaveBeenCalled();
      expect(chainSdk.akash.market.v1beta5.getBids).not.toHaveBeenCalled();
    });
  });

  describe("signAndBroadcast", () => {
    it("throws when broadcast returns non-zero code", async () => {
      const { service, signingClient } = setup();
      signingClient.broadcastTx.mockResolvedValue({ code: 1, rawLog: "some error" } as any);

      await expect(service["signAndBroadcast"]("akash1owner", signingClient, [])).rejects.toThrow("Error broadcasting transaction");
    });

    it("broadcasts successfully when code is 0", async () => {
      const { service, signingClient } = setup();

      const result = await service["signAndBroadcast"]("akash1owner", signingClient, []);

      expect(result).toEqual(expect.objectContaining({ code: 0 }));
    });

    it("doubles the simulated gas when calculating the fee", async () => {
      const { service, signingClient } = setup();
      signingClient.simulate.mockResolvedValue(205481);

      await service["signAndBroadcast"]("akash1owner", signingClient, []);

      expect(calculateFee).toHaveBeenCalledWith(410962, "0.025uakt");
    });
  });

  function setup(input: { gpuBotWalletMnemonic?: string; rpcNodeEndpoint?: string } = {}) {
    const config = mockConfigService<BillingConfigService>({
      NETWORK: "mainnet",
      AVERAGE_GAS_PRICE: 0.025,
      RPC_NODE_ENDPOINT: "rpcNodeEndpoint" in input ? input.rpcNodeEndpoint : "https://rpc.example.com"
    });

    const chainSdk = mockDeep<ChainSDK>();
    chainSdk.akash.market.v1beta5.getBids.mockResolvedValue(mock<QueryBidsResponse>({ bids: [] }));

    const placementOptionsHttpService = mock<PlacementOptionsHttpService>();
    placementOptionsHttpService.findAvailableGpuModels.mockResolvedValue([]);

    const typeRegistry = mock<Registry>();

    const deploymentConfig = {
      GPU_BOT_WALLET_MNEMONIC: "gpuBotWalletMnemonic" in input ? input.gpuBotWalletMnemonic : "test mnemonic words here",
      PROVIDER_PROXY_URL: "https://proxy.example.com"
    } as DeploymentConfig;

    const signingClient = mock<SigningStargateClient>();
    signingClient.simulate.mockResolvedValue(100000);
    signingClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] } as any);
    signingClient.broadcastTx.mockResolvedValue({ code: 0, rawLog: "" } as any);
    signingClient.getBalance.mockResolvedValue({ amount: "1000000", denom: "uakt" });

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = () => logger;

    const service = new GpuBidsCreatorService(config, chainSdk, placementOptionsHttpService, typeRegistry, deploymentConfig, createLogger);

    return {
      service,
      config,
      chainSdk,
      placementOptionsHttpService,
      typeRegistry,
      deploymentConfig,
      signingClient,
      logger
    };
  }
});
