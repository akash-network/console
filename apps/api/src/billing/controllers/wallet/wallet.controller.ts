import type { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { Lifecycle, scoped } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import type {
  SignTxRequestInput,
  SignTxResponseOutput,
  StartTrialRequestInput,
  WalletListOutputResponse,
  WalletOutputResponse
} from "@src/billing/http-schemas/wallet.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { GetWalletQuery } from "@src/billing/routes/get-wallet-list/get-wallet-list.router";
import { WalletInitializerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { GetWalletOptions, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import { Memoize } from "@src/caching/helpers";
import { Semaphore } from "@src/core/lib/semaphore.decorator";
import { averageBlockTime } from "@src/utils/constants";

@scoped(Lifecycle.ResolutionScoped)
export class WalletController {
  constructor(
    private readonly walletInitializer: WalletInitializerService,
    private readonly signerService: ManagedSignerService,
    private readonly refillService: RefillService,
    private readonly walletReaderService: WalletReaderService,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @Semaphore()
  @Protected([{ action: "create", subject: "UserWallet" }])
  async create({ data: { userId } }: StartTrialRequestInput): Promise<WalletOutputResponse> {
    return {
      data: await this.walletInitializer.initializeAndGrantTrialLimits(userId)
    };
  }

  @Protected([{ action: "read", subject: "UserWallet" }])
  async getWallets(query: GetWalletQuery): Promise<WalletListOutputResponse> {
    return {
      data: await this.walletReaderService.getWallets(query as GetWalletOptions)
    };
  }

  @Memoize({ ttlInSeconds: averageBlockTime })
  async getBalances(address?: string): Promise<GetBalancesResponseOutput> {
    let currentAddress: string = address;

    if (!currentAddress) {
      const { currentUser, ability } = this.authService;
      const userWallet = await this.userWalletRepository.accessibleBy(ability, "read").findOneByUserId(currentUser.id);
      assert(userWallet, 404, "UserWallet Not Found");
      currentAddress = userWallet.address;
    }

    const [balanceData, deploymentEscrowBalance] = await Promise.all([
      this.balancesService.getFreshLimits({ address: currentAddress }),
      this.balancesService.calculateDeploymentEscrowBalance(currentAddress)
    ]);

    return {
      data: {
        balance: balanceData.deployment,
        deployments: deploymentEscrowBalance,
        total: balanceData.deployment + deploymentEscrowBalance
      }
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async signTx({ data: { userId, messages } }: SignTxRequestInput): Promise<SignTxResponseOutput> {
    return {
      data: await this.signerService.executeEncodedTxByUserId(userId, messages as EncodeObject[])
    };
  }

  async refillWallets() {
    await this.refillService.refillAllFees();
  }
}
