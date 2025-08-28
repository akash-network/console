import { mock } from "jest-mock-extended";

import type { CheckoutSessionRepository, PaymentMethodRepository, StripeCouponRepository, StripeTransactionRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { RefillService } from "@src/billing/services/refill/refill.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { UserRepository } from "@src/user/repositories";
import { StripeWebhookService } from "./stripe-webhook.service";

import { StripeSeeder } from "@test/seeders/stripe.seeder";
import {
  createCheckoutSessionCompletedEvent,
  createCustomerDiscountCreatedEvent,
  createPaymentIntentSucceededEvent,
  createPaymentIntentWithDiscount,
  createPaymentIntentWithoutDiscount,
  createPaymentMethodAttachedEvent,
  createPaymentMethodDetachedEvent
} from "@test/seeders/stripe-webhook-events.seeder";
import { UserSeeder } from "@test/seeders/user.seeder";

describe(StripeWebhookService.name, () => {
  describe("routeStripeEvent", () => {
    it("routes checkout.session.completed event", async () => {
      const { service, stripeService } = setup();
      const mockEvent = createCheckoutSessionCompletedEvent();

      (stripeService.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.routeStripeEvent("test-signature", JSON.stringify(mockEvent));

      expect(service["tryToTopUpWalletForCheckout"]).toHaveBeenCalledWith(mockEvent);
    });

    it("routes payment_intent.succeeded event", async () => {
      const { service, stripeService } = setup();
      const mockEvent = createPaymentIntentSucceededEvent();

      (stripeService.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.routeStripeEvent("test-signature", JSON.stringify(mockEvent));

      expect(service["tryToTopUpWalletFromPaymentIntent"]).toHaveBeenCalledWith(mockEvent);
    });

    it("routes payment_method.attached event", async () => {
      const { service, stripeService } = setup();
      const mockEvent = createPaymentMethodAttachedEvent();

      (stripeService.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.routeStripeEvent("test-signature", JSON.stringify(mockEvent));

      expect(service["handlePaymentMethodAttached"]).toHaveBeenCalledWith(mockEvent);
    });

    it("routes payment_method.detached event", async () => {
      const { service, stripeService } = setup();
      const mockEvent = createPaymentMethodDetachedEvent();

      (stripeService.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.routeStripeEvent("test-signature", JSON.stringify(mockEvent));

      expect(service["handlePaymentMethodDetached"]).toHaveBeenCalledWith(mockEvent);
    });

    it("routes customer.discount.created event", async () => {
      const { service, stripeService } = setup();
      const mockEvent = createCustomerDiscountCreatedEvent();

      (stripeService.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.routeStripeEvent("test-signature", JSON.stringify(mockEvent));

      expect(service["handleCustomerDiscountCreated"]).toHaveBeenCalledWith(mockEvent);
    });

    it("handles unknown event type gracefully", async () => {
      const { service, stripeService } = setup();
      const mockEvent = {
        id: "evt_test",
        object: "event",
        api_version: "2020-08-27",
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 1,
        request: { id: "req_test", idempotency_key: null },
        type: "unknown.event.type",
        data: {
          object: {
            id: "obj_test",
            object: "unknown"
          }
        }
      };

      (stripeService.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent);

      await service.routeStripeEvent("test-signature", JSON.stringify(mockEvent));

      // Should not throw and should not call any handlers
      expect(service["tryToTopUpWalletForCheckout"]).not.toHaveBeenCalled();
      expect(service["tryToTopUpWalletFromPaymentIntent"]).not.toHaveBeenCalled();
      expect(service["handlePaymentMethodAttached"]).not.toHaveBeenCalled();
      expect(service["handlePaymentMethodDetached"]).not.toHaveBeenCalled();
      expect(service["handleCustomerDiscountCreated"]).not.toHaveBeenCalled();
    });

    it("throws error when event processing fails", async () => {
      const { service, stripeService } = setup();

      (stripeService.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      await expect(service.routeStripeEvent("invalid-signature", "invalid-raw-event")).rejects.toThrow("Invalid signature");
    });
  });

  describe("tryToTopUpWalletForCheckout", () => {
    it("tops up wallet when session is found and payment is completed", async () => {
      const { service, checkoutSessionRepository, refillService, stripeService } = setup();
      const mockEvent = createCheckoutSessionCompletedEvent();
      const user = UserSeeder.create();

      checkoutSessionRepository.findOneByAndLock.mockResolvedValue({
        id: "session-cache-id",
        sessionId: mockEvent.data.object.id,
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      (stripeService.checkout.sessions.retrieve as jest.Mock).mockResolvedValue({
        id: mockEvent.data.object.id,
        payment_status: "paid",
        amount_subtotal: 2000
      });

      await service.tryToTopUpWalletForCheckout(mockEvent);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(2000, user.id);
      expect(checkoutSessionRepository.deleteBy).toHaveBeenCalledWith({ sessionId: mockEvent.data.object.id });
    });

    it("logs error when session is not found", async () => {
      const { service, checkoutSessionRepository } = setup();
      const mockEvent = createCheckoutSessionCompletedEvent();

      checkoutSessionRepository.findOneByAndLock.mockResolvedValue(undefined);

      await service.tryToTopUpWalletForCheckout(mockEvent);

      expect(checkoutSessionRepository.findOneByAndLock).toHaveBeenCalledWith({ sessionId: mockEvent.data.object.id });
    });
  });

  describe("tryToTopUpWalletFromPaymentIntent", () => {
    it("processes payment intent successfully with discount", async () => {
      const { service, userRepository, refillService, stripeService, stripeTransactionRepository } = setup();
      const mockEvent = createPaymentIntentWithDiscount(3000);
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });

      userRepository.findOneBy.mockResolvedValue(user);
      stripeService.consumeActiveDiscount.mockResolvedValue(true);
      stripeTransactionRepository.findByStripeTransactionId.mockResolvedValue(undefined);

      await service.tryToTopUpWalletFromPaymentIntent(mockEvent);

      expect(stripeService.consumeActiveDiscount).toHaveBeenCalledWith("cus_test");
      expect(refillService.topUpWallet).toHaveBeenCalledWith(2000, user.id); // Uses actual charged amount
    });

    it("processes payment intent without discount", async () => {
      const { service, userRepository, refillService, stripeTransactionRepository } = setup();
      const mockEvent = createPaymentIntentWithoutDiscount();
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });

      userRepository.findOneBy.mockResolvedValue(user);
      stripeTransactionRepository.findByStripeTransactionId.mockResolvedValue(undefined);

      await service.tryToTopUpWalletFromPaymentIntent(mockEvent);

      expect(refillService.topUpWallet).toHaveBeenCalledWith(2000, user.id);
    });

    it("logs error when customer ID is missing", async () => {
      const { service, refillService } = setup();
      const mockEvent = createPaymentIntentSucceededEvent({
        data: {
          object: {
            ...createPaymentIntentSucceededEvent().data.object,
            customer: null
          }
        }
      });

      await service.tryToTopUpWalletFromPaymentIntent(mockEvent);

      expect(service["recordPaymentIntentTransaction"]).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("logs error when user is not found", async () => {
      const { service, userRepository, refillService } = setup();
      const mockEvent = createPaymentIntentSucceededEvent();

      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.tryToTopUpWalletFromPaymentIntent(mockEvent);

      expect(service["recordPaymentIntentTransaction"]).not.toHaveBeenCalled();
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });

    it("skips wallet top-up when transaction already exists (idempotency)", async () => {
      const { service, userRepository, refillService, stripeTransactionRepository } = setup();
      const mockEvent = createPaymentIntentSucceededEvent();
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });
      const existingTransaction = {
        id: "existing-transaction",
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCreatedAt: new Date(),
        stripeTransactionId: mockEvent.data.object.id,
        amount: "2000",
        currency: mockEvent.data.object.currency,
        status: mockEvent.data.object.status,
        description: mockEvent.data.object.description,
        metadata: mockEvent.data.object.metadata
      };

      userRepository.findOneBy.mockResolvedValue(user);
      stripeTransactionRepository.findByStripeTransactionId.mockResolvedValue(existingTransaction);

      await service.tryToTopUpWalletFromPaymentIntent(mockEvent);

      expect(service["recordPaymentIntentTransaction"]).toHaveBeenCalledWith(mockEvent.data.object, user.id);
      expect(refillService.topUpWallet).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentMethodAttached", () => {
    it("creates payment method record successfully", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();
      const mockEvent = createPaymentMethodAttachedEvent();
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });

      userRepository.findOneBy.mockResolvedValue(user);

      await service.handlePaymentMethodAttached(mockEvent);

      expect(paymentMethodRepository.create).toHaveBeenCalledWith({
        userId: user.id,
        fingerprint: "test-fingerprint",
        paymentMethodId: "pm_test"
      });
    });

    it("logs error when customer ID is missing", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockEvent = createPaymentMethodAttachedEvent({
        data: {
          object: {
            ...createPaymentMethodAttachedEvent().data.object,
            customer: null
          }
        }
      });

      await service.handlePaymentMethodAttached(mockEvent);

      expect(paymentMethodRepository.create).not.toHaveBeenCalled();
    });

    it("logs error when user is not found", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();
      const mockEvent = createPaymentMethodAttachedEvent();

      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.handlePaymentMethodAttached(mockEvent);

      expect(paymentMethodRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("handlePaymentMethodDetached", () => {
    it("deletes payment method record successfully", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();
      const mockEvent = createPaymentMethodDetachedEvent();
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });

      userRepository.findOneBy.mockResolvedValue(user);

      await service.handlePaymentMethodDetached(mockEvent);

      expect(paymentMethodRepository.deleteByFingerprint).toHaveBeenCalledWith("test-fingerprint", "pm_test", user.id);
    });

    it("handles missing customer ID gracefully", async () => {
      const { service, paymentMethodRepository } = setup();
      const mockEvent = createPaymentMethodDetachedEvent({
        data: {
          object: {
            ...createPaymentMethodDetachedEvent().data.object,
            customer: null
          },
          previous_attributes: { customer: null }
        }
      });

      await service.handlePaymentMethodDetached(mockEvent);

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
    });

    it("handles user not found gracefully", async () => {
      const { service, userRepository, paymentMethodRepository } = setup();
      const mockEvent = createPaymentMethodDetachedEvent();

      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.handlePaymentMethodDetached(mockEvent);

      expect(paymentMethodRepository.deleteByFingerprint).not.toHaveBeenCalled();
    });
  });

  describe("handleCustomerDiscountCreated", () => {
    it("creates coupon record successfully", async () => {
      const { service, userRepository, stripeCouponRepository } = setup();
      const mockEvent = createCustomerDiscountCreatedEvent();
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });

      userRepository.findOneBy.mockResolvedValue(user);
      stripeCouponRepository.findByStripeCouponId.mockResolvedValue(undefined);

      await service.handleCustomerDiscountCreated(mockEvent);

      expect(stripeCouponRepository.create).toHaveBeenCalledWith({
        stripeCouponId: "di_test",
        userId: user.id,
        couponCode: "coupon_test",
        discountAmount: null,
        stripeCreatedAt: expect.any(Date)
      });
    });

    it("logs error when customer ID is missing", async () => {
      const { service, stripeCouponRepository } = setup();
      const mockEvent = createCustomerDiscountCreatedEvent({
        data: {
          object: {
            ...createCustomerDiscountCreatedEvent().data.object,
            customer: null
          }
        }
      });

      await service.handleCustomerDiscountCreated(mockEvent);

      expect(stripeCouponRepository.create).not.toHaveBeenCalled();
    });

    it("logs error when user is not found", async () => {
      const { service, userRepository, stripeCouponRepository } = setup();
      const mockEvent = createCustomerDiscountCreatedEvent();

      userRepository.findOneBy.mockResolvedValue(undefined);

      await service.handleCustomerDiscountCreated(mockEvent);

      expect(stripeCouponRepository.create).not.toHaveBeenCalled();
    });

    it("skips creation when coupon already exists", async () => {
      const { service, userRepository, stripeCouponRepository } = setup();
      const mockEvent = createCustomerDiscountCreatedEvent();
      const user = UserSeeder.create({ stripeCustomerId: "cus_test" });
      const existingCoupon = {
        id: "existing-coupon-id",
        userId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCreatedAt: new Date(),
        stripeCouponId: "di_test",
        couponCode: "coupon_test",
        discountAmount: null
      };

      userRepository.findOneBy.mockResolvedValue(user);
      stripeCouponRepository.findByStripeCouponId.mockResolvedValue(existingCoupon);

      await service.handleCustomerDiscountCreated(mockEvent);

      expect(stripeCouponRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("recordPaymentIntentTransaction", () => {
    it("creates transaction record when it doesn't exist", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntent = StripeSeeder.create().paymentIntent;
      const userId = "user-123";

      stripeTransactionRepository.findByStripeTransactionId.mockResolvedValue(undefined);

      const result = await service["recordPaymentIntentTransaction"](paymentIntent, userId);

      expect(result).toBe(true);
      expect(stripeTransactionRepository.create).toHaveBeenCalledWith({
        stripeTransactionId: paymentIntent.id,
        userId,
        amount: paymentIntent.amount.toString(),
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata,
        stripeCreatedAt: expect.any(Date)
      });
    });

    it("skips creation when transaction already exists", async () => {
      const { service, stripeTransactionRepository } = setup();
      const paymentIntent = StripeSeeder.create().paymentIntent;
      const userId = "user-123";
      const existingTransaction = {
        id: "existing-transaction",
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        stripeCreatedAt: new Date(),
        stripeTransactionId: paymentIntent.id,
        amount: "2000",
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata
      };

      stripeTransactionRepository.findByStripeTransactionId.mockResolvedValue(existingTransaction);

      const result = await service["recordPaymentIntentTransaction"](paymentIntent, userId);

      expect(result).toBe(false);
      expect(stripeTransactionRepository.create).not.toHaveBeenCalled();
    });
  });

  function setup() {
    const stripeService = mock<StripeService>();
    const checkoutSessionRepository = mock<CheckoutSessionRepository>();
    const refillService = mock<RefillService>();
    const billingConfig = mock<BillingConfigService>();
    const userRepository = mock<UserRepository>();
    const paymentMethodRepository = mock<PaymentMethodRepository>();
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const stripeCouponRepository = mock<StripeCouponRepository>();

    // Mock Stripe webhook construction
    stripeService.webhooks = {
      constructEvent: jest.fn()
    } as any;

    // Mock Stripe checkout sessions
    stripeService.checkout = {
      sessions: {
        retrieve: jest.fn()
      }
    } as any;

    // Mock billing config
    billingConfig.get.mockReturnValue("test-webhook-secret");

    const service = new StripeWebhookService(
      stripeService,
      checkoutSessionRepository,
      refillService,
      billingConfig,
      userRepository,
      paymentMethodRepository,
      stripeTransactionRepository,
      stripeCouponRepository
    );

    // Spy on private methods
    jest.spyOn(service, "tryToTopUpWalletForCheckout" as any);
    jest.spyOn(service, "tryToTopUpWalletFromPaymentIntent" as any);
    jest.spyOn(service, "handlePaymentMethodAttached" as any);
    jest.spyOn(service, "handlePaymentMethodDetached" as any);
    jest.spyOn(service, "handleCustomerDiscountCreated" as any);
    jest.spyOn(service, "recordPaymentIntentTransaction" as any);

    return {
      service,
      stripeService,
      checkoutSessionRepository,
      refillService,
      billingConfig,
      userRepository,
      paymentMethodRepository,
      stripeTransactionRepository,
      stripeCouponRepository
    };
  }
});
