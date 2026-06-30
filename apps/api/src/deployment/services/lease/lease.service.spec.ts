import type { LeaseHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import type { WalletInitialized, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { LeaseService } from "./lease.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const MANIFEST = '{"version":"v2","groups":[]}';

describe(LeaseService.name, () => {
  describe("createLeasesAndSendManifest", () => {
    it("creates the lease and sends the manifest when no lease exists on-chain", async () => {
      const { service, leaseHttpService, signerService, rpcMessageService, providerService, wallet, deployment } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      const result = await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(leaseHttpService.list).toHaveBeenCalledWith({ owner: wallet.address, dseq: lease.dseq });
      expect(rpcMessageService.getCreateLeaseMsg).toHaveBeenCalledWith({
        owner: wallet.address,
        dseq: lease.dseq,
        gseq: lease.gseq,
        oseq: lease.oseq,
        provider: lease.provider
      });
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
      expect(result).toBe(deployment);
    });

    it("skips lease creation but still sends the manifest when an active lease already exists", async () => {
      const { service, leaseHttpService, signerService, rpcMessageService, providerService, wallet, deployment } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      leaseHttpService.list.mockResolvedValue({
        leases: [createLeaseApiResponse({ owner: wallet.address, dseq: lease.dseq, state: "active" })],
        pagination: { next_key: null, total: "1" }
      });

      const result = await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(rpcMessageService.getCreateLeaseMsg).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
      expect(result).toBe(deployment);
    });

    it("recreates the lease when only a closed lease exists for the deployment", async () => {
      const { service, leaseHttpService, signerService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      leaseHttpService.list.mockResolvedValue({
        leases: [createLeaseApiResponse({ owner: wallet.address, dseq: lease.dseq, state: "closed" })],
        pagination: { next_key: null, total: "1" }
      });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    });

    it("creates every placement lease in a single transaction when none exist", async () => {
      const { service, signerService, rpcMessageService, providerService, wallet } = setup();
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() }
      ];

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(rpcMessageService.getCreateLeaseMsg).toHaveBeenCalledTimes(2);
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      const [, messages] = signerService.executeDerivedDecodedTxByUserId.mock.calls[0];
      expect(messages).toHaveLength(2);
      expect(providerService.sendManifest).toHaveBeenCalledTimes(2);
    });

    it("sends the manifest to the provider with generated auth", async () => {
      const { service, providerService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(providerService.toProviderAuth).toHaveBeenCalledWith({ walletId: wallet.id, provider: lease.provider });
      expect(providerService.sendManifest).toHaveBeenCalledWith({
        provider: lease.provider,
        dseq: lease.dseq,
        manifest: MANIFEST,
        auth: { type: "jwt", token: "jwt-token" }
      });
    });
  });

  function setup(input: { wallet?: WalletInitialized } = {}) {
    const wallet = input.wallet ?? (createUserWallet() as WalletInitialized);

    const signerService = mock<ManagedSignerService>();
    const rpcMessageService = mock<RpcMessageService>();
    const providerService = mock<ProviderService>();
    const deploymentReaderService = mock<DeploymentReaderService>();
    const walletReaderService = mock<WalletReaderService>();
    const leaseHttpService = mock<LeaseHttpService>();

    const deployment = mock<GetDeploymentResponse["data"]>();

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    leaseHttpService.list.mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "jwt-token" });
    deploymentReaderService.findByWalletAndDseq.mockResolvedValue(deployment);

    const service = new LeaseService(signerService, rpcMessageService, providerService, deploymentReaderService, walletReaderService, leaseHttpService);

    return { service, signerService, rpcMessageService, providerService, deploymentReaderService, walletReaderService, leaseHttpService, wallet, deployment };
  }
});
