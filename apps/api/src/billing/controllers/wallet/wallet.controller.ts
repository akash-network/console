import type { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { Lifecycle, scoped } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import type { SignTxRequestInput, SignTxResponseOutput } from "@src/billing/http-schemas/tx.schema";
import type { StartTrialRequestInput, WalletListOutputResponse, WalletOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { GetWalletQuery } from "@src/billing/routes/get-wallet-list/get-wallet-list.router";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { TrialActivationJobService } from "@src/billing/services/trial-activation-job/trial-activation-job.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { GetWalletOptions, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";

@scoped(Lifecycle.ResolutionScoped)
export class WalletController {
  constructor(
    private readonly walletInitializer: WalletInitializerService,
    private readonly trialActivationJobService: TrialActivationJobService,
    private readonly signerService: ManagedSignerService,
    private readonly refillService: RefillService,
    private readonly walletReaderService: WalletReaderService,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly billingConfigService: BillingConfigService,
    private readonly trialValidationService: TrialValidationService
  ) {}

  /**
   * Backward-compat shim for `POST /v1/start-trial`: kept so an older deploy-web can still call it during a staged
   * rollout where the API ships first. Trial provisioning now runs server-side off registration/verification, so this
   * only ensures the wallet exists and (idempotently) enqueues activation, returning the wallet so an old client's
   * cache still fills. New clients don't call it.
   *
   * `ensureWallet` uses the unscoped repository (it also runs from server-side registration with a trusted userId),
   * so ownership is enforced here: the request `userId` must be the caller's own, else another user's wallet data
   * would leak and their provisioning could be triggered.
   */
  @Protected([{ action: "create", subject: "UserWallet" }])
  async create({ data: { userId } }: StartTrialRequestInput): Promise<WalletOutputResponse> {
    assert(userId === this.authService.currentUser.id, 403, "Cannot start a trial for another user");
    const wallet = await this.walletInitializer.ensureWallet(userId);
    await this.trialActivationJobService.schedule(userId);

    const publicWallet = this.userWalletRepository.toPublic(wallet);
    const denom = this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM");
    return { data: { ...publicWallet, denom, topUpMinAmountUsd: this.trialValidationService.getTopUpMinAmountUsd(publicWallet) } };
  }

  @Protected([{ action: "read", subject: "UserWallet" }])
  async getWallets(query: GetWalletQuery): Promise<WalletListOutputResponse> {
    const denom = this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM");
    const wallets = await this.walletReaderService.getWallets(query as GetWalletOptions);

    return {
      data: wallets.map(wallet => ({ ...wallet, denom, topUpMinAmountUsd: this.trialValidationService.getTopUpMinAmountUsd(wallet) }))
    };
  }

  async getBalances(address?: string): Promise<GetBalancesResponseOutput> {
    let currentAddress = address;

    if (!currentAddress) {
      const { currentUser, ability } = this.authService;
      const userWallet = await this.userWalletRepository.accessibleBy(ability, "read").findOneByUserId(currentUser.id);
      assert(userWallet?.address, 404, "UserWallet Not Found");
      currentAddress = userWallet.address;
    }

    return this.balancesService.getFullBalanceMemoized(currentAddress);
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async signTx({ data: { userId, messages } }: SignTxRequestInput): Promise<SignTxResponseOutput> {
    return {
      data: (await this.signerService.executeDerivedEncodedTxByUserId(userId, messages as EncodeObject[])) as SignTxResponseOutput["data"]
    };
  }

  async refillWallets() {
    await this.refillService.refillAllFees();
  }
}
