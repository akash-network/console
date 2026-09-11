import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import { HTTPException } from "hono/http-exception";
import { inject, singleton } from "tsyringe";

import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { type CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

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

    const deployment = await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);

    for (const lease of leases) {
      await this.providerService.sendManifest({
        provider: lease.provider,
        dseq: lease.dseq,
        manifest: manifests.get(lease.dseq)!,
        auth: await this.providerService.toProviderAuth({ walletId: wallet.id, provider: lease.provider })
      });
    }

    return deployment;
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
