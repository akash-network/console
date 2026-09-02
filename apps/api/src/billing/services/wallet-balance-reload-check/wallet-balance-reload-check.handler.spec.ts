import { faker } from "@faker-js/faker";
import { addMilliseconds, millisecondsInHour, millisecondsInMinute } from "date-fns";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { usdToCents } from "@src/billing/lib/currency/currency";
import type { WalletSettingRepository } from "@src/billing/repositories";
import type { AutoReloadPauseService } from "@src/billing/services/auto-reload-pause/auto-reload-pause.service";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import type { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { JobMeta } from "@src/core";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import type { JobPayload } from "../../../core";
import { WalletBalanceReloadCheckHandler } from "./wallet-balance-reload-check.handler";
import type { WalletBalanceReloadCheckInstrumentationService } from "./wallet-balance-reload-check-instrumentation.service";

import { generateMergedPaymentMethod as generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(WalletBalanceReloadCheckHandler.name, () => {
  describe("handle", () => {
    it("triggers reload when balance is below 25% of cost", async () => {
      // Given: balance = $10, costUntilTargetDate = $50
      // Expected: 25% threshold = $12.50, balance ($10) < threshold → reload
      // Expected: reload amount = max($50 - $10, $20) = $40
      // Expected: calculates cost for 7 days, schedules next check in 1 day
      const balance = 10.0;
      const costUntilTargetDateInDenom = 50_000_000; // 50 USD in udenom
      const costUntilTargetDateInFiat = 50.0;
      const expectedReloadAmount = 40.0; // max(50 - 10, 20) = 40

      const { handler, drainingDeploymentService, stripeTransactionService, instrumentationService, walletReloadJobService, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      // Verify calculateAllDeploymentCostUntilDate is called with 7 days
      const millisecondsInDay = 24 * millisecondsInHour;
      const expectedReloadDate = addMilliseconds(new Date(), 7 * millisecondsInDay);
      expect(drainingDeploymentService.calculateAllDeploymentCostUntilDate).toHaveBeenCalledWith(expect.any(String), expect.any(Date));
      const calculateCall = drainingDeploymentService.calculateAllDeploymentCostUntilDate.mock.calls[0];
      const reloadTargetDate = calculateCall[1] as Date;
      expect(reloadTargetDate.getTime()).toBeCloseTo(expectedReloadDate.getTime(), -3);

      // Verify next check is scheduled for 1 day
      const expectedNextCheckDate = addMilliseconds(new Date(), millisecondsInDay);
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          userId: expect.any(String)
        }),
        expect.objectContaining({
          startAfter: expect.any(String),
          withCleanup: true
        })
      );
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      const scheduledDate = new Date(scheduleCall[1]?.startAfter as string);
      expect(scheduledDate.getTime()).toBeCloseTo(expectedNextCheckDate.getTime(), -3);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith({
        userId: expect.any(String),
        customer: expect.any(String),
        payment_method: expect.any(String),
        amount: expectedReloadAmount,
        confirm: true,
        metadata: { auto_recharge: "true" },
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`,
        onAmountMismatch: "tolerate"
      });
      expect(instrumentationService.recordReloadTriggered).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "prediction",
          amount: expectedReloadAmount,
          projectedCost: costUntilTargetDateInFiat,
          logContext: expect.objectContaining({
            walletAddress: expect.any(String),
            balance,
            costUntilTargetDateInFiat
          })
        })
      );
    });

    it("triggers reload with minimum amount when needed amount is below minimum", async () => {
      // Given: balance = $4, costUntilTargetDate = $20
      // Expected: 25% threshold = $5, balance ($4) < threshold → reload
      // Expected: reload amount = max($20 - $4, $20) = $20 (minimum)
      const balance = 4.0;
      const costUntilTargetDateInDenom = 20_000_000; // 20 USD in udenom
      const costUntilTargetDateInFiat = 20.0;
      const expectedReloadAmount = 20.0; // max(20 - 4, 20) = 20

      const { handler, stripeTransactionService, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith({
        userId: expect.any(String),
        customer: expect.any(String),
        payment_method: expect.any(String),
        amount: expectedReloadAmount,
        confirm: true,
        metadata: { auto_recharge: "true" },
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`,
        onAmountMismatch: "tolerate"
      });
    });

    it("does not trigger reload when balance equals 25% of cost", async () => {
      // Given: balance = $12.50, costUntilTargetDate = $50
      // Expected: 25% threshold = $12.50, balance ($12.50) >= threshold → no reload
      const balance = 12.5;
      const costUntilTargetDateInDenom = 50_000_000;
      const costUntilTargetDateInFiat = 50.0;

      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "sufficient_balance",
          projectedCost: costUntilTargetDateInFiat,
          logContext: expect.objectContaining({
            walletAddress: expect.any(String),
            balance,
            costUntilTargetDateInFiat
          })
        })
      );
    });

    it("does not trigger reload when balance is above 25% of cost", async () => {
      // Given: balance = $50, costUntilTargetDate = $50
      // Expected: 25% threshold = $12.50, balance ($50) >= threshold → no reload
      const balance = 50.0;
      const costUntilTargetDateInDenom = 50_000_000;
      const costUntilTargetDateInFiat = 50.0;

      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "sufficient_balance",
          projectedCost: costUntilTargetDateInFiat,
          logContext: expect.objectContaining({
            walletAddress: expect.any(String),
            balance,
            costUntilTargetDateInFiat
          })
        })
      );
    });

    it("skips reload when the projected cost is zero", async () => {
      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        balance: 10.0,
        weeklyCostInDenom: 0,
        weeklyCostInFiat: 0
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(expect.objectContaining({ reason: "zero_cost" }));
    });

    it("schedules next check", async () => {
      const balance = 50.0;
      const weeklyCostInDenom = 50_000_000;
      const weeklyCostInFiat = 50.0;

      const { handler, walletReloadJobService, walletSetting, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom,
        weeklyCostInFiat
      });

      await handler.handle(job, jobMeta);

      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledWith(
        expect.objectContaining({
          id: walletSetting.id,
          userId: job.userId
        }),
        expect.objectContaining({
          startAfter: expect.any(String),
          withCleanup: true
        })
      );
    });

    it("claims the charge window with the configured cooldown before charging", async () => {
      const { handler, walletSettingRepository, stripeTransactionService, walletSetting, job, jobMeta } = setup({
        balance: 10.0,
        weeklyCostInDenom: 50_000_000,
        weeklyCostInFiat: 50.0,
        chargeCooldownMinutes: 30
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.claimForCharge).toHaveBeenCalledWith(walletSetting.id, 30);
      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 40 }));
    });

    it("skips without charging when another charge happened within the cooldown", async () => {
      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        balance: 10.0,
        weeklyCostInDenom: 50_000_000,
        weeklyCostInFiat: 50.0,
        chargeClaimWon: false
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "prediction",
          reason: "charge_rate_limited",
          projectedCost: 50,
          logContext: expect.objectContaining({ balance: 10, nextCheckAt: expect.any(Date) })
        })
      );
    });

    it("defers the next check to the window reopen when rate limited", async () => {
      const cooldownMinutes = 60;
      const { handler, walletReloadJobService, job, jobMeta } = setup({
        balance: 10.0,
        weeklyCostInDenom: 50_000_000,
        weeklyCostInFiat: 50.0,
        chargeClaimWon: false,
        secondsUntilWindowReopen: cooldownMinutes * 60,
        chargeCooldownMinutes: cooldownMinutes
      });

      await handler.handle(job, jobMeta);

      const expectedReopenDate = addMilliseconds(new Date(), (cooldownMinutes + 1) * millisecondsInMinute);
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      expect(scheduleCall[1]).toEqual(expect.objectContaining({ withCleanup: true }));
      const scheduledDate = new Date(scheduleCall[1]?.startAfter as string);
      expect(scheduledDate.getTime()).toBeCloseTo(expectedReopenDate.getTime(), -3);
    });

    it("defers the retry after a failed charge instead of charging again", async () => {
      const error = new Error("Your card was declined");
      const { handler, walletSettingRepository, stripeTransactionService, walletReloadJobService, job, jobMeta } = setup({
        balance: 10.0,
        weeklyCostInDenom: 50_000_000,
        weeklyCostInFiat: 50.0
      });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      walletSettingRepository.claimForCharge.mockResolvedValue({ won: false, secondsUntilWindowReopen: 3540 });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledTimes(1);
    });

    it("records reload failure and throws when payment intent fails", async () => {
      const balance = 10.0;
      const costUntilTargetDateInDenom = 50_000_000;
      const costUntilTargetDateInFiat = 50.0;
      const error = new Error("Payment failed");

      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom: costUntilTargetDateInDenom,
        weeklyCostInFiat: costUntilTargetDateInFiat
      });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(instrumentationService.recordReloadFailed).toHaveBeenCalledWith({
        mode: "prediction",
        error,
        logContext: expect.objectContaining({
          walletAddress: expect.any(String),
          balance,
          costUntilTargetDateInFiat
        })
      });
    });

    it("logs error and throws when scheduling next check fails", async () => {
      const balance = 50.0;
      const weeklyCostInDenom = 50_000_000;
      const weeklyCostInFiat = 50.0;
      const error = new Error("Failed to schedule");

      const { handler, walletReloadJobService, instrumentationService, job, jobMeta } = setup({
        balance,
        weeklyCostInDenom,
        weeklyCostInFiat
      });
      walletReloadJobService.scheduleForWalletSetting.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(instrumentationService.recordSchedulingError).toHaveBeenCalledWith(expect.any(String), error);
    });

    it("logs validation error when wallet setting not found", async () => {
      const { handler, walletSettingRepository, instrumentationService, job, jobMeta } = setup({
        walletSettingNotFound: true
      });

      await handler.handle(job, jobMeta);

      expect(instrumentationService.recordValidationError).toHaveBeenCalledWith(
        "WALLET_SETTING_NOT_FOUND",
        {
          event: "WALLET_SETTING_NOT_FOUND",
          message: "Wallet setting not found. Skipping wallet balance reload check."
        },
        job.userId
      );
      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
    });

    it("logs validation error when auto reload is disabled", async () => {
      const { handler, walletSettingRepository, instrumentationService, job, jobMeta } = setup({
        autoReloadEnabled: false
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(instrumentationService.recordValidationError).toHaveBeenCalledWith(
        "AUTO_RELOAD_DISABLED",
        {
          event: "AUTO_RELOAD_DISABLED",
          message: "Auto reload disabled. Skipping wallet balance reload check."
        },
        job.userId
      );
    });

    it("logs validation error when wallet is not initialized", async () => {
      const { handler, walletSettingRepository, instrumentationService, job, jobMeta } = setup({
        wallet: createUserWallet({ address: null })
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(instrumentationService.recordValidationError).toHaveBeenCalledWith(
        "WALLET_NOT_INITIALIZED",
        {
          event: "WALLET_NOT_INITIALIZED",
          message: "Wallet not initialized. Skipping wallet balance reload check."
        },
        job.userId
      );
    });

    it("logs validation error when user stripe customer ID is not set", async () => {
      const userWithoutStripe = createUser();
      const userWithNullStripe = { ...userWithoutStripe, stripeCustomerId: null };
      const { handler, walletSettingRepository, instrumentationService, job, jobMeta } = setup({
        user: userWithNullStripe
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.findInternalByUserIdWithRelations).toHaveBeenCalledWith(job.userId);
      expect(instrumentationService.recordValidationError).toHaveBeenCalledWith(
        "USER_STRIPE_CUSTOMER_ID_NOT_SET",
        {
          event: "USER_STRIPE_CUSTOMER_ID_NOT_SET",
          message: "User stripe customer ID not set. Skipping wallet balance reload check."
        },
        job.userId
      );
    });

    it("logs validation error when default payment method cannot be retrieved", async () => {
      const balance = 15.0;

      const { handler, instrumentationService, paymentMethodService, job, jobMeta } = setup({
        balance
      });
      paymentMethodService.getDefaultPaymentMethod.mockResolvedValue(undefined);

      await handler.handle(job, jobMeta);

      expect(instrumentationService.recordValidationError).toHaveBeenCalledWith(
        "DEFAULT_PAYMENT_METHOD_NOT_FOUND",
        {
          event: "DEFAULT_PAYMENT_METHOD_NOT_FOUND",
          message: "Default payment method not found"
        },
        job.userId
      );
    });
  });

  describe("when the wallet setting is in threshold mode", () => {
    it("charges the configured amount when balance is at or below the threshold", async () => {
      const { handler, stripeTransactionService, drainingDeploymentService, instrumentationService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith({
        userId: expect.any(String),
        customer: expect.any(String),
        payment_method: expect.any(String),
        amount: 100,
        confirm: true,
        metadata: { auto_recharge: "true" },
        idempotencyKey: `${WalletBalanceReloadCheck.name}.${jobMeta.id}`,
        onAmountMismatch: "tolerate"
      });
      expect(drainingDeploymentService.calculateAllDeploymentCostUntilDate).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadTriggered).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "threshold",
          amount: 100,
          logContext: expect.objectContaining({ balance: 10, threshold: 20, reloadAmount: 100 })
        })
      );
    });

    it("charges when balance equals the threshold", async () => {
      const { handler, stripeTransactionService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 20,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }));
    });

    it("skips when balance is above the threshold", async () => {
      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 20.01,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "threshold",
          reason: "sufficient_balance",
          logContext: expect.objectContaining({ balance: 20.01, threshold: 20 })
        })
      );
    });

    it("skips the reload when there are no active deployments", async () => {
      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 0,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        activeDeploymentCount: 0
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "no_active_deployments",
          logContext: expect.objectContaining({ balance: 0, threshold: 20 })
        })
      );
    });

    it("charges on a deployment-triggered check without consulting the active-deployment count", async () => {
      const { handler, stripeTransactionService, deploymentRepository, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 0,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        activeDeploymentCount: 0,
        triggeredByDeployment: true
      });

      await handler.handle(job, jobMeta);

      expect(deploymentRepository.countActiveByOwner).not.toHaveBeenCalled();
      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }));
    });

    it("charges when at or below the threshold and there is at least one active deployment", async () => {
      const { handler, stripeTransactionService, deploymentRepository, wallet, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        activeDeploymentCount: 2
      });

      await handler.handle(job, jobMeta);

      expect(deploymentRepository.countActiveByOwner).toHaveBeenCalledWith(wallet.address);
      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }));
    });

    it("clamps the charge to the $25 minimum when the stored amount is below it", async () => {
      const { handler, stripeTransactionService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 5,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 15
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 25 }));
    });

    it("records the failure and rethrows when the payment intent fails", async () => {
      const error = new Error("Payment failed");
      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100
      });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(instrumentationService.recordReloadFailed).toHaveBeenCalledWith({
        mode: "threshold",
        error,
        logContext: expect.objectContaining({ walletAddress: expect.any(String), balance: 10, threshold: 20, reloadAmount: 100 })
      });
    });

    it("claims the charge window with the configured cooldown before charging", async () => {
      const { handler, walletSettingRepository, stripeTransactionService, walletSetting, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        chargeCooldownMinutes: 30
      });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.claimForCharge).toHaveBeenCalledWith(walletSetting.id, 30);
      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 100 }));
    });

    it("skips without charging when another charge happened within the cooldown", async () => {
      const { handler, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        chargeClaimWon: false
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(instrumentationService.recordReloadSkipped).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "threshold",
          reason: "charge_rate_limited",
          logContext: expect.objectContaining({ balance: 10, threshold: 20, nextCheckAt: expect.any(Date) })
        })
      );
    });

    it("defers the next check to the window reopen when rate limited", async () => {
      const cooldownMinutes = 60;
      const { handler, walletReloadJobService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        chargeClaimWon: false,
        secondsUntilWindowReopen: cooldownMinutes * 60,
        chargeCooldownMinutes: cooldownMinutes
      });

      await handler.handle(job, jobMeta);

      const expectedReopenDate = addMilliseconds(new Date(), (cooldownMinutes + 1) * millisecondsInMinute);
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      expect(scheduleCall[1]).toEqual(expect.objectContaining({ withCleanup: true }));
      const scheduledDate = new Date(scheduleCall[1]?.startAfter as string);
      expect(scheduledDate.getTime()).toBeCloseTo(expectedReopenDate.getTime(), -3);
    });

    it("waits out only the cooldown still owed when the claim is lost late in the window", async () => {
      const { handler, walletReloadJobService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        chargeClaimWon: false,
        secondsUntilWindowReopen: 60,
        chargeCooldownMinutes: 60
      });

      await handler.handle(job, jobMeta);

      const expectedReopenDate = addMilliseconds(new Date(), 2 * millisecondsInMinute);
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      const scheduledDate = new Date(scheduleCall[1]?.startAfter as string);
      expect(scheduledDate.getTime()).toBeCloseTo(expectedReopenDate.getTime(), -3);
    });

    it("defers by the buffer alone when no cooldown is still owed", async () => {
      const { handler, walletReloadJobService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        chargeClaimWon: false,
        secondsUntilWindowReopen: 0,
        chargeCooldownMinutes: 60
      });

      await handler.handle(job, jobMeta);

      const expectedReopenDate = addMilliseconds(new Date(), millisecondsInMinute);
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      const scheduledDate = new Date(scheduleCall[1]?.startAfter as string);
      expect(scheduledDate.getTime()).toBeCloseTo(expectedReopenDate.getTime(), -3);
    });

    it("keeps the daily next check when the cooldown reopens later than it", async () => {
      const { handler, walletReloadJobService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100,
        chargeClaimWon: false,
        secondsUntilWindowReopen: 48 * 60 * 60,
        chargeCooldownMinutes: 48 * 60
      });

      await handler.handle(job, jobMeta);

      const expectedNextCheckDate = addMilliseconds(new Date(), 24 * millisecondsInHour);
      const scheduleCall = walletReloadJobService.scheduleForWalletSetting.mock.calls[0];
      const scheduledDate = new Date(scheduleCall[1]?.startAfter as string);
      expect(scheduledDate.getTime()).toBeCloseTo(expectedNextCheckDate.getTime(), -3);
    });

    it("defers the retry after a failed charge instead of charging again", async () => {
      const error = new Error("Your card was declined");
      const { handler, walletSettingRepository, stripeTransactionService, walletReloadJobService, job, jobMeta } = setup({
        autoReloadMode: "threshold",
        balance: 10,
        autoReloadThresholdUsd: 20,
        autoReloadAmountUsd: 100
      });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      walletSettingRepository.claimForCharge.mockResolvedValue({ won: false, secondsUntilWindowReopen: 3540 });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).toHaveBeenCalledTimes(1);
      expect(walletReloadJobService.scheduleForWalletSetting).toHaveBeenCalledTimes(1);
    });
  });

  describe("when a charge is declined", () => {
    it("counts the decline against the pause limit", async () => {
      const error = declinedCardError("generic_decline");
      const { handler, autoReloadPauseService, stripeTransactionService, claim, job, jobMeta } = setup({ balance: 10.0 });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(autoReloadPauseService.recordDecline).toHaveBeenCalledWith({
        claim,
        user: expect.objectContaining({ id: job.userId }),
        decline: { declineCode: "generic_decline", isTerminal: false }
      });
    });

    it("marks a lost or stolen card as terminal so it is never charged again", async () => {
      const { handler, autoReloadPauseService, stripeTransactionService, job, jobMeta } = setup({ balance: 10.0 });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(declinedCardError("stolen_card"));

      await expect(handler.handle(job, jobMeta)).rejects.toThrow();

      expect(autoReloadPauseService.recordDecline).toHaveBeenCalledWith(expect.objectContaining({ decline: { declineCode: "stolen_card", isTerminal: true } }));
    });

    it("labels the failure metric with the decline code", async () => {
      const { handler, instrumentationService, stripeTransactionService, job, jobMeta } = setup({ balance: 10.0 });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(declinedCardError("insufficient_funds"));

      await expect(handler.handle(job, jobMeta)).rejects.toThrow();

      expect(instrumentationService.recordReloadFailed).toHaveBeenCalledWith(expect.objectContaining({ declineCode: "insufficient_funds" }));
    });

    it("keeps the payment error when the decline cannot be recorded", async () => {
      const error = declinedCardError("generic_decline");
      const { handler, autoReloadPauseService, instrumentationService, stripeTransactionService, job, jobMeta } = setup({ balance: 10.0 });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);
      const recordingError = new Error("connection terminated");
      autoReloadPauseService.recordDecline.mockRejectedValue(recordingError);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(instrumentationService.recordDeclineRecordingError).toHaveBeenCalledWith(job.userId, recordingError);
    });

    it("leaves a Stripe outage out of the pause limit", async () => {
      const error = new Error("Stripe is temporarily unavailable");
      const { handler, autoReloadPauseService, stripeTransactionService, job, jobMeta } = setup({ balance: 10.0 });
      stripeTransactionService.createPaymentIntent.mockRejectedValue(error);

      await expect(handler.handle(job, jobMeta)).rejects.toThrow(error);

      expect(autoReloadPauseService.recordDecline).not.toHaveBeenCalled();
    });

    it("spaces the next attempt out by the cooldown owed for the declines so far", async () => {
      const { handler, walletSettingRepository, autoReloadPauseService, walletSetting, job, jobMeta } = setup({
        balance: 10.0,
        autoReloadFailureCount: 3,
        chargeCooldownMinutes: 240
      });

      await handler.handle(job, jobMeta);

      expect(autoReloadPauseService.calculateChargeCooldownMinutes).toHaveBeenCalledWith(3);
      expect(walletSettingRepository.claimForCharge).toHaveBeenCalledWith(walletSetting.id, 240);
    });
  });

  describe("when the wallet is paused after repeated declines", () => {
    it("skips the check without charging", async () => {
      const { handler, walletSettingRepository, stripeTransactionService, instrumentationService, job, jobMeta } = setup({
        balance: 10.0,
        autoReloadPausedAt: new Date()
      });

      await handler.handle(job, jobMeta);

      expect(stripeTransactionService.createPaymentIntent).not.toHaveBeenCalled();
      expect(walletSettingRepository.claimForCharge).not.toHaveBeenCalled();
      expect(instrumentationService.recordValidationError).toHaveBeenCalledWith(
        "AUTO_RELOAD_PAUSED",
        {
          event: "AUTO_RELOAD_PAUSED",
          message: "Auto reload paused after repeated card declines. Skipping wallet balance reload check."
        },
        job.userId
      );
    });

    it("stops rescheduling the check", async () => {
      const { handler, walletReloadJobService, job, jobMeta } = setup({ balance: 10.0, autoReloadPausedAt: new Date() });

      await handler.handle(job, jobMeta);

      expect(walletReloadJobService.scheduleForWalletSetting).not.toHaveBeenCalled();
    });

    it("reports the job as completed rather than failed", async () => {
      const { handler, instrumentationService, job, jobMeta } = setup({ balance: 10.0, autoReloadPausedAt: new Date() });

      await handler.handle(job, jobMeta);

      expect(instrumentationService.recordJobExecution).toHaveBeenCalledWith(expect.any(Number), true, job.userId);
    });
  });

  describe("when a charge goes through", () => {
    it("clears the declines the card had accumulated", async () => {
      const { handler, walletSettingRepository, walletSetting, job, jobMeta } = setup({ balance: 10.0, autoReloadFailureCount: 2 });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.resetChargeFailures).toHaveBeenCalledWith(walletSetting.id);
    });

    it("keeps the declines when the card only asked for authentication", async () => {
      const { handler, walletSettingRepository, job, jobMeta } = setup({ balance: 10.0, autoReloadFailureCount: 2, chargeRequiresAction: true });

      await handler.handle(job, jobMeta);

      expect(walletSettingRepository.resetChargeFailures).not.toHaveBeenCalled();
    });
  });

  function declinedCardError(declineCode: string) {
    return new Stripe.errors.StripeCardError({
      type: "card_error",
      code: "card_declined",
      decline_code: declineCode,
      message: "Your card was declined"
    });
  }

  function setup(input?: {
    balance?: number;
    weeklyCostInDenom?: number;
    weeklyCostInFiat?: number;
    jobId?: string | null;
    walletSettingNotFound?: boolean;
    autoReloadEnabled?: boolean;
    autoReloadThresholdUsd?: number;
    autoReloadAmountUsd?: number;
    autoReloadMode?: "prediction" | "threshold";
    activeDeploymentCount?: number;
    triggeredByDeployment?: boolean;
    chargeClaimWon?: boolean;
    chargeRequiresAction?: boolean;
    secondsUntilWindowReopen?: number;
    chargeCooldownMinutes?: number;
    autoReloadFailureCount?: number;
    autoReloadPausedAt?: Date;
    user?: ReturnType<typeof createUser>;
    wallet?: ReturnType<typeof createUserWallet>;
  }) {
    const user = input?.user ?? createUser();
    const userWithStripe =
      input?.user && input.user.stripeCustomerId === null
        ? user
        : input?.user && input.user.stripeCustomerId
          ? user
          : user.stripeCustomerId
            ? user
            : { ...user, stripeCustomerId: faker.string.uuid() };
    const wallet = input?.wallet ?? createUserWallet({ userId: user.id });
    const walletSetting = generateWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: input?.autoReloadEnabled ?? true,
      autoReloadMode: input?.autoReloadMode ?? "prediction",
      autoReloadFailureCount: input?.autoReloadFailureCount ?? 0,
      autoReloadPausedAt: input?.autoReloadPausedAt ?? null,
      ...(input?.autoReloadThresholdUsd !== undefined && { autoReloadThreshold: usdToCents(input.autoReloadThresholdUsd) }),
      ...(input?.autoReloadAmountUsd !== undefined && { autoReloadAmount: usdToCents(input.autoReloadAmountUsd) })
    });
    const walletSettingWithWallet = {
      ...walletSetting,
      wallet: {
        address: wallet.address!
      },
      user: userWithStripe
    };
    const job: JobPayload<WalletBalanceReloadCheck> = {
      userId: user.id,
      version: 1,
      ...(input?.triggeredByDeployment && { triggeredByDeployment: true })
    };
    const jobMeta: JobMeta = {
      id: faker.string.uuid()
    };

    const walletSettingRepository = mock<WalletSettingRepository>();
    const claim = { id: walletSetting.id, claimedAt: "2026-09-01 12:00:00" };
    walletSettingRepository.claimForCharge.mockResolvedValue(
      input?.chargeClaimWon === false ? { won: false, secondsUntilWindowReopen: input?.secondsUntilWindowReopen ?? 0 } : { won: true, claim }
    );
    const autoReloadPauseService = mock<AutoReloadPauseService>();
    autoReloadPauseService.calculateChargeCooldownMinutes.mockReturnValue(input?.chargeCooldownMinutes ?? 60);
    const balancesService = mock<BalancesService>({
      ensure2floatingDigits: vi.fn().mockImplementation((amount: number) => amount)
    });
    const walletReloadJobService = mock<WalletReloadJobService>();
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.countActiveByOwner.mockResolvedValue(input?.activeDeploymentCount ?? 1);
    const paymentMethodService = mock<PaymentMethodService>();
    const stripeTransactionService = mock<StripeTransactionService>();
    stripeTransactionService.createPaymentIntent.mockResolvedValue({
      success: input?.chargeRequiresAction ? false : true,
      ...(input?.chargeRequiresAction && { requiresAction: true }),
      transactionId: faker.string.uuid(),
      transactionStatus: "succeeded"
    });
    const instrumentationService = mock<WalletBalanceReloadCheckInstrumentationService>({
      recordJobExecution: vi.fn(),
      recordReloadTriggered: vi.fn(),
      recordReloadSkipped: vi.fn(),
      recordReloadFailed: vi.fn(),
      recordValidationError: vi.fn(),
      recordSchedulingError: vi.fn(),
      recordDeclineRecordingError: vi.fn()
    });
    const balance = input?.balance ?? 50.0;
    const weeklyCostInDenom = input?.weeklyCostInDenom ?? 50_000_000;
    const weeklyCostInFiat = input?.weeklyCostInFiat ?? 50.0;
    const jobId = input?.jobId ?? faker.string.uuid();

    if (input?.walletSettingNotFound) {
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(undefined);
    } else {
      walletSettingRepository.findInternalByUserIdWithRelations.mockResolvedValue(walletSettingWithWallet);
    }

    if (!input?.walletSettingNotFound && userWithStripe.stripeCustomerId) {
      balancesService.getDeploymentBalanceInFiat.mockResolvedValue(balance);
      balancesService.toFiatAmount.mockResolvedValue(weeklyCostInFiat);
      drainingDeploymentService.calculateAllDeploymentCostUntilDate.mockResolvedValue(weeklyCostInDenom);
      paymentMethodService.getDefaultPaymentMethod.mockResolvedValue(generatePaymentMethod());
    }

    walletReloadJobService.scheduleForWalletSetting.mockResolvedValue(jobId);

    const handler = new WalletBalanceReloadCheckHandler(
      walletSettingRepository,
      balancesService,
      walletReloadJobService,
      paymentMethodService,
      stripeTransactionService,
      drainingDeploymentService,
      deploymentRepository,
      instrumentationService,
      autoReloadPauseService
    );

    return {
      handler,
      walletSettingRepository,
      balancesService,
      walletReloadJobService,
      drainingDeploymentService,
      deploymentRepository,
      paymentMethodService,
      stripeTransactionService,
      instrumentationService,
      autoReloadPauseService,
      claim,
      walletSetting,
      walletSettingWithWallet,
      wallet,
      job,
      jobMeta
    };
  }
});
