import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { Bid, BidHttpService, LeaseHttpService, RpcLease } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import createError from "http-errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { WalletInitialized } from "@src/billing/repositories";
import type { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { JobQueueService, TxService } from "@src/core";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import { ReconcileLeaseCreate, reconcileLeaseCreateOptionsFor } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.job";
import { createdLeaseActivityOf, failedLeaseActivityOf, pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
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
  afterEach(() => {
    vi.useRealTimers();
  });

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
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, providerService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });

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
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, bidHttpService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });

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
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, rpcMessageService, providerService, wallet, deployment } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });

      const result = await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(rpcMessageService.getCreateLeaseMsg).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
      expect(result).toBe(deployment);
    });

    it("recreates the lease when the lease on its placement was closed", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease, "closed")] });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
    });

    it("gives a lease an earlier attempt landed the follow-up its broadcast would have, instead of creating it again", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, providerService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.followUpLandedLeases).toHaveBeenCalledOnce();
      expect(signerService.followUpLandedLeases).toHaveBeenCalledWith(wallet, [lease]);
      expect(signerService.followUpLandedLeases.mock.invocationCallOrder[0]).toBeLessThan(providerService.sendManifest.mock.invocationCallOrder[0]);
    });

    it("leaves the follow-up of a lease it creates to its broadcast", async () => {
      const { service, signerService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
    });

    it.each([
      { differs: "provider", other: (lease: TestLease) => ({ ...lease, provider: createAkashAddress() }) },
      { differs: "gseq", other: (lease: TestLease) => ({ ...lease, gseq: lease.gseq + 1 }) }
    ])("creates the lease when only a lease whose $differs is another is live on the deployment", async ({ other }) => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, other(lease))] });

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
    });

    it("creates the leases when only some of the ones requested are live", async () => {
      const landed = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const missing = { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, landed)] });

      await service.createLeasesAndSendManifest({ leases: [landed, missing], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
    });

    it("follows up every group's lease once all of them are live", async () => {
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() }
      ];
      const { service, signerService, leaseHttpService, wallet } = setup({ onChain: owner => leases.map(lease => leaseOnChain(owner, lease)) });

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(signerService.followUpLandedLeases).toHaveBeenCalledWith(wallet, leases);
      expect(leaseHttpService.list.mock.calls).toEqual([[{ owner: wallet.address, dseq: "100" }]]);
    });

    it("looks each lease up among the leases of its own deployment", async () => {
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "200", gseq: 1, oseq: 1, provider: createAkashAddress() }
      ];
      const { service, signerService, leaseHttpService, wallet } = setup({ onChain: owner => leases.map(lease => leaseOnChain(owner, lease)) });

      await service.createLeasesAndSendManifest({ leases, manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.followUpLandedLeases).toHaveBeenCalledWith(wallet, leases);
      expect(leaseHttpService.list.mock.calls).toEqual([[{ owner: wallet.address, dseq: "100" }], [{ owner: wallet.address, dseq: "200" }]]);
    });

    describe("when the lease could not be created", () => {
      it.each([
        {
          failure: "its bid is no longer open because the lease landed",
          fail: ({ bids }: Failures) => bids.push("active")
        },
        {
          failure: "its provider cannot be reached",
          fail: ({ providerService }: Failures) =>
            providerService.assertReachable.mockRejectedValue(createError(502, "unreachable", { errorCode: "provider_unreachable" }))
        },
        {
          failure: "the signer refused to broadcast it",
          fail: ({ signerService }: Failures) => signerService.assertCanBroadcast.mockRejectedValue(createError(402, "Not enough credits"))
        },
        {
          failure: "the signer could not tell whether its transaction landed",
          fail: ({ signerService }: Failures) => signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(new TxOutcomeUnknownError("tx-hash"))
        }
      ])("reports success when the lease turns out to have landed after $failure", async ({ fail }) => {
        const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
        const bids: Bid["bid"]["state"][] = [];
        const { service, signerService, providerService, leaseHttpService, wallet, deployment } = setup({
          bids: owner => bids.map(state => bidFor(owner, lease, state)),
          onChain: owner => [leaseOnChain(owner, lease)]
        });
        leaseHttpService.list.mockResolvedValueOnce({ leases: [], pagination: { next_key: null, total: "0" } });
        fail({ bids, providerService, signerService });

        const result = await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

        expect(result).toBe(deployment);
        expect(signerService.followUpLandedLeases).toHaveBeenCalledOnce();
        expect(signerService.followUpLandedLeases).toHaveBeenCalledWith(wallet, [lease]);
        expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
      });

      it("logs the failure it found the lease behind", async () => {
        const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
        const failure = new TxOutcomeUnknownError("tx-hash");
        const { service, signerService, leaseHttpService, logger, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });
        leaseHttpService.list.mockResolvedValueOnce({ leases: [], pagination: { next_key: null, total: "0" } });
        signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(failure);

        await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

        expect(logger.info).toHaveBeenCalledWith({ event: "LEASE_FOUND_AFTER_CREATE_FAILED", dseq: "100", error: failure });
      });

      it("still refuses a bid the chain reports closed when no lease landed on it", async () => {
        const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
        const { service, signerService, providerService, leaseHttpService, wallet } = setup({ bids: owner => [bidFor(owner, lease, "closed")] });

        await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(LEASE_ON_CLOSED_BID);

        expect(leaseHttpService.list).toHaveBeenCalledTimes(2);
        expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
        expect(providerService.sendManifest).not.toHaveBeenCalled();
      });

      it("answers a broadcast it cannot settle as undecided while its lease is not visible yet", async () => {
        const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
        const undecided = new TxOutcomeUnknownError("tx-hash");
        const { service, signerService, providerService, wallet } = setup();
        signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(undecided);

        await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(undecided);

        expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
        expect(providerService.sendManifest).not.toHaveBeenCalled();
      });

      it("keeps the original failure, and logs why, when the leases cannot be read again", async () => {
        const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
        const failure = new TxOutcomeUnknownError("tx-hash");
        const readFailure = new Error("rest node unavailable");
        const { service, signerService, leaseHttpService, logger, wallet } = setup();
        leaseHttpService.list.mockResolvedValueOnce({ leases: [], pagination: { next_key: null, total: "0" } }).mockRejectedValueOnce(readFailure);
        signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(failure);

        await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(failure);

        expect(signerService.followUpLandedLeases).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith({ event: "LEASE_REREAD_FAILED", dseq: "100", error: readFailure });
      });
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
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, providerService, wallet } = setup({ derived: DERIVED_MANIFEST, onChain: owner => [leaseOnChain(owner, lease)] });

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

    it("checks the signer would broadcast the leases before broadcasting them", async () => {
      const { service, signerService, rpcMessageService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const message = { typeUrl: "/create-lease", value: MsgCreateLease.fromPartial({}) };
      rpcMessageService.getCreateLeaseMsg.mockReturnValue(message);

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(signerService.assertCanBroadcast).toHaveBeenCalledWith(wallet.userId, [message]);
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith(wallet.userId, [message]);
    });

    it("records the leases in the caller's activity feed once their manifest is sent", async () => {
      const { service, activityService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(activityService.record).toHaveBeenCalledWith(createdLeaseActivityOf({ userId: wallet.userId, leases: [lease] }));
    });

    it.each([
      { refusal: "a bid the chain reports closed", refuse: ({ bids }: Failures) => bids.push("closed") },
      {
        refusal: "an unreachable provider",
        refuse: ({ providerService }: Failures) =>
          providerService.assertReachable.mockRejectedValue(createError(502, "unreachable", { errorCode: "provider_unreachable" }))
      },
      {
        refusal: "the signer's refusal",
        refuse: ({ signerService }: Failures) => signerService.assertCanBroadcast.mockRejectedValue(createError(402, "Not enough credits"))
      }
    ])("records nothing and broadcasts nothing when stopped by $refusal", async ({ refuse }) => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const bids: Bid["bid"]["state"][] = [];
      const { service, signerService, providerService, activityService, jobQueueService, wallet } = setup({
        bids: owner => bids.map(state => bidFor(owner, lease, state))
      });
      refuse({ bids, providerService, signerService });

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBeDefined();

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(activityService.record).not.toHaveBeenCalled();
      expect(activityService.open).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("records the failure the caller is answered with once the leases got past every refusal", async () => {
      const { service, providerService, activityService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      providerService.sendManifest.mockRejectedValue(createError(503, "Provider service is temporarily unavailable"));

      const failure = await service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId }).catch(error => error);

      expect(activityService.record).toHaveBeenCalledWith(failedLeaseActivityOf({ userId: wallet.userId, leases: [lease] }, failure));
      expect(activityService.record).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", meta: expect.objectContaining({ error: expect.objectContaining({ code: "manifest_not_delivered" }) }) })
      );
    });

    it("opens a lease left undecided as pending with a check on it in one transaction, and still answers with the failure", async () => {
      vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z"), toFake: ["Date"] });
      const undecided = new TxOutcomeUnknownError("ABCDEF");
      const { service, signerService, activityService, jobQueueService, txService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(undecided);
      jobQueueService.enqueue.mockImplementation(async () => {
        expect(txService.transaction).toHaveBeenCalledTimes(1);
        return "reconcile-job-1";
      });

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(undecided);

      const [[opened]] = activityService.open.mock.calls;
      expect(opened).toEqual({ id: expect.any(String), ...failedLeaseActivityOf({ userId: wallet.userId, leases: [lease] }, undecided) });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new ReconcileLeaseCreate({ userId: wallet.userId, owner: wallet.address, leases: [lease], activityId: opened.id }),
        reconcileLeaseCreateOptionsFor(opened.id, new Date("2026-01-01T00:00:00.000Z"))
      );
      expect(activityService.record).not.toHaveBeenCalled();
    });

    it("still answers with the failure of a lease left undecided when it cannot be recorded", async () => {
      const undecided = new TxOutcomeUnknownError("ABCDEF");
      const recordFailure = new Error("connection reset");
      const { service, signerService, activityService, logger, wallet } = setup();
      signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(undecided);
      activityService.open.mockRejectedValue(recordFailure);
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createLeasesAndSendManifest({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).rejects.toBe(undecided);

      expect(logger.error).toHaveBeenCalledWith({ event: "UNDECIDED_LEASE_RECORD_FAILED", userId: wallet.userId, dseq: "100", error: recordFailure });
    });
  });

  describe("createLeasesInBackground", () => {
    it("checks every refusal, then queues the leases and opens their pending activity in one transaction", async () => {
      const { service, signerService, providerService, activityService, jobQueueService, txService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      activityService.open.mockImplementation(async () => {
        expect(txService.transaction).toHaveBeenCalledTimes(1);
      });

      const queued = await service.createLeasesInBackground({ leases: [lease], manifest: MANIFEST, userId: wallet.userId });

      expect(providerService.assertReachable).toHaveBeenCalledWith(lease.provider);
      expect(signerService.assertCanBroadcast).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(new CreateLease({ userId: wallet.userId, leases: [lease], activityId: queued!.activityId }), {
        singletonKey: createLeaseKeyFor({ owner: wallet.address, dseq: "100" }),
        ...CREATE_LEASE_RETRY_OPTIONS
      });
      expect(activityService.open).toHaveBeenCalledWith({ id: queued!.activityId, ...pendingLeaseActivityOf({ userId: wallet.userId, leases: [lease] }) });
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("queues a check on what became of the leases in the same transaction, so leases whose job is lost still settle", async () => {
      vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z"), toFake: ["Date"] });
      const { service, jobQueueService, txService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      jobQueueService.enqueue.mockImplementation(async job => {
        expect(txService.transaction).toHaveBeenCalledTimes(1);
        return job instanceof CreateLease ? "create-lease-job-1" : "reconcile-job-1";
      });

      const queued = await service.createLeasesInBackground({ leases: [lease], userId: wallet.userId });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new ReconcileLeaseCreate({
          userId: wallet.userId,
          owner: wallet.address,
          leases: [lease],
          activityId: queued!.activityId,
          createLeaseJobId: "create-lease-job-1"
        }),
        reconcileLeaseCreateOptionsFor(queued!.activityId, new Date("2026-01-01T00:00:00.000Z"))
      );
    });

    it("queues leases an earlier attempt landed, since their manifest is still to be sent", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, jobQueueService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });

      await service.createLeasesInBackground({ leases: [lease], userId: wallet.userId });

      expect(signerService.assertCanBroadcast).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(CreateLease), expect.anything());
    });

    it("queues nothing and opens nothing when a refusal stops the leases", async () => {
      const refusal = createError(402, "Not enough credits");
      const { service, signerService, activityService, jobQueueService, txService, wallet } = setup();
      signerService.assertCanBroadcast.mockRejectedValue(refusal);
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createLeasesInBackground({ leases: [lease], userId: wallet.userId })).rejects.toBe(refusal);

      expect(txService.transaction).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(activityService.open).not.toHaveBeenCalled();
    });

    it("leaves leases spanning more than one deployment to the request, reading nothing", async () => {
      const { service, walletReaderService, jobQueueService, wallet } = setup();
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "200", gseq: 1, oseq: 1, provider: createAkashAddress() }
      ];

      expect(await service.createLeasesInBackground({ leases, userId: wallet.userId })).toBeUndefined();

      expect(walletReaderService.getWalletByUserId).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("leaves a deployment whose manifest only the request can supply to the request, checking nothing further", async () => {
      const { service, leaseManifestService, signerService, jobQueueService, wallet } = setup({ derived: null });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      expect(await service.createLeasesInBackground({ leases: [lease], manifest: MANIFEST, userId: wallet.userId })).toBeUndefined();

      expect(leaseManifestService.deriveFor).toHaveBeenCalledWith({ dseq: "100", userId: wallet.userId });
      expect(signerService.assertCanBroadcast).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("answers a second request for the same leases with the activity already following them, queueing no check", async () => {
      const { service, activityService, jobQueueService, wallet } = setup({ queuedJobId: null });
      const leases = [
        { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() },
        { dseq: "100", gseq: 2, oseq: 1, provider: createAkashAddress() }
      ];
      jobQueueService.findPendingJobData.mockResolvedValue({
        userId: wallet.userId,
        leases: [...leases].reverse(),
        activityId: "in-flight-activity",
        version: 1
      });

      const queued = await service.createLeasesInBackground({ leases, userId: wallet.userId });

      expect(queued).toEqual({ activityId: "in-flight-activity" });
      expect(jobQueueService.findPendingJobData).toHaveBeenCalledWith(CreateLease, createLeaseKeyFor({ owner: wallet.address, dseq: "100" }));
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(activityService.open).not.toHaveBeenCalled();
    });

    it.each([
      { inFlight: "other bids", leasesInFlight: (lease: TestLease) => [{ ...lease, provider: createAkashAddress() }] },
      { inFlight: "the same bids and more", leasesInFlight: (lease: TestLease) => [lease, { ...lease, gseq: 2 }] },
      { inFlight: "nothing any more", leasesInFlight: undefined }
    ])("refuses with 409 when the deployment's leases being created are $inFlight", async ({ leasesInFlight }) => {
      const { service, jobQueueService, wallet } = setup({ queuedJobId: null });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      jobQueueService.findPendingJobData.mockResolvedValue(
        leasesInFlight && { userId: wallet.userId, leases: leasesInFlight(lease), activityId: "in-flight-activity", version: 1 }
      );

      await expect(service.createLeasesInBackground({ leases: [lease], userId: wallet.userId })).rejects.toMatchObject({
        status: 409,
        message: "A lease is already being created for this deployment"
      });
    });
  });

  describe("createQueuedLeases", () => {
    it("creates the leases and sends the manifest derived from the stored definition, recording nothing", async () => {
      const { service, signerService, providerService, leaseManifestService, activityService, wallet } = setup();
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await service.createQueuedLeases({ leases: [lease], userId: wallet.userId });

      expect(leaseManifestService.deriveFor).toHaveBeenCalledWith({ dseq: "100", userId: wallet.userId });
      expect(signerService.assertCanBroadcast).toHaveBeenCalledTimes(1);
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ provider: lease.provider, dseq: "100", manifest: DERIVED_MANIFEST }));
      expect(activityService.record).not.toHaveBeenCalled();
    });

    it("completes leases an earlier attempt landed instead of creating them again", async () => {
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };
      const { service, signerService, providerService, wallet } = setup({ onChain: owner => [leaseOnChain(owner, lease)] });

      await service.createQueuedLeases({ leases: [lease], userId: wallet.userId });

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(signerService.followUpLandedLeases).toHaveBeenCalledWith(wallet, [lease]);
      expect(providerService.sendManifest).toHaveBeenCalledTimes(1);
    });

    it("broadcasts nothing when the stored definition no longer yields a manifest, since no request manifest is there to fall back on", async () => {
      const { service, signerService, activityService, wallet } = setup({ derived: null });
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createQueuedLeases({ leases: [lease], userId: wallet.userId })).rejects.toMatchObject({ status: 422 });

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(activityService.record).not.toHaveBeenCalled();
    });

    it("records nothing for a failure, which the job settles", async () => {
      const failure = new TxOutcomeUnknownError("ABCDEF");
      const { service, signerService, activityService, jobQueueService, wallet } = setup();
      signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(failure);
      const lease = { dseq: "100", gseq: 1, oseq: 1, provider: createAkashAddress() };

      await expect(service.createQueuedLeases({ leases: [lease], userId: wallet.userId })).rejects.toBe(failure);

      expect(activityService.record).not.toHaveBeenCalled();
      expect(activityService.open).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  type TestLease = { dseq: string; gseq: number; oseq: number; provider: string };

  type Failures = {
    bids: Bid["bid"]["state"][];
    providerService: MockProxy<ProviderService>;
    signerService: MockProxy<ManagedSignerService>;
  };

  function bidFor(owner: string, lease: TestLease, state: Bid["bid"]["state"], bseq = 1): Bid {
    const bid = createBid({ owner, ...lease, bseq });
    bid.bid.state = state;
    return bid;
  }

  function leaseOnChain(owner: string, lease: TestLease, state = "active"): RpcLease {
    return createLeaseApiResponse({ owner, ...lease, state });
  }

  function setup(
    input: {
      wallet?: WalletInitialized;
      derived?: string | null;
      bids?: (owner: string) => Bid[];
      onChain?: (owner: string) => RpcLease[];
      queuedJobId?: string | null;
    } = {}
  ) {
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
    leaseHttpService.list.mockImplementation(async ({ owner, dseq }) => {
      const leases = (input.onChain?.(owner) ?? []).filter(({ lease }) => lease.id.dseq === dseq);
      return { leases, pagination: { next_key: null, total: String(leases.length) } };
    });
    providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "jwt-token" });
    deploymentReaderService.findByWalletAndDseqWithoutProviderStatus.mockResolvedValue(deployment);

    const activityService = mock<ActivityService>();
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue(input.queuedJobId === undefined ? "create-lease-job-1" : input.queuedJobId);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => await cb());

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
      activityService,
      jobQueueService,
      txService,
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
      activityService,
      jobQueueService,
      txService,
      logger,
      wallet,
      deployment
    };
  }
});
