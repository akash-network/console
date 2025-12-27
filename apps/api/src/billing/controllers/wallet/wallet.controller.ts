import type { EncodeObject } from "@cosmjs/proto-signing";
import assert from "http-assert";
import { Lifecycle, scoped } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { GetBalancesResponseOutput } from "@src/billing/http-schemas/balance.schema";
import type { SignTxRequestInput, SignTxResponseOutput } from "@src/billing/http-schemas/tx.schema";
import type { StartTrialRequestInput, WalletListOutputResponse, WalletOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { GetWalletQuery } from "@src/billing/routes/get-wallet-list/get-wallet-list.router";
import { WalletInitializerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeErrorService } from "@src/billing/services/stripe-error/stripe-error.service";
import { GetWalletOptions, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";

@scoped(Lifecycle.ResolutionScoped)
export class WalletController {
  constructor(
    private readonly walletInitializer: WalletInitializerService,
    private readonly signerService: ManagedSignerService,
    private readonly refillService: RefillService,
    private readonly walletReaderService: WalletReaderService,
    private readonly balancesService: BalancesService,
    private readonly authService: AuthService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly stripeService: StripeService,
    private readonly stripeErrorService: StripeErrorService
  ) {}

  @Protected([{ action: "create", subject: "UserWallet" }])
  async create({ data: { userId } }: StartTrialRequestInput): Promise<WalletOutputResponse> {
    const { currentUser } = this.authService;

    assert(currentUser.emailVerified, 400, "Email not verified");
    assert(currentUser.stripeCustomerId, 400, "Stripe customer ID not found");

    const paymentMethods = await this.stripeService.getPaymentMethods(currentUser.id, currentUser.stripeCustomerId, this.authService.ability);
    assert(paymentMethods.length > 0, 400, "You must have a payment method to start a trial.");

    if (this.stripeService.isProduction) {
      const hasDuplicateTrialAccount = await this.stripeService.hasDuplicateTrialAccount(paymentMethods, currentUser.id);
      assert(!hasDuplicateTrialAccount, 400, "This payment method is already associated with another trial account. Please use a different payment method.");
    }

    const latestPaymentMethod = paymentMethods[0];
    try {
      const validationResult = await this.stripeService.validatePaymentMethodForTrial({
        customer: currentUser.stripeCustomerId,
        payment_method: latestPaymentMethod.id,
        userId: currentUser.id
      });

      // If the card requires 3D Secure authentication, return the necessary information
      if (validationResult.requires3DS) {
        return {
          data: {
            id: null,
            userId: currentUser.id,
            address: null,
            creditAmount: 0,
            isTrialing: false,
            createdAt: null,
            requires3DS: true,
            clientSecret: validationResult.clientSecret || null,
            paymentIntentId: validationResult.paymentIntentId || null,
            paymentMethodId: validationResult.paymentMethodId || null
          }
        };
      }
    } catch (error: unknown) {
      if (this.stripeErrorService.isKnownError(error, "payment")) {
        throw this.stripeErrorService.toAppError(error, "payment");
      }

      throw error;
    }

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

  async getBalances(address?: string): Promise<GetBalancesResponseOutput> {
    let currentAddress = address;
    let isOldWallet = false;

    if (!currentAddress) {
      const { currentUser, ability } = this.authService;
      const userWallet = await this.userWalletRepository.accessibleBy(ability, "read").findOneByUserId(currentUser.id);
      assert(userWallet?.address, 404, "UserWallet Not Found");
      currentAddress = userWallet.address;
      isOldWallet = userWallet.isOldWallet ?? false;
    }

    return this.balancesService.getFullBalanceMemoized(currentAddress, isOldWallet);
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
