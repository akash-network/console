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
import { AutoLease, autoLeaseKeyFor } from "@src/deployment/services/auto-lease/auto-lease.job";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease, createLeaseKeyFor, leaseWalletRefOf } from "@src/deployment/services/create-lease/create-lease.job";
import { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import { isAccessRevoked } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { ReconcileLeaseCreate, reconcileLeaseCreateOptionsFor } from "@src/deployment/services/reconcile-lease-create/reconcile-lease-create.job";
import { createdLeaseActivityOf, failedLeaseActivityOf, pendingLeaseActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { isLeaseOn, isSamePlacementSet, type LeasePlacement } from "@src/deployment/utils/lease-placement/lease-placement";
import {
  type InvalidManifestError,
  isManifestInvalid,
  PROVIDER_MANIFEST_INVALID_ERROR_CODE,
  ProviderService
} from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

type Leases = CreateLeaseRequest["leases"];

export const LEASE_CLOSED_BEFORE_MANIFEST_ERROR_CODE = "lease_closed_before_manifest";

/** The wallet a lease is signed with and the member acting through it, who is not the wallet's user on a team wallet. */
export type LeaseSigner = { wallet: WalletInitialized; userId: string };

/** A queued request's signer, whose access is checked again only once the chain shows no lease an earlier attempt landed, so a landed lease still settles as created. */
export type QueuedLeaseSigner = LeaseSigner & { assertMayStillSign: () => Promise<void> };

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
    const signer = { wallet: await this.walletReaderService.getWalletByUserId(userId), userId };
    const manifests = await this.#manifestsByDseq(leases, signer, manifest);
    const creation = await this.#planCreation(signer.wallet, leases);

    try {
      await this.#createOrAdoptLeases(signer, leases, creation);
      const deployment = await this.deploymentReaderService.findByWalletAndDseqWithoutProviderStatus(signer.wallet, leases[0].dseq);
      await this.#sendManifests(signer.wallet, leases, manifests);
      await this.activityService.record({ ...createdLeaseActivityOf({ userId, leases }), organizationId: signer.wallet.organizationId });

      return deployment;
    } catch (error) {
      await this.#recordFailedLeases(signer, leases, error);
      throw error;
    }
  }

  /** Undefined for a request background mode does not take, which the caller then serves as without it: leases on more than one deployment, or a deployment whose manifest only the request carries, since no manifest goes into a job. */
  @Trace()
  public async createLeasesInBackground({ leases, userId }: CreateLeaseRequest & { userId: string }): Promise<{ activityId: string } | undefined> {
    if (new Set(leases.map(lease => lease.dseq)).size !== 1) return undefined;

    const signer = { wallet: await this.walletReaderService.getWalletByUserId(userId), userId };
    if (!(await this.#deriveManifest(signer, leases[0].dseq))) return undefined;

    await this.#planCreation(signer.wallet, leases);

    return await this.txService.transaction(async () => await this.#queueLeases(signer, leases));
  }

  /** What a queued request's job runs with the wallet the request resolved: the manifest comes from what the console stored, which the request already derived once, and the job settles the activity rather than recording one. */
  @Trace()
  public async createQueuedLeases(signer: QueuedLeaseSigner, leases: LeasePlacement[]): Promise<void> {
    const manifests = await this.#manifestsByDseq(leases, signer, undefined);

    try {
      const creation = await this.#planCreation(signer.wallet, leases, signer.assertMayStillSign);
      await this.#createOrAdoptLeases(signer, leases, creation);
    } catch (error) {
      await this.#rethrowAsClosedBeforeManifestIfLeaseClosed(signer.wallet.address, leases, error);
    }

    await this.#sendManifests(signer.wallet, leases, manifests);
  }

  /** Matches each lease on its own placement and provider, since another live lease on the deployment says nothing about the one requested. */
  public async leasesExist(owner: string, leases: LeasePlacement[]): Promise<boolean> {
    const live = (await this.#listLeases(owner, leases)).filter(lease => lease.state !== "closed");

    return leases.every(placement => live.some(lease => isLeaseOn(lease.id, placement)));
  }

  async #listLeases(owner: string, leases: LeasePlacement[]) {
    const dseqs = [...new Set(leases.map(lease => lease.dseq))];
    const listed = await Promise.all(dseqs.map(dseq => this.leaseHttpService.list({ owner, dseq })));

    return listed.flatMap(response => response.leases).map(({ lease }) => lease);
  }

  /** The request refused closed bids before queueing, so a lease the chain now shows closed was created by an earlier attempt, while a member who lost access keeps that refusal. */
  async #rethrowAsClosedBeforeManifestIfLeaseClosed(owner: string, leases: LeasePlacement[], error: unknown): Promise<never> {
    if (isAccessRevoked(error)) throw error;

    const closed = await this.#placementWithClosedLease(owner, leases);
    if (!closed) throw error;

    throw createError(
      409,
      `The lease for deployment ${closed.dseq} was created, but it closed before provider ${closed.provider} received its manifest. Close the deployment and deploy again.`,
      { errorCode: LEASE_CLOSED_BEFORE_MANIFEST_ERROR_CODE, data: { dseq: closed.dseq, provider: closed.provider }, originalError: error }
    );
  }

  /** A read that fails is no sign the lease closed, so the failure that led here stays the answer. */
  async #placementWithClosedLease(owner: string, leases: LeasePlacement[]): Promise<LeasePlacement | undefined> {
    try {
      const closed = (await this.#listLeases(owner, leases)).filter(lease => lease.state === "closed");
      return leases.find(placement => closed.some(lease => isLeaseOn(lease.id, placement)));
    } catch (error) {
      this.#logger.warn({ event: "CLOSED_LEASE_LOOKUP_FAILED", dseq: leases[0].dseq, error });
      return undefined;
    }
  }

  /** A provider picked by hand while Console is still matching a one-click deploy takes that match's activity over, so the deploy keeps one entry. */
  async #queueLeases(signer: LeaseSigner, leases: Leases): Promise<{ activityId: string }> {
    const { wallet, userId } = signer;
    const match = await this.jobQueueService.findPendingJobData(AutoLease, autoLeaseKeyFor({ owner: wallet.address, dseq: leases[0].dseq }));
    const queued = await this.#queueUnder(signer, leases, match?.activityId);

    return queued ?? { activityId: await this.#leaseInFlight({ owner: wallet.address, userId }, leases) };
  }

  /** False when a lease is already being created for the deployment, which then carries on in place of this one. */
  @Trace()
  public async queueAutoLeases(signer: LeaseSigner, leases: LeasePlacement[], matchActivityId: string): Promise<boolean> {
    return await this.txService.transaction(async () => !!(await this.#queueUnder(signer, leases, matchActivityId)));
  }

  /** A match's activity moves on to the providers it picked rather than opening a second entry for the same deploy. */
  async #queueUnder({ wallet, userId }: LeaseSigner, leases: Leases, matchActivityId?: string): Promise<{ activityId: string } | undefined> {
    const activityId = matchActivityId ?? randomUUID();
    const walletRef = leaseWalletRefOf(wallet);
    const jobId = await this.jobQueueService.enqueue(new CreateLease({ userId, ...walletRef, leases, activityId }), {
      singletonKey: createLeaseKeyFor({ owner: wallet.address, dseq: leases[0].dseq }),
      ...CREATE_LEASE_RETRY_OPTIONS
    });
    if (!jobId) return undefined;

    const pending = pendingLeaseActivityOf({ userId, leases });
    if (matchActivityId) await this.activityService.settle(activityId, pending);
    else await this.activityService.open({ id: activityId, ...pending, organizationId: wallet.organizationId });

    await this.jobQueueService.enqueue(
      new ReconcileLeaseCreate({ userId, ...walletRef, owner: wallet.address, leases, activityId, createLeaseJobId: jobId }),
      reconcileLeaseCreateOptionsFor(activityId, new Date())
    );

    return { activityId };
  }

  /** Runs every refusal before anything is recorded or queued, and resolves the messages that create the leases, or undefined for leases an earlier attempt landed, which a refusal found on a second read turns out to be. */
  async #planCreation(wallet: WalletInitialized, leases: Leases, assertMayStillSign?: () => Promise<void>): Promise<EncodeObject[] | undefined> {
    if (await this.leasesExist(wallet.address, leases)) return undefined;

    const messages = leases.map(({ dseq, gseq, oseq, provider }) =>
      this.rpcMessageService.getCreateLeaseMsg({ owner: wallet.address, dseq, gseq, oseq, provider })
    );

    try {
      await assertMayStillSign?.();
      await this.#refuseLeasesOnClosedBids(wallet.address, leases);
      await this.#assertProvidersReachable(leases);
      await this.signerService.assertCanBroadcastByUserWallet(wallet, messages);
      return messages;
    } catch (error) {
      await this.#rethrowUnlessFoundOnReread(wallet.address, leases, error);
      return undefined;
    }
  }

  async #createOrAdoptLeases({ wallet, userId }: LeaseSigner, leases: Leases, creation: EncodeObject[] | undefined): Promise<void> {
    if (!creation) return await this.signerService.followUpLandedLeases(wallet, leases, userId);

    try {
      await this.signerService.executeDecodedTxByUserWallet(wallet, creation, { actingUserId: userId });
    } catch (error) {
      await this.#rethrowUnlessFoundOnReread(wallet.address, leases, error);
      await this.signerService.followUpLandedLeases(wallet, leases, userId);
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
      if (isManifestInvalid(error)) throw this.#invalidManifestError(lease, error);
      if (!isHttpError(error)) throw error;

      throw createError(
        error.status,
        `The lease for deployment ${lease.dseq} exists, but provider ${lease.provider} did not receive its manifest. Send this request again to retry, or close the deployment to stop paying for it.`,
        { errorCode: "manifest_not_delivered", data: { dseq: lease.dseq, provider: lease.provider, reason: error.message }, originalError: error }
      );
    }
  }

  /** Keeps the provider's code rather than inviting a retry, because a manifest refused as invalid is refused again however often it is sent. */
  #invalidManifestError(lease: Leases[number], error: InvalidManifestError) {
    const { reason } = error.data;

    return createError(
      error.status,
      `The lease for deployment ${lease.dseq} exists, but provider ${lease.provider} refused its manifest (${reason}). Sending it again cannot help: close the deployment to stop paying for it, and deploy again with a corrected SDL.`,
      { errorCode: PROVIDER_MANIFEST_INVALID_ERROR_CODE, data: { dseq: lease.dseq, provider: lease.provider, reason }, originalError: error }
    );
  }

  /** Joins the lease already queued for the deployment only when the same member asked for the same leases, since anyone else would be answered with an outcome they did not ask for and an activity outside their feed. */
  async #leaseInFlight({ owner, userId }: { owner: string; userId: string }, leases: Leases): Promise<string> {
    const inFlight = await this.jobQueueService.findPendingJobData(CreateLease, createLeaseKeyFor({ owner, dseq: leases[0].dseq }));
    if (!inFlight || inFlight.userId !== userId || !isSamePlacementSet(inFlight.leases, leases)) {
      throw createError(409, "A lease is already being created for this deployment");
    }

    return inFlight.activityId;
  }

  /** An undecided lease opens its pending activity with a later check in one transaction, so it settles once its outcome is known; as with `record`, failing to write either is only logged. */
  async #recordFailedLeases({ wallet, userId }: LeaseSigner, leases: Leases, error: unknown): Promise<void> {
    const activity = { ...failedLeaseActivityOf({ userId, leases }, error), organizationId: wallet.organizationId };
    if (activity.status !== "pending") return await this.activityService.record(activity);

    try {
      await this.txService.transaction(async () => {
        const activityId = randomUUID();
        await this.activityService.open({ id: activityId, ...activity });
        await this.jobQueueService.enqueue(
          new ReconcileLeaseCreate({ userId, ...leaseWalletRefOf(wallet), owner: wallet.address, leases, activityId }),
          reconcileLeaseCreateOptionsFor(activityId, new Date())
        );
      });
    } catch (recordError) {
      this.#logger.error({ event: "UNDECIDED_LEASE_RECORD_FAILED", userId, dseq: leases[0].dseq, error: recordError });
    }
  }

  /** Runs before anything is broadcast, sent, recorded or queued, so a definition the console cannot re-derive costs no lease on chain and no provider a partial send. */
  async #manifestsByDseq(leases: Leases, signer: LeaseSigner, requested: string | undefined): Promise<Map<string, string>> {
    const manifests = new Map<string, string>();

    for (const { dseq } of leases) {
      if (manifests.has(dseq)) continue;

      const derivedManifest = await this.#deriveManifest(signer, dseq);
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

  /** Checks the deployment against the caller's projects before reading the definition it is filed under. */
  async #deriveManifest({ wallet, userId }: LeaseSigner, dseq: string): Promise<string | null> {
    const filedUserId = await this.signerService.filedUserIdOf(wallet, userId, dseq);
    return await this.leaseManifestService.deriveFor({ dseq, userId: filedUserId });
  }
}
