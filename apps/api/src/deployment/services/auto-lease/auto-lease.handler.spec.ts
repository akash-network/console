import type { Bid } from "@akashnetwork/http-sdk";
import createError from "http-errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { BidService } from "@src/bid/services/bid/bid.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { CreateLogger, JobPayload, JobQueueService } from "@src/core";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import type { LeaseService } from "@src/deployment/services/lease/lease.service";
import {
  ACCESS_REVOKED_ERROR_CODE,
  type MemberDeploymentAccessService
} from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { createdLeaseActivityOf, unmatchedLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import type { ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { AutoLeaseHandler } from "./auto-lease.handler";
import { AutoLease, autoLeaseKeyFor } from "./auto-lease.job";
import { FIRST_BID_CEILING_MS, MATCH_DEADLINE_MS } from "./auto-lease-match";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe(AutoLeaseHandler.name, () => {
  const STARTED_AT = new Date("2026-10-26T10:00:00.000Z");
  const FIRST_ATTEMPT = { id: "job-1", retryCount: 0, retryLimit: 3 };
  const LAST_ATTEMPT = { id: "job-1", retryCount: 3, retryLimit: 3 };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates the logger with the handler context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: AutoLeaseHandler.name });
  });

  it("keeps one queued tick beside the running one, so a tick can queue the next", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("stately");
  });

  it("asks only for the right to sign with the wallet the deploy was made with", () => {
    const { handler, payload } = setup();

    expect(handler.requiresPermission(payload)).toEqual([{ action: "sign", subject: "UserWallet", conditions: { id: payload.walletId } }]);
  });

  it("leaves a match whose activity already settled alone", async () => {
    const { handler, payload, walletReaderService, jobQueueService } = setup({ pending: false });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(walletReaderService.getWalletById).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("checks the next tick 5 s later while no provider has bid", async () => {
    const { handler, payload, jobQueueService, analyticsService, wallet } = setup({ now: new Date(STARTED_AT.getTime() + 10_000) });

    await handler.handle(payload, FIRST_ATTEMPT);

    const { version: _version, ...data } = payload;
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new AutoLease({ ...data, firstBidAt: undefined }), {
      singletonKey: autoLeaseKeyFor({ owner: wallet.address, dseq: payload.dseq }),
      startAfter: new Date(STARTED_AT.getTime() + 15_000),
      retryLimit: 3,
      retryBackoff: true,
      retryDelay: 5,
      retryDelayMax: 30
    });
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("records when the first bids came in, and how many, while it waits for a bidder to answer", async () => {
    const now = new Date(STARTED_AT.getTime() + 20_000);
    const { handler, payload, jobQueueService, analyticsService } = setup({
      now,
      bids: [bidFrom({ provider: "akash1silent" }), bidFrom({ provider: "akash1silent", gseq: 1, oseq: 2 })],
      reachable: []
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(analyticsService.track).toHaveBeenCalledWith(payload.userId, "bids_received", {
      category: "deployments",
      numberOfBids: 2,
      dseq: payload.dseq,
      isAutoDeploy: true
    });
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firstBidAt: now.toISOString() }) }),
      expect.anything()
    );
  });

  it("keeps the time of the first bids once recorded and tracks them only once", async () => {
    const firstBidAt = new Date(STARTED_AT.getTime() + 20_000).toISOString();
    const { handler, payload, jobQueueService, analyticsService } = setup({
      now: new Date(STARTED_AT.getTime() + 30_000),
      firstBidAt,
      bids: [bidFrom({ provider: "akash1silent" })],
      reachable: []
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ firstBidAt }) }), expect.anything());
  });

  it("counts only open bids as bids in", async () => {
    const { handler, payload, analyticsService, providerRepository } = setup({ bids: [bidFrom({ provider: "akash1closed" }, "closed")] });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(analyticsService.track).not.toHaveBeenCalled();
    expect(providerRepository.getProvidersByAddressesWithAttributes).not.toHaveBeenCalled();
  });

  it("leases each placement's first bidder that answered, under the match's activity", async () => {
    const { handler, payload, leaseService, jobQueueService, providerProxyService, wallet } = setup({
      groupCount: 2,
      bids: [bidFrom({ provider: "akash1silent" }), bidFrom({ provider: "akash1first" }), bidFrom({ provider: "akash1other", gseq: 2 })],
      reachable: ["akash1first", "akash1other"]
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(leaseService.queueAutoLeases).toHaveBeenCalledWith(
      { wallet, userId: payload.userId },
      [
        { dseq: payload.dseq, gseq: 1, oseq: 1, provider: "akash1first" },
        { dseq: payload.dseq, gseq: 2, oseq: 1, provider: "akash1other" }
      ],
      payload.activityId
    );
    expect(providerProxyService.request).toHaveBeenCalledWith("/status", {
      providerIdentity: { owner: "akash1first", hostUri: "https://akash1first.example.com" },
      timeout: 5000
    });
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("probes each bidder once however many orders it bid on", async () => {
    const { handler, payload, providerRepository, providerProxyService } = setup({
      groupCount: 2,
      bids: [bidFrom({ provider: "akash1first" }), bidFrom({ provider: "akash1first", gseq: 2 })],
      reachable: ["akash1first"]
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(providerRepository.getProvidersByAddressesWithAttributes).toHaveBeenCalledWith(["akash1first"]);
    expect(providerProxyService.request).toHaveBeenCalledTimes(1);
  });

  it("waits while a placement still has no bidder that answered", async () => {
    const { handler, payload, leaseService, jobQueueService } = setup({
      groupCount: 2,
      bids: [bidFrom({ provider: "akash1first" })],
      reachable: ["akash1first"]
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(leaseService.queueAutoLeases).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(AutoLease), expect.anything());
  });

  it("leases the placements the bids name when the chain cannot list the groups", async () => {
    const { handler, payload, leaseService } = setup({
      groupCount: null,
      bids: [bidFrom({ provider: "akash1first", gseq: 2 })],
      reachable: ["akash1first"]
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(leaseService.queueAutoLeases).toHaveBeenCalledWith(
      expect.anything(),
      [{ dseq: payload.dseq, gseq: 2, oseq: 1, provider: "akash1first" }],
      payload.activityId
    );
  });

  it("closes the deployment and reports it unmatched when no bidder answered 90 s after the first bid", async () => {
    const firstBidAt = new Date(STARTED_AT.getTime() + 20_000);
    const { handler, payload, deploymentWriterService, memberDeploymentAccessService, activityService, analyticsService, jobQueueService, wallet } = setup({
      now: new Date(firstBidAt.getTime() + MATCH_DEADLINE_MS),
      firstBidAt: firstBidAt.toISOString(),
      bids: [bidFrom({ provider: "akash1silent" }), bidFrom({ provider: "akash1silent", oseq: 2 }), bidFrom({ provider: "akash1quiet" })],
      reachable: []
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(deploymentWriterService.close).toHaveBeenCalledWith(wallet, payload.dseq, {
      actingUserId: payload.userId,
      assertMayStillSign: expect.any(Function)
    });
    const closeRequest = deploymentWriterService.close.mock.calls[0][2] as { assertMayStillSign: () => Promise<void> };
    await closeRequest.assertMayStillSign();
    expect(memberDeploymentAccessService.assertMayStillSign).toHaveBeenCalledWith({ userId: payload.userId, walletId: payload.walletId, dseq: payload.dseq });
    expect(activityService.settle).toHaveBeenCalledWith(payload.activityId, unmatchedLeaseActivityOf(payload, "noReachableProvider"));
    expect(analyticsService.track).toHaveBeenCalledWith(payload.userId, "onboarding_match_failed", {
      category: "onboarding",
      reason: "deadline",
      dseq: payload.dseq,
      numberOfBids: 3,
      numberOfCandidates: 2
    });
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("closes the deployment and reports it unmatched when no provider bid within 5 min", async () => {
    const { handler, payload, deploymentWriterService, activityService, analyticsService } = setup({
      now: new Date(STARTED_AT.getTime() + FIRST_BID_CEILING_MS)
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(deploymentWriterService.close).toHaveBeenCalledTimes(1);
    expect(activityService.settle).toHaveBeenCalledWith(payload.activityId, unmatchedLeaseActivityOf(payload, "noBids"));
    expect(analyticsService.track).toHaveBeenCalledWith(payload.userId, "onboarding_match_failed", {
      category: "onboarding",
      reason: "no_bids",
      dseq: payload.dseq,
      numberOfBids: 0,
      numberOfCandidates: 0
    });
  });

  it("still reports the match unmatched when the member may no longer close the deployment", async () => {
    const { handler, payload, deploymentWriterService, activityService } = setup({ now: new Date(STARTED_AT.getTime() + FIRST_BID_CEILING_MS) });
    deploymentWriterService.close.mockRejectedValue(
      createError(403, "You no longer have access to this deployment.", { errorCode: ACCESS_REVOKED_ERROR_CODE })
    );

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(activityService.settle).toHaveBeenCalledWith(payload.activityId, unmatchedLeaseActivityOf(payload, "noBids"));
  });

  it("retries a close that failed for any other reason before reporting the match unmatched", async () => {
    const closeFailure = new Error("tx-signer unavailable");
    const { handler, payload, deploymentWriterService, activityService } = setup({ now: new Date(STARTED_AT.getTime() + FIRST_BID_CEILING_MS) });
    deploymentWriterService.close.mockRejectedValue(closeFailure);

    await expect(handler.handle(payload, FIRST_ATTEMPT)).rejects.toBe(closeFailure);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("reports the match unmatched without a close when the deployment was closed meanwhile", async () => {
    const { handler, payload, deploymentWriterService, activityService, bidService, jobQueueService } = setup({ deploymentState: "closed" });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(activityService.settle).toHaveBeenCalledWith(payload.activityId, unmatchedLeaseActivityOf(payload, "deploymentClosed"));
    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(bidService.listForWallet).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("records the deployment as leased, never closing it, when a provider was picked outside the match", async () => {
    const provider = createAkashAddress();
    const { handler, payload, deploymentWriterService, activityService, bidService } = setup({
      now: new Date(STARTED_AT.getTime() + FIRST_BID_CEILING_MS),
      leases: [
        { id: { dseq: "1000", gseq: 1, oseq: 1, provider }, state: "active" },
        { id: { dseq: "1000", gseq: 2, oseq: 1, provider: "akash1gone" }, state: "closed" }
      ]
    });

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(activityService.settle).toHaveBeenCalledWith(
      payload.activityId,
      createdLeaseActivityOf({ userId: payload.userId, leases: [{ dseq: "1000", gseq: 1, oseq: 1, provider }] })
    );
    expect(deploymentWriterService.close).not.toHaveBeenCalled();
    expect(bidService.listForWallet).not.toHaveBeenCalled();
  });

  it("stops without reading the chain once a lease is being created for the deployment", async () => {
    const { handler, payload, deploymentReaderService, jobQueueService, activityService, wallet } = setup();
    jobQueueService.findPendingJobData.mockImplementation(async (jobType, singletonKey) =>
      jobType === CreateLease && singletonKey === createLeaseKeyFor({ owner: wallet.address, dseq: payload.dseq })
        ? mock<JobPayload<CreateLease>>({ activityId: payload.activityId })
        : undefined
    );

    await handler.handle(payload, FIRST_ATTEMPT);

    expect(deploymentReaderService.findWithGroupSpecsByWalletAndDseq).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("retries a failed tick without settling the match", async () => {
    const readFailure = new Error("rpc unavailable");
    const { handler, payload, deploymentReaderService, activityService } = setup();
    deploymentReaderService.findWithGroupSpecsByWalletAndDseq.mockRejectedValue(readFailure);

    await expect(handler.handle(payload, FIRST_ATTEMPT)).rejects.toBe(readFailure);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it.each([
    ["the last attempt", LAST_ATTEMPT],
    ["a run without retry metadata", undefined]
  ])("reports the match failed when %s fails", async (_label, job) => {
    const readFailure = new Error("rpc unavailable");
    const { handler, payload, deploymentReaderService, activityService } = setup();
    deploymentReaderService.findWithGroupSpecsByWalletAndDseq.mockRejectedValue(readFailure);

    await expect(handler.handle(payload, job)).rejects.toBe(readFailure);

    expect(activityService.settle).toHaveBeenCalledWith(payload.activityId, unmatchedLeaseActivityOf(payload, "failed"));
  });

  function bidFrom(input: { provider: string; gseq?: number; oseq?: number }, state: Bid["bid"]["state"] = "open"): Bid {
    const bid = createBid({ dseq: "1000", gseq: input.gseq ?? 1, oseq: input.oseq ?? 1, provider: input.provider });
    return { ...bid, bid: { ...bid.bid, state } };
  }

  function setup(input?: {
    pending?: boolean;
    now?: Date;
    firstBidAt?: string;
    bids?: Bid[];
    reachable?: string[];
    groupCount?: number | null;
    deploymentState?: string;
    leases?: { id: { dseq: string; gseq: number; oseq: number; provider: string }; state: string }[];
  }) {
    vi.useFakeTimers({ now: input?.now ?? STARTED_AT, toFake: ["Date"] });

    const wallet = createInitializedUserWallet({ organizationId: null });
    const payload: JobPayload<AutoLease> = {
      version: 1,
      userId: wallet.userId,
      walletId: wallet.id,
      owner: wallet.address,
      dseq: "1000",
      activityId: "activity-1",
      startedAt: STARTED_AT.toISOString(),
      ...(input?.firstBidAt && { firstBidAt: input.firstBidAt })
    };

    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletById.mockResolvedValue(wallet);

    const groupCount = input?.groupCount === undefined ? 1 : input.groupCount;
    const deploymentReaderService = mock<DeploymentReaderService>();
    deploymentReaderService.findWithGroupSpecsByWalletAndDseq.mockResolvedValue({
      deployment: mock<DeploymentResponse>({
        deployment: { state: input?.deploymentState ?? "active" },
        leases: (input?.leases ?? []) as DeploymentResponse["leases"]
      }),
      groupSpecs: groupCount === null ? null : Array.from({ length: groupCount }, () => mock())
    });

    const bidService = mock<BidService>();
    bidService.listForWallet.mockResolvedValue(input?.bids ?? []);

    const providerRepository = mock<ProviderRepository>();
    providerRepository.getProvidersByAddressesWithAttributes.mockImplementation(
      async owners => owners.map(owner => ({ owner, hostUri: `https://${owner}.example.com` })) as never
    );

    const reachable = new Set(input?.reachable ?? []);
    const providerProxyService = mock<ProviderProxyService>();
    providerProxyService.request.mockImplementation(async (_url, { providerIdentity }) => {
      if (!reachable.has(providerIdentity.owner)) throw new Error("provider unreachable");
      return {};
    });

    const leaseService = mock<LeaseService>();
    leaseService.queueAutoLeases.mockResolvedValue(true);

    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input?.pending ?? true);

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.findPendingJobData.mockResolvedValue(undefined);

    const deploymentWriterService = mock<DeploymentWriterService>();
    const memberDeploymentAccessService = mock<MemberDeploymentAccessService>();
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new AutoLeaseHandler(
      walletReaderService,
      deploymentReaderService,
      deploymentWriterService,
      bidService,
      providerRepository,
      providerProxyService,
      leaseService,
      activityService,
      jobQueueService,
      memberDeploymentAccessService,
      analyticsService,
      createLogger
    );

    return {
      handler,
      payload,
      wallet,
      walletReaderService,
      deploymentReaderService,
      deploymentWriterService,
      bidService,
      providerRepository,
      providerProxyService,
      leaseService,
      activityService,
      jobQueueService,
      memberDeploymentAccessService,
      analyticsService,
      logger,
      createLogger
    };
  }
});
