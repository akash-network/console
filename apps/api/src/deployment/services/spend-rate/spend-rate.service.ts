import { singleton } from "tsyringe";

import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { DeploymentSpendRate } from "@src/deployment/http-schemas/deployment.schema";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";

@singleton()
export class SpendRateService {
  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly leaseRepository: LeaseRepository
  ) {}

  async findByUserId(userId: string): Promise<DeploymentSpendRate[]> {
    const { address } = await this.walletReaderService.getWalletByUserId(userId);
    const livePrices = await this.leaseRepository.sumLivePricesPerDeployment(address);

    return livePrices.map(({ dseq, denom, price }) => ({ dseq, price: { denom, amount: price.toFixed(18) } }));
  }
}
