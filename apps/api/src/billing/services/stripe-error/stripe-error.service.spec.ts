import type Stripe from "stripe";

import { StripeErrorService } from "./stripe-error.service";

describe(StripeErrorService.name, () => {
  let service: StripeErrorService;

  beforeEach(() => {
    service = new StripeErrorService();
  });

  describe("toAppError", () => {
    describe("coupon errors", () => {
      it("should handle 'No valid promotion code or coupon found with the provided code'", () => {
        const error = new Error("No valid promotion code or coupon found with the provided code");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "No valid promotion code or coupon found with the provided code");
      });

      it("should handle 'Promotion code is invalid or expired'", () => {
        const error = new Error("Promotion code is invalid or expired");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Promotion code is invalid or expired");
      });

      it("should handle 'Coupon is invalid or expired'", () => {
        const error = new Error("Coupon is invalid or expired");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Coupon is invalid or expired");
      });

      it("should handle 'This promotion code cannot be used'", () => {
        const error = new Error("This promotion code cannot be used");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "This promotion code cannot be used");
      });

      it("should handle 'Promotion code has already been used'", () => {
        const error = new Error("Promotion code has already been used");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Promotion code has already been used");
      });
    });

    describe("payment errors", () => {
      it("should handle 'Final amount after discount must be at least $1'", () => {
        const error = new Error("Final amount after discount must be at least $1");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Final amount after discount must be at least $1");
      });

      it("should handle 'Minimum payment amount is $20 (before any discounts)'", () => {
        const error = new Error("Minimum payment amount is $20 (before any discounts)");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Minimum payment amount is $20 (before any discounts)");
      });

      it("should handle 'Payment method does not belong to the user'", () => {
        const error = new Error("Payment method does not belong to the user");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 403);
        expect(result).toHaveProperty("message", "Payment method does not belong to the user");
      });

      it("should handle 'Payment not successful'", () => {
        const error = new Error("Payment not successful");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Payment not successful");
      });
    });

    describe("Stripe errors", () => {
      it("should handle StripeCardError with card_declined", () => {
        const error = {
          type: "StripeCardError",
          code: "card_declined",
          message: "Your card was declined",
          decline_code: "generic_decline"
        } as Stripe.errors.StripeCardError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card was declined");
      });

      it("should handle StripeCardError with expired_card", () => {
        const error = {
          type: "StripeCardError",
          code: "expired_card",
          message: "Your card has expired",
          decline_code: "expired_card"
        } as Stripe.errors.StripeCardError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card has expired");
      });

      it("should handle StripeCardError with insufficient_funds", () => {
        const error = {
          type: "StripeCardError",
          code: "insufficient_funds",
          message: "Your card has insufficient funds",
          decline_code: "insufficient_funds"
        } as Stripe.errors.StripeCardError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card has insufficient funds");
      });

      it("should handle StripeInvalidRequestError", () => {
        const error = {
          type: "StripeInvalidRequestError",
          message: "Invalid parameter: amount",
          param: "amount"
        } as Stripe.errors.StripeInvalidRequestError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Invalid amount: Invalid parameter: amount");
      });

      it("should handle StripeAPIError", () => {
        const error = {
          type: "StripeAPIError",
          message: "An error occurred internally with Stripe's API"
        } as Stripe.errors.StripeAPIError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 502);
        expect(result).toHaveProperty("message", "Payment service temporarily unavailable");
      });

      it("should handle StripeConnectionError", () => {
        const error = {
          type: "StripeConnectionError",
          message: "Some kind of error occurred during the HTTPS communication"
        } as Stripe.errors.StripeConnectionError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 503);
        expect(result).toHaveProperty("message", "Unable to connect to payment service");
      });

      it("should handle StripeAuthenticationError", () => {
        const error = {
          type: "StripeAuthenticationError",
          message: "You probably used an incorrect API key"
        } as Stripe.errors.StripeAuthenticationError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 500);
        expect(result).toHaveProperty("message", "Payment service configuration error");
      });

      it("should handle StripeRateLimitError", () => {
        const error = {
          type: "StripeRateLimitError",
          message: "Too many requests made to the API too quickly"
        } as Stripe.errors.StripeRateLimitError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 429);
        expect(result).toHaveProperty("message", "Too many requests. Please try again later.");
      });

      it("should handle StripeIdempotencyError", () => {
        const error = {
          type: "StripeIdempotencyError",
          message: "Idempotency key already used"
        } as Stripe.errors.StripeIdempotencyError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 409);
        expect(result).toHaveProperty("message", "This request conflicts with a previous request. Please try again with different parameters.");
      });

      it("should handle StripePermissionError", () => {
        const error = {
          type: "StripePermissionError",
          message: "Insufficient permissions"
        } as Stripe.errors.StripePermissionError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 403);
        expect(result).toHaveProperty("message", "You do not have permission to perform this action.");
      });

      it("should handle StripeSignatureVerificationError", () => {
        const error = {
          type: "StripeSignatureVerificationError",
          message: "Invalid signature"
        } as Stripe.errors.StripeSignatureVerificationError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Invalid webhook signature. Please check your webhook configuration.");
      });
    });

    describe("Card error decline codes", () => {
      it("should handle card_declined with generic_decline", () => {
        const error = {
          type: "StripeCardError",
          code: "card_declined",
          decline_code: "generic_decline",
          message: "Your card was declined"
        } as Stripe.errors.StripeCardError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card was declined");
      });

      it("should handle card_declined with insufficient_funds", () => {
        const error = {
          type: "StripeCardError",
          code: "card_declined",
          decline_code: "insufficient_funds",
          message: "Your card has insufficient funds"
        } as Stripe.errors.StripeCardError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card has insufficient funds");
      });

      it("should handle card_declined with fraudulent", () => {
        const error = {
          type: "StripeCardError",
          code: "card_declined",
          decline_code: "fraudulent",
          message: "Your card was declined for security reasons"
        } as Stripe.errors.StripeCardError;

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card was declined for security reasons");
      });
    });

    it("should return original error for unknown errors", () => {
      const error = new Error("Unknown error message");
      const result = service.toAppError(error, "payment");

      expect(result).toBe(error);
    });
  });

  describe("toCouponResponseError", () => {
    it("should return error response for known coupon errors", () => {
      const error = new Error("No valid promotion code or coupon found with the provided code");
      const result = service.toCouponResponseError(error);

      expect(result).toEqual({
        coupon: null,
        error: { message: "No valid promotion code or coupon found with the provided code" }
      });
    });

    it("should return generic error for unknown errors", () => {
      const error = new Error("Unknown error");
      const result = service.toCouponResponseError(error);

      expect(result).toEqual({
        coupon: null,
        error: { message: "Failed to apply coupon. Please check the code and try again." }
      });
    });

    it("should handle Stripe errors for coupon responses", () => {
      const error = {
        type: "StripeInvalidRequestError",
        message: "Invalid coupon code",
        param: "coupon"
      } as Stripe.errors.StripeInvalidRequestError;

      const result = service.toCouponResponseError(error);

      expect(result).toEqual({
        coupon: null,
        error: { message: "Invalid coupon: Invalid coupon code" }
      });
    });
  });

  describe("isKnownError", () => {
    it("should return true for known coupon errors", () => {
      const error = new Error("No valid promotion code or coupon found with the provided code");
      const result = service.isKnownError(error, "coupon");

      expect(result).toBe(true);
    });

    it("should return true for known payment errors", () => {
      const error = new Error("Payment method does not belong to the user");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return true for Stripe errors", () => {
      const error = {
        type: "StripeCardError",
        code: "card_declined",
        message: "Your card was declined"
      } as Stripe.errors.StripeCardError;

      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return false for unknown errors", () => {
      const error = new Error("Unknown error message");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });

    it("should return false for coupon errors when checking payment context", () => {
      const error = new Error("No valid promotion code or coupon found with the provided code");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });
  });

  describe("Retry functionality", () => {
    it("should identify retryable errors", () => {
      const connectionError = {
        type: "StripeConnectionError",
        message: "Connection failed"
      } as Stripe.errors.StripeConnectionError;

      const apiError = {
        type: "StripeAPIError",
        message: "API error"
      } as Stripe.errors.StripeAPIError;

      const rateLimitError = {
        type: "StripeRateLimitError",
        message: "Rate limit exceeded"
      } as Stripe.errors.StripeRateLimitError;

      const cardError = {
        type: "StripeCardError",
        code: "card_declined",
        message: "Card declined"
      } as Stripe.errors.StripeCardError;

      expect(service.isRetryableError(connectionError)).toBe(true);
      expect(service.isRetryableError(apiError)).toBe(true);
      expect(service.isRetryableError(rateLimitError)).toBe(true);
      expect(service.isRetryableError(cardError)).toBe(false);
    });

    it("should calculate retry delays with exponential backoff", () => {
      const error = {
        type: "StripeConnectionError",
        message: "Connection failed"
      } as Stripe.errors.StripeConnectionError;

      const delay1 = service.getRetryDelay(error, 1);
      const delay2 = service.getRetryDelay(error, 2);
      const delay3 = service.getRetryDelay(error, 3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay1).toBeLessThanOrEqual(2000); // 1s + jitter
      expect(delay2).toBeLessThanOrEqual(4000); // 2s + jitter
      expect(delay3).toBeLessThanOrEqual(8000); // 4s + jitter
    });

    it("should return 0 delay for non-retryable errors", () => {
      const error = new Error("Non-retryable error");
      const delay = service.getRetryDelay(error, 1);
      expect(delay).toBe(0);
    });
  });

  describe("Webhook error handling", () => {
    it("should handle webhook signature verification errors", () => {
      const error = {
        type: "StripeSignatureVerificationError",
        message: "Invalid signature"
      } as Stripe.errors.StripeSignatureVerificationError;

      const result = service.handleWebhookError(error);

      expect(result).toHaveProperty("status", 400);
      expect(result).toHaveProperty("message", "Invalid webhook signature. Please check your webhook configuration.");
    });

    it("should handle other webhook errors", () => {
      const error = {
        type: "StripeAPIError",
        message: "API error"
      } as Stripe.errors.StripeAPIError;

      const result = service.handleWebhookError(error);

      expect(result).toHaveProperty("status", 502);
    });
  });

  describe("Error details", () => {
    it("should get detailed error information for Stripe errors", () => {
      const error = {
        type: "StripeCardError",
        code: "card_declined",
        decline_code: "insufficient_funds",
        message: "Your card has insufficient funds"
      } as Stripe.errors.StripeCardError;

      const details = service.getErrorDetails(error);

      expect(details).toEqual({
        type: "StripeCardError",
        code: "card_declined",
        decline_code: "insufficient_funds",
        message: "Your card has insufficient funds",
        retryable: false,
        httpStatus: 402
      });
    });

    it("should get error details for non-Stripe errors", () => {
      const error = new Error("Custom error");
      const details = service.getErrorDetails(error);

      expect(details).toEqual({
        type: "Unknown",
        message: "Custom error",
        retryable: false,
        httpStatus: 500
      });
    });
  });
});
