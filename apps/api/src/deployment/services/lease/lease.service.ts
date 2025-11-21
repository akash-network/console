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
    private readonly walletReaderService: WalletReaderService
  ) {}

  public async createLeasesAndSendManifest({
    leases,
    manifest,
    certificate,
    userId
  }: CreateLeaseRequest & { userId: string }): Promise<GetDeploymentResponse["data"]> {
    const wallet = await this.walletReaderService.getWalletByUserId(userId);

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

    for (const lease of leases) {
      const commonParams = {
        provider: lease.provider,
        dseq: lease.dseq,
        manifest: manifest
      };
      await this.providerService.sendManifest({
        ...commonParams,
        auth: await this.providerService.toProviderAuth(certificate || { id: wallet.id, derivedFrom: wallet.derivedFrom, provider: lease.provider })
      });
    }

    return await this.deploymentReaderService.findByWalletAndDseq(wallet, leases[0].dseq);
  }
}
