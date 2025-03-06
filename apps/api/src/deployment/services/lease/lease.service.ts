import { singleton } from "tsyringe";

import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService, RpcMessageService, Wallet } from "@src/billing/services";
import { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CreateLeaseRequest } from "@src/deployment/http-schemas/lease.schema";
import { ProviderService } from "@src/deployment/services/provider/provider.service";
import { DeploymentService } from "../deployment/deployment.service";

@singleton()
export class LeaseService {
  constructor(
    private readonly signerService: ManagedSignerService,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet,
    private readonly rpcMessageService: RpcMessageService,
    private readonly providerService: ProviderService,
    private readonly deploymentService: DeploymentService
  ) {}

  public async createLeasesAndSendManifest(wallet: UserWalletOutput, input: CreateLeaseRequest): Promise<GetDeploymentResponse["data"]> {
    const leaseMessages = input.leases.map(lease =>
      this.rpcMessageService.getCreateLeaseMsg({
        owner: wallet.address,
        dseq: lease.dseq,
        gseq: lease.gseq,
        oseq: lease.oseq,
        provider: lease.provider
      })
    );

    await this.signerService.executeDecodedTxByUserId(wallet.userId, leaseMessages);

    for (const lease of input.leases) {
      await this.providerService.sendManifest(lease.provider, lease.dseq, lease.gseq, lease.oseq, input.manifest, {
        certPem: input.certificate.certPem,
        keyPem: input.certificate.keyPem
      });
    }

    return await this.deploymentService.findByOwnerAndDseq(wallet.address, input.leases[0].dseq);
  }
}
