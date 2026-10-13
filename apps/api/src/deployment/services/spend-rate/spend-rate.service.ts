import { singleton } from "tsyringe";

import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { DeploymentSpendRate } from "@src/deployment/http-schemas/deployment.schema";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";

@singleton()
export class SpendRateService {
  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly leaseRepository: LeaseRepository,
    private readonly signerService: ManagedSignerService
  ) {}

  async findByUserId(userId: string): Promise<DeploymentSpendRate[]> {
    const wallet = await this.walletReaderService.getReadableWalletByUserId(userId);
    const livePrices = await this.leaseRepository.sumLivePricesPerDeployment(wallet.address);
    const visible = new Set(
      await this.signerService.filterDeploymentsInProjectScope(
        wallet,
        livePrices.map(({ dseq }) => dseq),
        "read"
      )
    );

    return livePrices.filter(({ dseq }) => visible.has(dseq)).map(({ dseq, denom, price }) => ({ dseq, price: { denom, amount: price.toFixed(18) } }));
  }
}
