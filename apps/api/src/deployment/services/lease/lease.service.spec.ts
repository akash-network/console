import type { LeaseHttpService } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { LeaseService } from "./lease.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const MANIFEST = '{"version":"v2","groups":[]}';
const DERIVED_MANIFEST = '{"version":"v2","groups":[{"name":"derived"}]}';

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
        manifest: DERIVED_MANIFEST,
        auth: { type: "jwt", token: "jwt-token" }
      });
    });

    it("sends the manifest it derived from the stored definition, not the one the request carried", async () => {
      const { service, providerService } = setup({ derived: DERIVED_MANIFEST });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: "user-1" });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: DERIVED_MANIFEST }));
    });

    it("sends the manifest the request carried for a deployment the console recorded nothing for", async () => {
      const { service, providerService } = setup({ derived: null });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: "user-1" });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: MANIFEST }));
    });

    it("derives once for a deployment however many placements it leases", async () => {
      const { service, leaseManifestService } = setup({ derived: DERIVED_MANIFEST });
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() }
      ];

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: "user-1" });

      expect(leaseManifestService.deriveFor).toHaveBeenCalledOnce();
      expect(leaseManifestService.deriveFor).toHaveBeenCalledWith({ dseq: "100" });
    });

    it("sends each dseq its own manifest when a request names more than one deployment", async () => {
      const other = '{"version":"v2","groups":[{"name":"other"}]}';
      const { service, providerService, leaseManifestService } = setup({ derived: DERIVED_MANIFEST });
      leaseManifestService.deriveFor.mockImplementation(async ({ dseq }) => (dseq === "100" ? DERIVED_MANIFEST : other));
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "200", gseq: 1, oseq: 1, provider: createAkashAddress() }
      ];

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: "user-1" });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ dseq: "100", manifest: DERIVED_MANIFEST }));
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ dseq: "200", manifest: other }));
    });

    it("still sends the derived manifest when the lease already exists on chain", async () => {
      const { service, providerService, wallet, leaseHttpService } = setup({ derived: DERIVED_MANIFEST });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      leaseHttpService.list.mockResolvedValue({
        leases: [createLeaseApiResponse({ owner: wallet.address, dseq: lease.dseq, state: "active" })],
        pagination: { next_key: null, total: "1" }
      });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: DERIVED_MANIFEST }));
    });

    it("broadcasts nothing and sends nothing when the stored definition cannot be derived", async () => {
      const refusal = new Error("underivable");
      const { service, signerService, providerService, leaseManifestService } = setup();
      leaseManifestService.deriveFor.mockRejectedValue(refusal);
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: "user-1" })).rejects.toBe(refusal);

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });
  });

  function setup(input: { wallet?: WalletInitialized; derived?: string | null } = {}) {
    const wallet = input.wallet ?? (createUserWallet() as WalletInitialized);

    const signerService = mock<ManagedSignerService>();
    const rpcMessageService = mock<RpcMessageService>();
    const providerService = mock<ProviderService>();
    const deploymentReaderService = mock<DeploymentReaderService>();
    const walletReaderService = mock<WalletReaderService>();
    const leaseHttpService = mock<LeaseHttpService>();
    const leaseManifestService = mock<LeaseManifestService>({
      deriveFor: vi.fn().mockResolvedValue(input.derived === undefined ? DERIVED_MANIFEST : input.derived)
    });

    const deployment = mock<GetDeploymentResponse["data"]>();

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    leaseHttpService.list.mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "jwt-token" });
    deploymentReaderService.findByWalletAndDseq.mockResolvedValue(deployment);

    const service = new LeaseService(
      signerService,
      rpcMessageService,
      providerService,
      deploymentReaderService,
      walletReaderService,
      leaseHttpService,
      leaseManifestService
    );

    return {
      service,
      signerService,
      rpcMessageService,
      providerService,
      deploymentReaderService,
      walletReaderService,
      leaseHttpService,
      leaseManifestService,
      wallet,
      deployment
    };
  }
});
