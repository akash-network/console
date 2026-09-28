import { type Bid, BidHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import { HTTPException } from "hono/http-exception";
import createError, { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { type CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

function isOnClosedBid(lease: CreateLeaseRequest["leases"][number], bids: Bid[]): boolean {
  const placementBids = bids.filter(({ bid: { id } }) => id.gseq === lease.gseq && id.oseq === lease.oseq && id.provider === lease.provider);

  return placementBids.length > 0 && placementBids.every(({ bid }) => bid.state !== "open");
}

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
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: "lease-service" });
  }

  /** The `manifest` a request carries is only the fallback for a deployment the console recorded nothing for, no longer the document a provider is sent. */
  @Trace()
  public async createLeasesAndSendManifest({ leases, manifest, userId }: CreateLeaseRequest & { userId: string }): Promise<DeploymentResponse> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const dseq = leases[0].dseq;
    const manifests = await this.#manifestsByDseq(leases, userId, manifest);

    // Leases for all groups are created in one tx, so one existing lease means all exist:
    // skip creation when already on-chain to keep retries idempotent.
    if (!(await this.#hasActiveLease(wallet.address!, dseq))) {
      await this.#refuseLeasesOnClosedBids(wallet.address!, leases);
      await this.#assertProvidersReachable(leases);

      const leaseMessages = leases.map(lease =>
        this.rpcMessageService.getCreateLeaseMsg({
          owner: wallet.address!,
          dseq: lease.dseq,
          gseq: lease.gseq,
          oseq: lease.oseq,
          provider: lease.provider
        })
      );

      await this.signerService.executeDerivedDecodedTxByUserId(wallet.userId, leaseMessages);
    }

    const deployment = await this.deploymentReaderService.findByWalletAndDseqWithoutProviderStatus(wallet, dseq);

    for (const lease of leases) {
      await this.#sendManifest(lease, manifests.get(lease.dseq)!, wallet);
    }

    return deployment;
  }

  /** Refuses only what the chain would, so a bid it does not report is left for the chain to judge. */
  async #refuseLeasesOnClosedBids(owner: string, leases: CreateLeaseRequest["leases"]): Promise<void> {
    const dseqs = [...new Set(leases.map(lease => lease.dseq))];
    const bidsByDseq = new Map(await Promise.all(dseqs.map(async dseq => [dseq, await this.bidHttpService.list(owner, dseq)] as const)));

    if (leases.some(lease => isOnClosedBid(lease, bidsByDseq.get(lease.dseq)!))) {
      throw this.chainErrorService.leaseOnClosedBidError();
    }
  }

  async #assertProvidersReachable(leases: CreateLeaseRequest["leases"]): Promise<void> {
    const providers = [...new Set(leases.map(lease => lease.provider))];
    await Promise.all(providers.map(provider => this.providerService.assertReachable(provider)));
  }

  /** The lease is already on chain here, so a provider's refusal says so; any other failure is ours and propagates as it is. */
  async #sendManifest(lease: CreateLeaseRequest["leases"][number], manifest: string, wallet: { id: number }): Promise<void> {
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

  /** Called before anything is broadcast, so a definition the console cannot re-derive costs no lease on chain and no provider a partial send. */
  async #manifestsByDseq(leases: CreateLeaseRequest["leases"], userId: string, requested: string | undefined): Promise<Map<string, string>> {
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

  async #hasActiveLease(owner: string, dseq: string): Promise<boolean> {
    const { leases } = await this.leaseHttpService.list({ owner, dseq });
    return leases.some(({ lease }) => lease.state !== "closed");
  }
}
