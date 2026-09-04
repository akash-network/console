import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import { singleton } from "tsyringe";

import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { LeaseManifestService } from "@src/deployment/services/lease-manifest/lease-manifest.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";

@singleton()
export class LeaseService {
  constructor(
    private readonly signerService: ManagedSignerService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly providerService: ProviderService,
    private readonly deploymentReaderService: DeploymentReaderService,
    private readonly walletReaderService: WalletReaderService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly leaseManifestService: LeaseManifestService
  ) {}

  /** The `manifest` a request carries is only the fallback for a deployment the console recorded nothing for, no longer the document a provider is sent. */
  @Trace()
  public async createLeasesAndSendManifest({ leases, manifest, userId }: CreateLeaseRequest & { userId: string }): Promise<DeploymentResponse> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const dseq = leases[0].dseq;
    const derived = await this.#derivedByDseq(leases);

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

    for (const lease of leases) {
      await this.providerService.sendManifest({
        provider: lease.provider,
        dseq: lease.dseq,
        manifest: derived.get(lease.dseq) ?? manifest,
        auth: await this.providerService.toProviderAuth({ walletId: wallet.id, provider: lease.provider })
      });
    }

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
  }

  /** Called before anything is broadcast, so a definition the console cannot re-derive costs no lease on chain. */
  async #derivedByDseq(leases: CreateLeaseRequest["leases"]): Promise<Map<string, string | null>> {
    const derived = new Map<string, string | null>();

    for (const { dseq } of leases) {
      if (!derived.has(dseq)) derived.set(dseq, await this.leaseManifestService.deriveFor({ dseq }));
    }

    return derived;
  }

  async #hasActiveLease(owner: string, dseq: string): Promise<boolean> {
    const { leases } = await this.leaseHttpService.list({ owner, dseq });
    return leases.some(({ lease }) => lease.state !== "closed");
  }
}
