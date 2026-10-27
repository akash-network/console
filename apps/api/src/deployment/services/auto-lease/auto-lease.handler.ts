import type { Bid } from "@akashnetwork/http-sdk";
import { addSeconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { BidService } from "@src/bid/services/bid/bid.service";
import type { WalletInitialized } from "@src/billing/repositories";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { LeaseService } from "@src/deployment/services/lease/lease.service";
import { isAccessRevoked, MemberDeploymentAccessService } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { createdLeaseActivityOf, unmatchedLeaseActivityOf, type UnmatchedLeaseReason } from "@src/deployment/utils/lease-activity/lease-activity";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { ProviderProxyService } from "@src/provider/services/provider/provider-proxy.service";
import { AUTO_LEASE_RETRY_OPTIONS, AutoLease, autoLeaseKeyFor } from "./auto-lease.job";
import { pickFirstReachableBidders, requiredGseqsOf, unmatchedReasonOf } from "./auto-lease-match";

/** Every tick reads the chain and probes each bidder that has not answered yet, so a slower beat than the browser's only delays a lease by seconds. */
const POLL_INTERVAL_SECONDS = 5;

/** Keeps one unresponsive provider from holding up the rest of a tick. */
const STATUS_PROBE_TIMEOUT_MS = 5000;

type AutoLeaseData = AutoLease["data"];

type MatchCounts = { numberOfBids: number; numberOfCandidates: number };

@singleton()
export class AutoLeaseHandler implements JobHandler<AutoLease> {
  public readonly accepts = AutoLease;

  /** One job per state per deployment, so the self re-enqueue is accepted while this run is active. */
  public readonly policy = "stately";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly bidService: BidService,
    private readonly providerRepository: ProviderRepository,
    private readonly providerProxyService: ProviderProxyService,
    private readonly leaseService: LeaseService,
    private readonly activityService: ActivityService,
    private readonly jobQueueService: JobQueueService,
    private readonly memberDeploymentAccessService: MemberDeploymentAccessService,
    private readonly analyticsService: AnalyticsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AutoLeaseHandler.name });
  }

  requiresPermission({ walletId }: JobPayload<AutoLease>): JobPermissions {
    return [{ action: "sign", subject: "UserWallet", conditions: { id: walletId } }];
  }

  /** A match whose activity settled elsewhere, a manual pick or a lease that landed, is no longer this job's to run. */
  async handle({ version: _version, ...data }: JobPayload<AutoLease>, job?: JobMeta): Promise<void> {
    if (!(await this.activityService.isPending(data.activityId))) return;

    try {
      await this.#matchOrWait(data);
    } catch (error) {
      if (isLastAttempt(job)) await this.#settleUnmatched(data, "failed", { error });
      throw error;
    }
  }

  async #matchOrWait(data: AutoLeaseData): Promise<void> {
    const wallet = await this.walletReaderService.getWalletById(data.walletId);
    if (await this.#isLeaseUnderway(wallet.address, data.dseq)) return;

    const { deployment, groupSpecs } = await this.deploymentReaderService.findWithGroupSpecsByWalletAndDseq(wallet, data.dseq);
    if (deployment.deployment.state === "closed") return await this.#settleUnmatched(data, "deploymentClosed");

    const activeLeases = deployment.leases.filter(lease => lease.state === "active");
    if (activeLeases.length) return await this.#settleLeasedElsewhere(data, activeLeases);

    const openBids = (await this.bidService.listForWallet(wallet, data.dseq)).filter(({ bid }) => bid.state === "open");
    const now = new Date();
    const firstBidAt = data.firstBidAt ?? (openBids.length ? now.toISOString() : undefined);
    if (!data.firstBidAt && firstBidAt) this.#trackFirstBids(data, openBids.length);

    const reachable = await this.#reachableProvidersOf(openBids);
    const leases = pickFirstReachableBidders(requiredGseqsOf(groupSpecs?.length ?? null, openBids), openBids, provider => reachable.has(provider));

    if (leases) {
      const isQueued = await this.leaseService.queueAutoLeases({ wallet, userId: data.userId }, leases, data.activityId);
      this.#logger.info({ event: "AUTO_LEASE_MATCHED", dseq: data.dseq, providers: leases.map(lease => lease.provider), isQueued });
      return;
    }

    const counts = { numberOfBids: openBids.length, numberOfCandidates: new Set(openBids.map(({ bid }) => bid.id.provider)).size };
    const reason = unmatchedReasonOf({ startedAt: new Date(data.startedAt), firstBidAt: firstBidAt ? new Date(firstBidAt) : undefined, now });
    if (reason) return await this.#giveUp(data, wallet, reason, counts);

    await this.jobQueueService.enqueue(new AutoLease({ ...data, firstBidAt }), {
      singletonKey: autoLeaseKeyFor(data),
      startAfter: addSeconds(now, POLL_INTERVAL_SECONDS),
      ...AUTO_LEASE_RETRY_OPTIONS
    });
  }

  async #isLeaseUnderway(owner: string, dseq: string): Promise<boolean> {
    return !!(await this.jobQueueService.findPendingJobData(CreateLease, createLeaseKeyFor({ owner, dseq })));
  }

  async #reachableProvidersOf(openBids: Bid[]): Promise<Set<string>> {
    const owners = [...new Set(openBids.map(({ bid }) => bid.id.provider))];
    if (!owners.length) return new Set();

    const providers = await this.providerRepository.getProvidersByAddressesWithAttributes(owners);
    const probes = await Promise.allSettled(
      providers.map(async ({ owner, hostUri }) => {
        await this.providerProxyService.request("/status", { providerIdentity: { owner, hostUri }, timeout: STATUS_PROBE_TIMEOUT_MS });
        return owner;
      })
    );

    return new Set(probes.flatMap(probe => (probe.status === "fulfilled" ? [probe.value] : [])));
  }

  /** Access the member lost leaves the close to the stale-deployment cleanup, since no retry gives it back. */
  async #giveUp(data: AutoLeaseData, wallet: WalletInitialized, reason: UnmatchedLeaseReason, counts: MatchCounts): Promise<void> {
    const { userId, walletId, dseq } = data;

    try {
      await this.deploymentWriterService.close(wallet, dseq, {
        actingUserId: userId,
        assertMayStillSign: () => this.memberDeploymentAccessService.assertMayStillSign({ userId, walletId, dseq })
      });
    } catch (error) {
      if (!isAccessRevoked(error)) throw error;
    }

    await this.#settleUnmatched(data, reason, counts);
    this.analyticsService.track(userId, "onboarding_match_failed", {
      category: "onboarding",
      reason: reason === "noBids" ? "no_bids" : "deadline",
      dseq,
      ...counts
    });
  }

  async #settleUnmatched({ userId, dseq, activityId }: AutoLeaseData, reason: UnmatchedLeaseReason, details: Partial<MatchCounts> & { error?: unknown } = {}) {
    this.#logger.warn({ event: "AUTO_LEASE_UNMATCHED", dseq, activityId, reason, ...details });
    await this.activityService.settle(activityId, unmatchedLeaseActivityOf({ userId, dseq }, reason));
  }

  /** A provider picked outside the background lease, such as by a lease created during the request, ends the match without the close a missed deadline would bring. */
  async #settleLeasedElsewhere({ userId, dseq, activityId }: AutoLeaseData, activeLeases: DeploymentResponse["leases"]): Promise<void> {
    const leases = activeLeases.map(({ id }) => ({ dseq: id.dseq, gseq: id.gseq, oseq: id.oseq, provider: id.provider }));
    this.#logger.info({ event: "AUTO_LEASE_LEASED_ELSEWHERE", dseq, activityId, providers: leases.map(lease => lease.provider) });
    await this.activityService.settle(activityId, createdLeaseActivityOf({ userId, leases }));
  }

  #trackFirstBids({ userId, dseq }: AutoLeaseData, numberOfBids: number): void {
    this.analyticsService.track(userId, "bids_received", { category: "deployments", numberOfBids, dseq, isAutoDeploy: true });
  }
}

function isLastAttempt(job?: JobMeta): boolean {
  return !job || job.retryCount >= job.retryLimit;
}
