import type { Bid, BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { LeaseService } from "./lease.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const MANIFEST = '{"version":"v2","groups":[]}';
const DERIVED_MANIFEST = '{"version":"v2","groups":[{"name":"derived"}]}';
const LEASE_ON_CLOSED_BID = createError(400, "Failed to create lease: Cannot create lease: The selected bid is no longer open.");

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

    it("asks no provider for a lease status before the manifest reaches it", async () => {
      const { service, deploymentReaderService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(deploymentReaderService.findByWalletAndDseqWithoutProviderStatus).toHaveBeenCalledWith(wallet, lease.dseq);
      expect(deploymentReaderService.findByWalletAndDseq).not.toHaveBeenCalled();
    });

    it("checks each provider once before broadcasting, however many of its placements are leased", async () => {
      const { service, providerService, signerService, wallet } = setup();
      const provider = createAkashAddress();
      const other = createAkashAddress();
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider },
        { dseq: "100", gseq: 2, oseq: 1, provider },
        { dseq: "100", gseq: 3, oseq: 1, provider: other }
      ];

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(vi.mocked(providerService.assertReachable).mock.calls).toEqual([[provider], [other]]);
      expect(providerService.assertReachable.mock.invocationCallOrder[1]).toBeLessThan(
        signerService.executeDerivedDecodedTxByUserId.mock.invocationCallOrder[0]
      );
    });

    it("broadcasts nothing and sends no manifest when any provider is unreachable", async () => {
      const { service, providerService, signerService, wallet } = setup();
      const reachable = createAkashAddress();
      const unreachable = createAkashAddress();
      const refusal = createError(502, "unreachable", { errorCode: "provider_unreachable" });
      providerService.assertReachable.mockImplementation(async provider => {
        if (provider === unreachable) throw refusal;
      });
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: reachable },
        { dseq: "100", gseq: 2, oseq: 1, provider: unreachable }
      ];

      await expect(service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(refusal);

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("skips the check when the lease already exists, so a retry goes straight to the manifest", async () => {
      const { service, providerService, leaseHttpService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      leaseHttpService.list.mockResolvedValue({
        leases: [createLeaseApiResponse({ owner: wallet.address, dseq: lease.dseq, state: "active" })],
        pagination: { next_key: null, total: "1" }
      });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(providerService.assertReachable).not.toHaveBeenCalled();
      expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
    });

    it("refuses a lease on a bid the chain reports closed before signing anything or asking any provider", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, providerService, wallet } = setup({ bids: owner => [bidFor(owner, lease, "closed")] });

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(LEASE_ON_CLOSED_BID);

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.assertReachable).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("refuses the whole request when any one placement's bid is closed", async () => {
      const open = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const closed = { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({ bids: owner => [bidFor(owner, open, "open"), bidFor(owner, closed, "closed")] });

      await expect(service.createLeasesAndSendManifest({ leases: [open, closed], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(
        LEASE_ON_CLOSED_BID
      );

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("leases a placement when one of its provider's bids is still open", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({
        bids: owner => [bidFor(owner, lease, "closed", 1), bidFor(owner, lease, "open", 2)]
      });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    });

    it("leaves a bid the chain does not report for the chain to judge", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({ bids: () => [] });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    });

    it.each([
      { differs: "gseq", other: (lease: TestLease) => ({ ...lease, gseq: lease.gseq + 1 }) },
      { differs: "oseq", other: (lease: TestLease) => ({ ...lease, oseq: lease.oseq + 1 }) },
      { differs: "provider", other: (lease: TestLease) => ({ ...lease, provider: createAkashAddress() }) }
    ])("ignores a closed bid whose $differs is not the leased placement's", async ({ other }) => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({ bids: owner => [bidFor(owner, other(lease), "closed")] });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    });

    it("reads only the bids of each leased placement", async () => {
      const provider = createAkashAddress();
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider },
        { dseq: "100", gseq: 2, oseq: 1, provider },
        { dseq: "200", gseq: 1, oseq: 1, provider }
      ];
      const { service, bidHttpService, wallet } = setup();

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(bidHttpService.list.mock.calls).toEqual(leases.map(({ dseq, gseq, oseq, provider }) => [wallet.address, dseq, { gseq, oseq, provider }]));
    });

    it("reads no further placement once one is refused", async () => {
      const closed = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const next = { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() };
      const { service, bidHttpService, wallet } = setup({ bids: owner => [bidFor(owner, closed, "closed")] });

      await expect(service.createLeasesAndSendManifest({ leases: [closed, next], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(
        LEASE_ON_CLOSED_BID
      );

      expect(bidHttpService.list).toHaveBeenCalledTimes(1);
    });

    it("leaves a placement whose bids cannot be read for the chain to judge", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const failure = new Error("bids unavailable");
      const { service, bidHttpService, signerService, logger, wallet } = setup();
      bidHttpService.list.mockRejectedValue(failure);

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith({ event: "LEASE_BID_LOOKUP_FAILED", ...lease, error: failure });
    });

    it("judges each placement against the bids of its own deployment", async () => {
      const first = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const second = { dseq: "200", gseq: 1, oseq: 1, provider: first.provider };
      const { service, wallet } = setup({ bids: owner => [bidFor(owner, first, "open"), bidFor(owner, second, "closed")] });

      await expect(service.createLeasesAndSendManifest({ leases: [first, second], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(
        LEASE_ON_CLOSED_BID
      );
    });

    it("reads no bids when the lease already exists", async () => {
      const { service, bidHttpService, leaseHttpService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      leaseHttpService.list.mockResolvedValue({
        leases: [createLeaseApiResponse({ owner: wallet.address, dseq: lease.dseq, state: "active" })],
        pagination: { next_key: null, total: "1" }
      });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(bidHttpService.list).not.toHaveBeenCalled();
    });

    it("reports the lease exists when the provider it names did not receive the manifest", async () => {
      const { service, providerService, wallet } = setup();
      const delivered = createAkashAddress();
      const undelivered = createAkashAddress();
      providerService.sendManifest.mockImplementation(async ({ provider }) => {
        if (provider === undelivered) throw createError(503, "Provider service is temporarily unavailable");
        return true;
      });
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: delivered },
        { dseq: "100", gseq: 2, oseq: 1, provider: undelivered }
      ];

      await expect(service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId })).rejects.toMatchObject({
        status: 503,
        errorCode: "manifest_not_delivered",
        message: `The lease for deployment 100 exists, but provider ${undelivered} did not receive its manifest. Send this request again to retry, or close the deployment to stop paying for it.`,
        data: { dseq: "100", provider: undelivered, reason: "Provider service is temporarily unavailable" },
        originalError: expect.objectContaining({ status: 503, message: "Provider service is temporarily unavailable" })
      });
    });

    it("lets a failure that is not an http error through unchanged", async () => {
      const { service, providerService, wallet } = setup();
      const failure = new Error("jwt signing failed");
      providerService.sendManifest.mockRejectedValue(failure);
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(failure);
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
      const { service, providerService, wallet } = setup({ derived: DERIVED_MANIFEST });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: DERIVED_MANIFEST }));
    });

    it("sends the manifest the request carried for a deployment the console recorded nothing for", async () => {
      const { service, providerService, wallet } = setup({ derived: null });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: MANIFEST }));
    });

    it("sends the derived manifest for a request that carried none", async () => {
      const { service, providerService, wallet } = setup({ derived: DERIVED_MANIFEST });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], userId: wallet.userId });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: DERIVED_MANIFEST }));
    });

    it("costs no lease on chain when the request carries no manifest and the console recorded nothing to derive one from", async () => {
      const { service, signerService, providerService, wallet } = setup({ derived: null });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createLeasesAndSendManifest({ leases: [lease], userId: wallet.userId })).rejects.toMatchObject({ status: 422 });

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("sends nothing to any provider once one placement of the deployment has no manifest to send", async () => {
      const { service, providerService, leaseManifestService, wallet } = setup();
      leaseManifestService.deriveFor.mockImplementation(async ({ dseq }) => (dseq === "100" ? DERIVED_MANIFEST : null));
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "200", gseq: 1, oseq: 1, provider: createAkashAddress() }
      ];

      await expect(service.createLeasesAndSendManifest({ leases, userId: wallet.userId })).rejects.toMatchObject({ status: 422 });

      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("derives once for a deployment however many placements it leases", async () => {
      const { service, leaseManifestService, wallet } = setup({ derived: DERIVED_MANIFEST });
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() }
      ];

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(leaseManifestService.deriveFor).toHaveBeenCalledOnce();
      expect(leaseManifestService.deriveFor).toHaveBeenCalledWith({ dseq: "100", userId: wallet.userId });
    });

    it("looks each lease's manifest up under that lease's own dseq, not the first lease's", async () => {
      const { service, providerService, leaseManifestService, wallet } = setup();
      leaseManifestService.deriveFor.mockImplementation(async ({ dseq }) => `manifest-of-${dseq}`);
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "200", gseq: 1, oseq: 1, provider: createAkashAddress() }
      ];

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(vi.mocked(providerService.sendManifest).mock.calls.map(([options]) => [options.dseq, options.manifest])).toEqual([
        ["100", "manifest-of-100"],
        ["200", "manifest-of-200"]
      ]);
    });

    it("reads the identity it funds the lease from off the authenticated user", async () => {
      const { service, walletReaderService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(walletReaderService.getWalletByUserId).toHaveBeenCalledWith(wallet.userId);
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
      const { service, signerService, providerService, leaseManifestService, wallet } = setup();
      leaseManifestService.deriveFor.mockRejectedValue(refusal);
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(refusal);

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });
  });

  type TestLease = { dseq: string; gseq: number; oseq: number; provider: string };

  function bidFor(owner: string, lease: TestLease, state: Bid["bid"]["state"], bseq = 1): Bid {
    const bid = createBid({ owner, ...lease, bseq });
    bid.bid.state = state;
    return bid;
  }

  function setup(input: { wallet?: WalletInitialized; derived?: string | null; bids?: (owner: string) => Bid[] } = {}) {
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
    const bidHttpService = mock<BidHttpService>({
      list: vi.fn(async (owner: string, dseq: string, filters: Parameters<BidHttpService["list"]>[2] = {}) =>
        (input.bids?.(owner) ?? []).filter(
          ({ bid: { id } }) =>
            id.dseq === dseq && Object.entries(filters).every(([name, value]) => value === undefined || id[name as keyof Bid["bid"]["id"]] === value)
        )
      )
    });
    const logger = mock<LoggerService>();
    const chainErrorService = mock<ChainErrorService>({ leaseOnClosedBidError: vi.fn(() => LEASE_ON_CLOSED_BID) });

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    leaseHttpService.list.mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } });
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "jwt-token" });
    deploymentReaderService.findByWalletAndDseqWithoutProviderStatus.mockResolvedValue(deployment);

    const service = new LeaseService(
      signerService,
      rpcMessageService,
      providerService,
      deploymentReaderService,
      walletReaderService,
      leaseHttpService,
      leaseManifestService,
      bidHttpService,
      chainErrorService,
      () => logger
    );

    return {
      service,
      bidHttpService,
      signerService,
      rpcMessageService,
      providerService,
      deploymentReaderService,
      walletReaderService,
      leaseHttpService,
      leaseManifestService,
      logger,
      wallet,
      deployment
    };
  }
});
