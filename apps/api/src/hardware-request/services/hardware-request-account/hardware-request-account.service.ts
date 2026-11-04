import { singleton } from "tsyringe";

import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { PaymentMethodRepository } from "@src/billing/repositories/payment-method/payment-method.repository";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

export type HardwareRequestAccountType = "paying" | "trial" | "no_card" | "no_account";

@singleton()
export class HardwareRequestAccountService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  /** A team pays with its own card and wallet, while a personal organization pays with its owner's. */
  async findAccountType({ userId, organizationId }: { userId: string | null; organizationId: string | null }): Promise<HardwareRequestAccountType> {
    if (!userId) return "no_account";

    const organization = organizationId ? await this.organizationRepository.findById(organizationId) : undefined;
    const owner: BillingOwner = organization?.type === "team" ? { organizationId: organization.id } : { userId };

    if ((await this.paymentMethodRepository.unscoped("gpu-request-account-standing").countByOwner(owner)) > 0) return "paying";

    const wallets = this.userWalletRepository.unscoped("gpu-request-account-standing");
    const wallet = "organizationId" in owner ? await wallets.findOneByOrganizationId(owner.organizationId) : await wallets.findOneByUserId(owner.userId);

    return wallet?.isTrialing === false ? "no_card" : "trial";
  }
}
