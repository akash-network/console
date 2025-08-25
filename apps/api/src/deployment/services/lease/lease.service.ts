import { singleton } from "tsyringe";

import { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService } from "@src/billing/services";
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
    private readonly deploymentReaderService: DeploymentReaderService
  ) {}

  public async createLeasesAndSendManifest(wallet: UserWalletOutput, input: CreateLeaseRequest): Promise<GetDeploymentResponse["data"]> {
    const leaseMessages = input.leases.map(lease =>
      this.rpcMessageService.getCreateLeaseMsg({
        owner: wallet.address!,
        dseq: lease.dseq,
        gseq: lease.gseq,
        oseq: lease.oseq,
        provider: lease.provider
      })
    );

    await this.signerService.executeDecodedTxByUserId(wallet.userId, leaseMessages);

    for (const lease of input.leases) {
      await this.providerService.sendManifest({ provider: lease.provider, dseq: lease.dseq, manifest: input.manifest, walletId: wallet.id });
    }

    return await this.deploymentReaderService.findByOwnerAndDseq(wallet.address!, input.leases[0].dseq);
  }
}
