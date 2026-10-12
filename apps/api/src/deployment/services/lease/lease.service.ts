import { type Bid, BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { HTTPException } from "hono/http-exception";
import createError, { isHttpError } from "http-errors";
import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import type { WalletInitialized } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { type DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { type CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor } from "@src/deployment/services/create-lease/create-lease.job";
import { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import { ReconcileLeaseCreate, reconcileLeaseCreateOptionsFor } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.job";
import { createdLeaseActivityOf, failedLeaseActivityOf, pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { isLeaseOn, isSamePlacementSet, type LeasePlacement } from "@src/deployment/utils/lease-placement/lease-placement";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

type Leases = CreateLeaseRequest["leases"];

@singleton()
export class LeaseService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly signerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly walletReaderService: WalletReaderService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly leaseManifestService: LeaseManifestService,
    private readonly bidHttpService: BidHttpService,
    private readonly chainErrorService: ChainErrorService,
    private readonly activityService: ActivityService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: "lease-service" });
  }

  /** The `manifest` a request carries is only the fallback for a deployment the console recorded nothing for, no longer the document a provider is sent. */
  @Trace()
  public async createLeasesAndSendManifest({ leases, manifest, userId }: CreateLeaseRequest & { userId: string }): Promise<DeploymentResponse> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const manifests = await this.#manifestsByDseq(leases, userId, manifest);
    const creation = await this.#planCreation(wallet, leases);

    try {
      await this.#createOrAdoptLeases(wallet, leases, creation);
      const deployment = await this.deploymentReaderService.findByWalletAndDseqWithoutProviderStatus(wallet, leases[0].dseq);
      await this.#sendManifests(wallet, leases, manifests);
      await this.activityService.record(createdLeaseActivityOf({ userId, leases }));

      return deployment;
    } catch (error) {
      await this.#recordFailedLeases({ userId, owner: wallet.address, leases }, error);
      throw error;
    }
  }

  /** Undefined for a request background mode does not take, which the caller then serves as without it: leases on more than one deployment, or a deployment whose manifest only the request carries, since no manifest goes into a job. */
  @Trace()
  public async createLeasesInBackground({ leases, userId }: CreateLeaseRequest & { userId: string }): Promise<{ activityId: string } | undefined> {
    if (new Set(leases.map(lease => lease.dseq)).size !== 1) return undefined;

    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const dseq = leases[0].dseq;
    if (!(await this.leaseManifestService.deriveFor({ dseq, userId }))) return undefined;

    await this.#planCreation(wallet, leases);

    return await this.txService.transaction(async () => {
      const activityId = randomUUID();
      const jobId = await this.jobQueueService.enqueue(new CreateLease({ userId, leases, activityId }), {
        singletonKey: createLeaseKeyFor({ owner: wallet.address, dseq }),
        ...CREATE_LEASE_RETRY_OPTIONS
      });
      if (!jobId) return { activityId: await this.#leaseInFlight(wallet.address, leases) };

      await this.activityService.open({ id: activityId, ...pendingLeaseActivityOf({ userId, leases }) });
      await this.jobQueueService.enqueue(
        new ReconcileLeaseCreate({ userId, owner: wallet.address, leases, activityId, createLeaseJobId: jobId }),
        reconcileLeaseCreateOptionsFor(activityId, new Date())
      );
      return { activityId };
    });
  }

  /** What a queued request's job runs: the manifest comes from what the console stored, which the request already derived once, and the job settles the activity rather than recording one. */
  @Trace()
  public async createQueuedLeases({ leases, userId }: { leases: LeasePlacement[]; userId: string }): Promise<void> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const manifests = await this.#manifestsByDseq(leases, userId, undefined);
    const creation = await this.#planCreation(wallet, leases);

    await this.#createOrAdoptLeases(wallet, leases, creation);
    await this.#sendManifests(wallet, leases, manifests);
  }

  /** Matches each lease on its own placement and provider, since another live lease on the deployment says nothing about the one requested. */
  public async leasesExist(owner: string, leases: LeasePlacement[]): Promise<boolean> {
    const dseqs = [...new Set(leases.map(lease => lease.dseq))];
    const listed = await Promise.all(dseqs.map(dseq => this.leaseHttpService.list({ owner, dseq })));
    const live = listed.flatMap(response => response.leases).filter(({ lease }) => lease.state !== "closed");

    return leases.every(placement => live.some(({ lease }) => isLeaseOn(lease.id, placement)));
  }

  /** Runs every refusal before anything is recorded or queued, and resolves the messages that create the leases, or undefined for leases an earlier attempt landed, which a refusal found on a second read turns out to be. */
  async #planCreation(wallet: WalletInitialized, leases: Leases): Promise<EncodeObject[] | undefined> {
    if (await this.leasesExist(wallet.address, leases)) return undefined;

    const messages = leases.map(({ dseq, gseq, oseq, provider }) =>
      this.rpcMessageService.getCreateLeaseMsg({ owner: wallet.address, dseq, gseq, oseq, provider })
    );

    try {
      await this.#refuseLeasesOnClosedBids(wallet.address, leases);
      await this.#assertProvidersReachable(leases);
      await this.signerService.assertCanBroadcast(wallet.userId, messages);
      return messages;
    } catch (error) {
      await this.#rethrowUnlessFoundOnReread(wallet.address, leases, error);
      return undefined;
    }
  }

  async #createOrAdoptLeases(wallet: WalletInitialized, leases: Leases, creation: EncodeObject[] | undefined): Promise<void> {
    if (!creation) return await this.signerService.followUpLandedLeases(wallet, leases);

    try {
      await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, creation);
    } catch (error) {
      await this.#rethrowUnlessFoundOnReread(wallet.address, leases, error);
      await this.signerService.followUpLandedLeases(wallet, leases);
    }
  }

  /** Reads the leases again after a failure, as a close does, because the read that let this attempt through may come from a node behind an earlier attempt that landed. */
  async #rethrowUnlessFoundOnReread(owner: string, leases: Leases, error: unknown): Promise<void> {
    if (!(await this.#leasesFoundOnReread(owner, leases))) throw error;

    this.#logger.info({ event: "LEASE_FOUND_AFTER_CREATE_FAILED", dseq: leases[0].dseq, error });
  }

  /** A read that fails is no sign the lease landed, so the failure that led here stays the answer. */
  async #leasesFoundOnReread(owner: string, leases: Leases): Promise<boolean> {
    try {
      return await this.leasesExist(owner, leases);
    } catch (error) {
      this.#logger.warn({ event: "LEASE_REREAD_FAILED", dseq: leases[0].dseq, error });
      return false;
    }
  }

  /** Refuses only what the chain would, so a bid it does not report is left for the chain to judge. */
  async #refuseLeasesOnClosedBids(owner: string, leases: Leases): Promise<void> {
    for (const lease of leases) {
      const bids = await this.#placementBids(owner, lease);

      if (bids.length > 0 && bids.every(({ bid }) => bid.state !== "open")) {
        throw this.chainErrorService.leaseOnClosedBidError();
      }
    }
  }

  /** A failed read counts as no bids, since the chain still judges every lease this check lets through. */
  async #placementBids(owner: string, { dseq, gseq, oseq, provider }: Leases[number]): Promise<Bid[]> {
    try {
      return await this.bidHttpService.list(owner, dseq, { gseq, oseq, provider });
    } catch (error) {
      this.#logger.warn({ event: "LEASE_BID_LOOKUP_FAILED", dseq, gseq, oseq, provider, error });
      return [];
    }
  }

  async #assertProvidersReachable(leases: Leases): Promise<void> {
    const providers = [...new Set(leases.map(lease => lease.provider))];
    await Promise.all(providers.map(provider => this.providerService.assertReachable(provider)));
  }

  async #sendManifests(wallet: { id: number }, leases: Leases, manifests: Map<string, string>): Promise<void> {
    for (const lease of leases) {
      await this.#sendManifest(lease, manifests.get(lease.dseq)!, wallet);
    }
  }

  /** The lease is already on chain here, so a provider's refusal says so; any other failure is ours and propagates as it is. */
  async #sendManifest(lease: Leases[number], manifest: string, wallet: { id: number }): Promise<void> {
    try {
      await this.providerService.sendManifest({
        provider: lease.provider,
        dseq: lease.dseq,
        manifest,
        auth: await this.providerService.toProviderAuth({ walletId: wallet.id, provider: lease.provider })
      });
    } catch (error) {
      if (!isHttpError(error)) throw error;

      throw createError(
        error.status,
        `The lease for deployment ${lease.dseq} exists, but provider ${lease.provider} did not receive its manifest. Send this request again to retry, or close the deployment to stop paying for it.`,
        { errorCode: "manifest_not_delivered", data: { dseq: lease.dseq, provider: lease.provider, reason: error.message }, originalError: error }
      );
    }
  }

  /** Joins the lease already queued for the deployment only when it creates the same leases, since a request for other bids would otherwise be answered with an outcome it did not ask for. */
  async #leaseInFlight(owner: string, leases: Leases): Promise<string> {
    const inFlight = await this.jobQueueService.findPendingJobData(CreateLease, createLeaseKeyFor({ owner, dseq: leases[0].dseq }));
    if (!inFlight || !isSamePlacementSet(inFlight.leases, leases)) throw createError(409, "A lease is already being created for this deployment");

    return inFlight.activityId;
  }

  /** An undecided lease opens its pending activity with a later check in one transaction, so it settles once its outcome is known; as with `record`, failing to write either is only logged. */
  async #recordFailedLeases(attempt: { userId: string; owner: string; leases: Leases }, error: unknown): Promise<void> {
    const activity = failedLeaseActivityOf(attempt, error);
    if (activity.status !== "pending") return await this.activityService.record(activity);

    try {
      await this.txService.transaction(async () => {
        const activityId = randomUUID();
        await this.activityService.open({ id: activityId, ...activity });
        await this.jobQueueService.enqueue(new ReconcileLeaseCreate({ ...attempt, activityId }), reconcileLeaseCreateOptionsFor(activityId, new Date()));
      });
    } catch (recordError) {
      this.#logger.error({ event: "UNDECIDED_LEASE_RECORD_FAILED", userId: attempt.userId, dseq: attempt.leases[0].dseq, error: recordError });
    }
  }

  /** Called before anything is broadcast, so a definition the console cannot re-derive costs no lease on chain and no provider a partial send. */
  async #manifestsByDseq(leases: Leases, userId: string, requested: string | undefined): Promise<Map<string, string>> {
    const manifests = new Map<string, string>();

    for (const { dseq } of leases) {
      if (manifests.has(dseq)) continue;

      const derivedManifest = await this.leaseManifestService.deriveFor({ dseq, userId });
      const manifest = derivedManifest ?? requested;
      if (!derivedManifest && requested) {
        this.#logger.warn({ event: "LEASE_MANIFEST_FALLBACK_USED", dseq });
      }

      if (!manifest) {
        throw new HTTPException(422, {
          message: `No manifest to send for lease ${dseq}. Please provide a manifest in the request body or re-create deployment from scratch`
        });
      }

      manifests.set(dseq, manifest);
    }

    return manifests;
  }
}
