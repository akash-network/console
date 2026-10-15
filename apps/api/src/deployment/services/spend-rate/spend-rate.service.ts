import { subject } from "@casl/ability";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentSpendRate } from "@src/deployment/http-schemas/deployment.schema";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";

@singleton()
export class SpendRateService {
  constructor(
    private readonly walletReaderService: WalletReaderService,
    private readonly leaseRepository: LeaseRepository,
    private readonly signerService: ManagedSignerService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly authService: AuthService,
    private readonly executionContextService: ExecutionContextService
  ) {}

  async findByUserId(userId: string): Promise<DeploymentSpendRate[]> {
    const wallet = await this.walletReaderService.getReadableWalletByUserId(userId);
    const livePrices = await this.leaseRepository.sumLivePricesPerDeployment(wallet.address);
    const visible = new Set(
      await this.#keepDeploymentsWithVisibleSpend(
        wallet,
        livePrices.map(({ dseq }) => dseq)
      )
    );

    return livePrices.filter(({ dseq }) => visible.has(dseq)).map(({ dseq, denom, price }) => ({ dseq, price: { denom, amount: price.toFixed(18) } }));
  }

  async findWeeklyCostByUserId(userId: string): Promise<number> {
    const wallet = await this.walletReaderService.findReadableWalletByUserId(userId);

    if (!wallet?.address) {
      return 0;
    }

    const { weeklyCostUsd } = await this.drainingDeploymentService.calculateWeeklyCoverageForAddress(wallet.address, dseqs =>
      this.#keepDeploymentsWithVisibleSpend(wallet, dseqs)
    );

    return weeklyCostUsd;
  }

  /** A billing member reaches no project yet reads the organization's whole spend, so that right is checked before the project filter. */
  async #keepDeploymentsWithVisibleSpend(wallet: UserWalletOutput, dseqs: string[]): Promise<string[]> {
    if (this.#readsOrganizationSpend()) {
      return dseqs;
    }

    return await this.signerService.filterDeploymentsInProjectScope(wallet, dseqs, "read");
  }

  #readsOrganizationSpend(): boolean {
    const organizationContext = this.executionContextService.get("ORGANIZATION_CONTEXT");

    return (
      organizationContext?.mode === "organization" &&
      this.authService.ability.can("read", subject("OrganizationSpend", { organizationId: organizationContext.organizationId }))
    );
  }
}
