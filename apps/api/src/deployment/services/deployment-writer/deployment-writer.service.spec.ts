import type { BlockHttpService } from "@akashnetwork/http-sdk";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { WalletInitialized, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "./deployment-writer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(DeploymentWriterService.name, () => {
  const wallet: WalletInitialized = {
    id: 1,
    userId: "user-1",
    address: "akash1testaddr",
    creditAmount: 100,
    deploymentAllowance: 50,
    feeAllowance: 10
  } as WalletInitialized;

  const manifestValue = {
    groups: [{ name: "test-group" }],
    groupSpecs: [{ name: "test-group", resources: [] }]
  };

  const deploymentData: GetDeploymentResponse["data"] = {
    deployment: {
      id: { owner: wallet.address, dseq: "100" },
      state: "active",
      hash: Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"),
      created_at: "2026-01-01"
    },
    leases: [
      {
        id: { owner: wallet.address, dseq: "100", gseq: 1, oseq: 1, provider: "provider-1", bseq: 1 },
        state: "active",
        price: { denom: "uakt", amount: "1000" },
        created_at: "2026-01-01",
        closed_on: "",
        status: null
      }
    ],
    escrow_account: {
      id: { scope: "deployment", xid: "100" },
      state: {
        owner: wallet.address,
        state: "open",
        transferred: [],
        settled_at: "0",
        funds: [],
        deposits: []
      }
    }
  };

  describe("create", () => {
    it("creates a deployment and returns dseq, manifest, and signTx", async () => {
      const { service, blockHttpService, signerService, rpcMessageService } = setup();
      const dseq = 200;
      blockHttpService.getCurrentHeight.mockResolvedValue(dseq);
      const txResult = { code: 0, transactionHash: "tx-hash" };
      signerService.executeDerivedDecodedTxByUserId.mockResolvedValue(txResult);
      const createMsg = { typeUrl: "/create", value: {} };
      rpcMessageService.getCreateDeploymentMsg.mockReturnValue(createMsg);

      const result = await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(result.dseq).toBe("200");
      expect(result.signTx).toBe(txResult);
      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: wallet.address,
          dseq,
          groups: manifestValue.groupSpecs,
          denom: "uakt",
          amount: 5000000
        })
      );
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [createMsg]);
    });

    it("throws 400 when SDL is invalid", async () => {
      const { service, sdlService } = setup();
      sdlService.generateManifest.mockReturnValue({
        ok: false,
        value: [{ message: "invalid version" }]
      } as any);

      await expect(service.create({ userId: "user-1", sdl: "bad-sdl", deposit: 5 })).rejects.toThrow();
    });
  });

  describe("closeByUserIdAndDseq", () => {
    it("fetches wallet and closes deployment", async () => {
      const { service, signerService, rpcMessageService } = setup();
      const closeMsg = { typeUrl: "/close", value: {} };
      rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg);

      await service.closeByUserIdAndDseq("user-1", "100");

      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(wallet.address, "100");
      expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(wallet, [closeMsg]);
    });
  });

  describe("close", () => {
    it("closes deployment by wallet and dseq", async () => {
      const { service, signerService, rpcMessageService } = setup();
      const closeMsg = { typeUrl: "/close", value: {} };
      rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg);

      await service.close(wallet, "100");

      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(wallet.address, "100");
      expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(wallet, [closeMsg]);
    });
  });

  describe("deposit", () => {
    it("deposits funds and returns updated deployment", async () => {
      const { service, rpcMessageService, signerService, deploymentReaderService } = setup();
      const updatedDeployment = { ...deploymentData };
      deploymentReaderService.findByWalletAndDseq.mockResolvedValue(updatedDeployment);
      const depositMsg = { typeUrl: "/deposit", value: {} };
      rpcMessageService.getDepositDeploymentMsg.mockReturnValue(depositMsg);

      const result = await service.deposit({ userId: "user-1", dseq: "100", amount: 3 });

      expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith({
        owner: wallet.address,
        dseq: "100",
        amount: 3000000,
        denom: "uakt",
        signer: wallet.address
      });
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [depositMsg]);
      expect(result).toBe(updatedDeployment);
    });
  });

  describe("updateByUserIdAndDseq", () => {
    it("sends update tx when manifest hash differs", async () => {
      const { service, signerService, rpcMessageService, deploymentReaderService } = setup();
      const staleDeployment = {
        ...deploymentData,
        deployment: { ...deploymentData.deployment, hash: "stale-hash" }
      };
      deploymentReaderService.findByWalletAndDseq.mockResolvedValueOnce(staleDeployment).mockResolvedValueOnce(deploymentData);
      const updateMsg = { typeUrl: "/update", value: {} };
      rpcMessageService.getUpdateDeploymentMsg.mockReturnValue(updateMsg);

      const result = await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(rpcMessageService.getUpdateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ owner: wallet.address, dseq: "100" }));
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [updateMsg]);
      expect(result).toBe(deploymentData);
    });

    it("skips update tx when manifest hash matches", async () => {
      const { service, signerService, rpcMessageService, sdlService } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3]);
      sdlService.generateManifestVersion.mockResolvedValue(manifestVersion);

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(rpcMessageService.getUpdateDeploymentMsg).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("sends manifest to all unique lease providers", async () => {
      const { service, providerService, deploymentReaderService } = setup();
      const deploymentWithMultipleLeases = {
        ...deploymentData,
        leases: [
          { ...deploymentData.leases[0], id: { ...deploymentData.leases[0].id, provider: "provider-1" } },
          { ...deploymentData.leases[0], id: { ...deploymentData.leases[0].id, provider: "provider-2" } },
          { ...deploymentData.leases[0], id: { ...deploymentData.leases[0].id, provider: "provider-1" } }
        ]
      };
      deploymentReaderService.findByWalletAndDseq.mockResolvedValueOnce(deploymentWithMultipleLeases).mockResolvedValueOnce(deploymentData);
      providerService.toProviderAuth.mockResolvedValue({ certPem: "cert", keyPem: "key" });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(providerService.sendManifest).toHaveBeenCalledTimes(2);
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ provider: "provider-1" }));
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ provider: "provider-2" }));
    });
  });

  function setup() {
    const blockHttpService = mock<BlockHttpService>();
    const signerService = mock<ManagedSignerService>();
    const rpcMessageService = mock<RpcMessageService>();
    const sdlService = mock<SdlService>();
    const billingConfig: MockProxy<BillingConfigService> = mockConfigService<BillingConfigService>({
      DEPLOYMENT_GRANT_DENOM: "uakt"
    });
    const providerService = mock<ProviderService>();
    const deploymentReaderService = mock<DeploymentReaderService>();
    const walletReaderService = mock<WalletReaderService>();

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    sdlService.generateManifest.mockReturnValue({ ok: true, value: manifestValue } as any);
    sdlService.generateManifestVersion.mockResolvedValue(new Uint8Array([4, 5, 6]));
    deploymentReaderService.findByWalletAndDseq.mockResolvedValue(deploymentData);

    const service = new DeploymentWriterService(
      blockHttpService,
      signerService,
      rpcMessageService,
      sdlService,
      billingConfig,
      providerService,
      deploymentReaderService,
      walletReaderService
    );

    return {
      service,
      blockHttpService,
      signerService,
      rpcMessageService,
      sdlService,
      billingConfig,
      providerService,
      deploymentReaderService,
      walletReaderService
    };
  }
});
