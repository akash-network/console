import { Lifecycle, scoped } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { CheckoutSessionRepository, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";

export interface GetWalletOptions {
  userId: string;
  awaitSessionId?: string;
}

@scoped(Lifecycle.ResolutionScoped)
export class WalletReaderService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly authService: AuthService
  ) {}

  async getWallets({ awaitSessionId, ...query }: GetWalletOptions): Promise<UserWalletPublicOutput[]> {
    if (awaitSessionId) {
      await this.checkoutSessionRepository.awaitSessionEnd(awaitSessionId);
    }
    const wallets = await this.userWalletRepository.accessibleBy(this.authService.ability, "read").find(query);

    return wallets.map(wallet => this.userWalletRepository.toPublic(wallet));
  }
}
