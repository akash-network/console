import "@test/mocks/logger-service.mock";

import type { NetworkId, SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, yaml as sdlYaml } from "@akashnetwork/chain-sdk";
import type { BidHttpService, BlockHttpService } from "@akashnetwork/http-sdk";
import type { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import type { SigningStargateClient } from "@cosmjs/stargate";
import { mock } from "vitest-mock-extended";

import type { DeploymentConfig } from "@src/deployment/config/config.provider";
import type { GpuService } from "@src/gpu/services/gpu.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { GpuBidsCreatorService } from "./gpu-bids-creator.service";
import { sdlTemplateWithRam, sdlTemplateWithRamAndInterface } from "./sdl-templates";

vi.mock("@akashnetwork/chain-sdk", async importOriginal => {
  const actual = await importOriginal<typeof import("@akashnetwork/chain-sdk")>();
  return {
    ...actual,
    generateManifest: vi.fn(),
    generateManifestVersion: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
  };
});

vi.mock("@cosmjs/proto-signing", async importOriginal => {
  const actual = await importOriginal<typeof import("@cosmjs/proto-signing")>();
  return {
    ...actual,
    DirectSecp256k1HdWallet: {
      fromMnemonic: vi.fn()
    }
  };
});

vi.mock("@cosmjs/stargate", async importOriginal => {
  const actual = await importOriginal<typeof import("@cosmjs/stargate")>();
  return {
    ...actual,
    calculateFee: vi.fn().mockReturnValue({ amount: [{ denom: "uakt", amount: "5000" }], gas: "200000" }),
    SigningStargateClient: {
      connectWithSigner: vi.fn()
    }
  };
});

vi.mock("timers/promises", () => ({
  setTimeout: vi.fn().mockResolvedValue(undefined)
}));

describe(GpuBidsCreatorService.name, () => {
  describe("getModelSdl", () => {
    it("generates SDL with ram only when no interface provided", () => {
      const { service } = setup();

      const result = service["getModelSdl"]("nvidia", "a100", "80Gi");

      const expected = sdlTemplateWithRam.replace("<VENDOR>", "nvidia").replace("<MODEL>", "a100").replace("<RAM>", "80Gi");
      expect(result).toBe(expected);
    });

    it("generates SDL with ram and interface when interface provided", () => {
      const { service } = setup();

      const result = service["getModelSdl"]("nvidia", "a100", "80Gi", "pcie");

      const expected = sdlTemplateWithRamAndInterface
        .replace("<VENDOR>", "nvidia")
        .replace("<MODEL>", "a100")
        .replace("<RAM>", "80Gi")
        .replace("<INTERFACE>", "pcie");
      expect(result).toBe(expected);
    });

    it("lowercases interface", () => {
      const { service } = setup();

      const result = service["getModelSdl"]("nvidia", "a100", "80Gi", "PCIe");

      expect(result).toContain("interface: pcie");
    });

    it("normalizes SXM interface variants to sxm", () => {
      const { service } = setup();

      const result = service["getModelSdl"]("nvidia", "a100", "80Gi", "SXM4");

      expect(result).toContain("interface: sxm");
    });
  });

  describe("createDeployment", () => {
    it("creates deployment with valid SDL", async () => {
      const { service, signingClient } = setup();
      const sdlStr = sdlTemplateWithRam.replace("<VENDOR>", "nvidia").replace("<MODEL>", "a100").replace("<RAM>", "80Gi");

      const mockGroups = [{ name: "akash" }];
      const mockGroupSpecs = [{ name: "akash", requirements: {} }];
      vi.mocked(generateManifest).mockReturnValue({
        ok: true,
        value: { groups: mockGroups, groupSpecs: mockGroupSpecs, meta: undefined }
      } as any);

      await service["createDeployment"](signingClient, sdlStr, "akash1owner", "12345");

      expect(generateManifest).toHaveBeenCalledWith(expect.anything(), "mainnet");
      expect(signingClient.simulate).toHaveBeenCalled();
      expect(signingClient.sign).toHaveBeenCalled();
      expect(signingClient.broadcastTx).toHaveBeenCalled();
    });

    it("throws when SDL is invalid", async () => {
      const { service, signingClient } = setup();
      const sdlStr = "invalid sdl";

      vi.mocked(generateManifest).mockReturnValue({
        ok: false,
        value: [{ message: "Invalid manifest" }]
      } as any);

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
  });

  describe("createBidsForAllModels", () => {
    it("creates deployments for each GPU model, waits for bids, and closes", async () => {
      const { service, signingClient, bidHttpService, blockHttpService } = setup();
      const gpuModels = {
        gpus: {
          total: { allocatable: 10, allocated: 5 },
          details: {
            nvidia: [{ model: "a100", ram: "80Gi", interface: "pcie", allocatable: 5, allocated: 2 }]
          }
        }
      };

      vi.mocked(generateManifest).mockReturnValue({
        ok: true,
        value: { groups: [], groupSpecs: [], meta: undefined }
      } as any);

      bidHttpService.list.mockResolvedValue([]);

      await service["createBidsForAllModels"](gpuModels as any, signingClient, "akash1owner", false);

      expect(blockHttpService.getCurrentHeight).toHaveBeenCalled();
      expect(signingClient.simulate).toHaveBeenCalledTimes(2);
      expect(bidHttpService.list).toHaveBeenCalledWith("akash1owner", "100000");
    });

    it("skips duplicate model+ram combos when includeInterface is false", async () => {
      const { service, signingClient, bidHttpService, blockHttpService } = setup();
      const gpuModels = {
        gpus: {
          total: { allocatable: 10, allocated: 5 },
          details: {
            nvidia: [
              { model: "a100", ram: "80Gi", interface: "pcie", allocatable: 3, allocated: 1 },
              { model: "a100", ram: "80Gi", interface: "sxm", allocatable: 2, allocated: 1 }
            ]
          }
        }
      };

      vi.mocked(generateManifest).mockReturnValue({
        ok: true,
        value: { groups: [], groupSpecs: [], meta: undefined }
      } as any);

      bidHttpService.list.mockResolvedValue([]);

      await service["createBidsForAllModels"](gpuModels as any, signingClient, "akash1owner", false);

      expect(signingClient.simulate).toHaveBeenCalledTimes(2);
    });

    it("does not skip duplicate model+ram combos when includeInterface is true", async () => {
      const { service, signingClient, bidHttpService } = setup();
      const gpuModels = {
        gpus: {
          total: { allocatable: 10, allocated: 5 },
          details: {
            nvidia: [
              { model: "a100", ram: "80Gi", interface: "pcie", allocatable: 3, allocated: 1 },
              { model: "a100", ram: "80Gi", interface: "sxm", allocatable: 2, allocated: 1 }
            ]
          }
        }
      };

      vi.mocked(generateManifest).mockReturnValue({
        ok: true,
        value: { groups: [], groupSpecs: [], meta: undefined }
      } as any);

      bidHttpService.list.mockResolvedValue([]);

      await service["createBidsForAllModels"](gpuModels as any, signingClient, "akash1owner", true);

      expect(signingClient.simulate).toHaveBeenCalledTimes(4);
    });

    it("filters out UNKNOWN vendor", async () => {
      const { service, signingClient, bidHttpService } = setup();
      const gpuModels = {
        gpus: {
          total: { allocatable: 10, allocated: 5 },
          details: {
            "<UNKNOWN>": [{ model: "unknown", ram: "8Gi", interface: "pcie", allocatable: 1, allocated: 0 }],
            nvidia: [{ model: "a100", ram: "80Gi", interface: "pcie", allocatable: 5, allocated: 2 }]
          }
        }
      };

      vi.mocked(generateManifest).mockReturnValue({
        ok: true,
        value: { groups: [], groupSpecs: [], meta: undefined }
      } as any);

      bidHttpService.list.mockResolvedValue([]);

      await service["createBidsForAllModels"](gpuModels as any, signingClient, "akash1owner", false);

      expect(signingClient.simulate).toHaveBeenCalledTimes(2);
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
  });

  describe("getCurrentHeight", () => {
    it("returns current height from block service", async () => {
      const { service } = setup();

      const height = await service["getCurrentHeight"]();

      expect(height).toBe(100000);
    });

    it("throws when height is NaN", async () => {
      const { service, blockHttpService } = setup();
      blockHttpService.getCurrentHeight.mockResolvedValue(NaN);

      await expect(service["getCurrentHeight"]()).rejects.toThrow("Failed to get current height");
    });
  });

  function setup(input: { gpuBotWalletMnemonic?: string; rpcNodeEndpoint?: string } = {}) {
    const config = mockConfigService<BillingConfigService>({
      NETWORK: "mainnet",
      AVERAGE_GAS_PRICE: 0.025,
      ...(input.rpcNodeEndpoint !== undefined ? {} : { RPC_NODE_ENDPOINT: "https://rpc.example.com" })
    });

    if (input.rpcNodeEndpoint === undefined && !("rpcNodeEndpoint" in input)) {
      config.get.mockImplementation((key: string) => {
        const values: Record<string, any> = {
          NETWORK: "mainnet",
          AVERAGE_GAS_PRICE: 0.025,
          RPC_NODE_ENDPOINT: "https://rpc.example.com"
        };
        if (key in values) return values[key];
        throw new Error(`Missing mock for config key "${key}"`);
      });
    } else if (input.rpcNodeEndpoint === undefined) {
      config.get.mockImplementation((key: string) => {
        if (key === "RPC_NODE_ENDPOINT") return "";
        const values: Record<string, any> = {
          NETWORK: "mainnet",
          AVERAGE_GAS_PRICE: 0.025
        };
        if (key in values) return values[key];
        throw new Error(`Missing mock for config key "${key}"`);
      });
    }

    const bidHttpService = mock<BidHttpService>();
    bidHttpService.list.mockResolvedValue([]);

    const gpuService = mock<GpuService>();
    gpuService.getGpuList.mockResolvedValue({
      gpus: { total: { allocatable: 0, allocated: 0 }, details: {} }
    } as any);

    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(100000);

    const typeRegistry = mock<Registry>();

    const deploymentConfig: DeploymentConfig = {
      GPU_BOT_WALLET_MNEMONIC: "gpuBotWalletMnemonic" in input ? input.gpuBotWalletMnemonic : "test mnemonic words here",
      PROVIDER_PROXY_URL: "https://proxy.example.com"
    };

    const signingClient = mock<SigningStargateClient>();
    signingClient.simulate.mockResolvedValue(100000);
    signingClient.sign.mockResolvedValue({ authInfoBytes: new Uint8Array(), bodyBytes: new Uint8Array(), signatures: [] } as any);
    signingClient.broadcastTx.mockResolvedValue({ code: 0, rawLog: "" } as any);
    signingClient.getBalance.mockResolvedValue({ amount: "1000000", denom: "uakt" });

    const service = new GpuBidsCreatorService(config, bidHttpService, gpuService, blockHttpService, typeRegistry, deploymentConfig);

    return {
      service,
      config,
      bidHttpService,
      gpuService,
      blockHttpService,
      typeRegistry,
      deploymentConfig,
      signingClient
    };
  }
});
