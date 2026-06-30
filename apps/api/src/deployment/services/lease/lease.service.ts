import { LeaseHttpService } from "@akashnetwork/http-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import { singleton } from "tsyringe";

import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
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
    private readonly leaseHttpService: LeaseHttpService
  ) {}

  @Trace()
  public async createLeasesAndSendManifest({ leases, manifest, userId }: CreateLeaseRequest & { userId: string }): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);
    const dseq = leases[0].dseq;

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
      const commonParams = {
        provider: lease.provider,
        dseq: lease.dseq,
        manifest: manifest
      };
      await this.providerService.sendManifest({
        ...commonParams,
        auth: await this.providerService.toProviderAuth({ walletId: wallet.id, provider: lease.provider })
      });
    }

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, dseq);
  }

  async #hasActiveLease(owner: string, dseq: string): Promise<boolean> {
    const { leases } = await this.leaseHttpService.list({ owner, dseq });
    return leases.some(({ lease }) => lease.state !== "closed");
  }
}
