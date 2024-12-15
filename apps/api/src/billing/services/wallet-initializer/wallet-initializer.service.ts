import { Sema } from "async-sema";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletInput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";

@singleton()
export class WalletInitializerService {
  private readonly semaphores = new Map<string, Sema>();

  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  private getSemaphore(userId: string): Sema {
    let semaphore = this.semaphores.get(userId);
    if (!semaphore) {
      semaphore = new Sema(1);
      this.semaphores.set(userId, semaphore);
    }
    return semaphore;
  }

  private async waitForCompletion(userId: string): Promise<void> {
    const semaphore = this.getSemaphore(userId);

    while (!(await semaphore.tryAcquire())) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    semaphore.release();
  }

  async initializeAndGrantTrialLimits(userId: UserWalletInput["userId"]) {
    // Wait for any existing operation to complete
    await this.waitForCompletion(userId);

    const semaphore = this.getSemaphore(userId);
    await semaphore.acquire();

    try {
      let userWallet = await this.userWalletRepository.findOneByUserId(userId);

      if (!userWallet) {
        userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").create({ userId });

        const wallet = await this.walletManager.createAndAuthorizeTrialSpending({ addressIndex: userWallet.id });
        userWallet = await this.userWalletRepository.updateById(
          userWallet.id,
          {
            address: wallet.address,
            deploymentAllowance: wallet.limits.deployment,
            feeAllowance: wallet.limits.fees
          },
          { returning: true }
        );
      }

      return this.userWalletRepository.toPublic(userWallet);
    } finally {
      semaphore.release();
      this.semaphores.delete(userId);
    }
  }

  async initialize(userId: UserWalletInput["userId"]) {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createWallet({ addressIndex: id });
    return await this.userWalletRepository.updateById(
      id,
      {
        address: wallet.address
      },
      { returning: true }
    );
  }
}
