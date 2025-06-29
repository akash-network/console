import type Stripe from "stripe";

import { StripeErrorService } from "./stripe-error.service";

// Helper function to create proper Stripe error objects
function createStripeError(type: string, props: any = {}): Stripe.errors.StripeError {
  const error = new Error(props.message || "Stripe error") as any;
  error.type = type;
  Object.assign(error, props);
  return error as Stripe.errors.StripeError;
}

describe(StripeErrorService.name, () => {
  describe("toAppError", () => {
    describe("coupon errors", () => {
      it("should handle 'No valid promotion code or coupon found with the provided code'", () => {
        const { service } = setup();
        const error = new Error("No valid promotion code or coupon found with the provided code");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "No valid promotion code or coupon found with the provided code");
      });

      it("should handle 'Promotion code is invalid or expired'", () => {
        const { service } = setup();
        const error = new Error("Promotion code is invalid or expired");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Promotion code is invalid or expired");
      });

      it("should handle 'Coupon is invalid or expired'", () => {
        const { service } = setup();
        const error = new Error("Coupon is invalid or expired");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Coupon is invalid or expired");
      });

      it("should handle 'This promotion code cannot be used'", () => {
        const { service } = setup();
        const error = new Error("This promotion code cannot be used");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "This promotion code cannot be used");
      });

      it("should handle 'Promotion code has already been used'", () => {
        const { service } = setup();
        const error = new Error("Promotion code has already been used");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Promotion code has already been used");
      });
    });

    describe("payment errors", () => {
      it("should handle 'Final amount after discount must be at least $1'", () => {
        const { service } = setup();
        const error = new Error("Final amount after discount must be at least $1");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Final amount after discount must be at least $1");
      });

      it("should handle 'Minimum payment amount is $20 (before any discounts)'", () => {
        const { service } = setup();
        const error = new Error("Minimum payment amount is $20 (before any discounts)");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Minimum payment amount is $20 (before any discounts)");
      });

      it("should handle 'Payment method does not belong to the user'", () => {
        const { service } = setup();
        const error = new Error("Payment method does not belong to the user");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 403);
        expect(result).toHaveProperty("message", "Payment method does not belong to the user");
      });

      it("should handle 'Payment not successful'", () => {
        const { service } = setup();
        const error = new Error("Payment not successful");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Payment not successful");
      });

      it("should handle 'Payment account configuration error", () => {
        const { service } = setup();
        const error = new Error("Payment account not properly configured. Please contact support.");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 500);
        expect(result).toHaveProperty("message", "Payment account not properly configured. Please contact support.");
      });

      it("should handle 'Coupon ID is required'", () => {
        const { service } = setup();
        const error = new Error("Coupon ID is required");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Coupon ID is required");
      });
    });

    describe("Stripe errors", () => {
      it("should handle StripeCardError with card_declined", () => {
        const { service } = setup();
        const error = createStripeError("StripeCardError", {
          code: "card_declined",
          message: "Your card was declined",
          decline_code: "generic_decline"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card was declined");
      });

      it("should handle StripeCardError with expired_card", () => {
        const { service } = setup();
        const error = createStripeError("StripeCardError", {
          code: "expired_card",
          message: "Your card has expired",
          decline_code: "expired_card"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card has expired");
      });

      it("should handle StripeCardError with insufficient_funds", () => {
        const { service } = setup();
        const error = createStripeError("StripeCardError", {
          code: "insufficient_funds",
          message: "Your card has insufficient funds",
          decline_code: "insufficient_funds"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card has insufficient funds");
      });

      it("should handle StripeCardError with decline code override", () => {
        const { service } = setup();
        const error = createStripeError("StripeCardError", {
          code: "card_declined",
          message: "Your card was declined",
          decline_code: "insufficient_funds"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card has insufficient funds");
      });

      it("should handle StripeCardError with unknown decline code", () => {
        const { service } = setup();
        const error = createStripeError("StripeCardError", {
          code: "card_declined",
          message: "Your card was declined",
          decline_code: "unknown_decline"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card was declined");
      });

      it("should handle StripeCardError with no code", () => {
        const { service } = setup();
        const error = createStripeError("StripeCardError", {
          message: "Your card was declined"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 402);
        expect(result).toHaveProperty("message", "Your card was declined");
      });

      it("should handle StripeInvalidRequestError with param", () => {
        const { service } = setup();
        const error = createStripeError("StripeInvalidRequestError", {
          message: "Invalid parameter: amount",
          param: "amount"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Invalid amount: Invalid parameter: amount");
      });

      it("should handle StripeInvalidRequestError without param", () => {
        const { service } = setup();
        const error = createStripeError("StripeInvalidRequestError", {
          message: "Invalid request"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Invalid request");
      });

      it("should handle StripeAPIError", () => {
        const { service } = setup();
        const error = createStripeError("StripeAPIError", {
          message: "An error occurred internally with Stripe's API"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 502);
        expect(result).toHaveProperty("message", "Payment service temporarily unavailable. Please try again later.");
      });

      it("should handle StripeConnectionError", () => {
        const { service } = setup();
        const error = createStripeError("StripeConnectionError", {
          message: "Some kind of error occurred during the HTTPS communication"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 503);
        expect(result).toHaveProperty("message", "Unable to connect to payment service. Please try again.");
      });

      it("should handle StripeAuthenticationError", () => {
        const { service } = setup();
        const error = createStripeError("StripeAuthenticationError", {
          message: "You probably used an incorrect API key"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 500);
        expect(result).toHaveProperty("message", "Payment service configuration error");
      });

      it("should handle StripeRateLimitError", () => {
        const { service } = setup();
        const error = createStripeError("StripeRateLimitError", {
          message: "Too many requests made to the API too quickly"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 429);
        expect(result).toHaveProperty("message", "Too many requests. Please try again later.");
      });

      it("should handle StripeIdempotencyError", () => {
        const { service } = setup();
        const error = createStripeError("StripeIdempotencyError", {
          message: "Idempotency key already used"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 409);
        expect(result).toHaveProperty("message", "This request conflicts with a previous request. Please try again with different parameters.");
      });

      it("should handle StripePermissionError", () => {
        const { service } = setup();
        const error = createStripeError("StripePermissionError", {
          message: "Insufficient permissions"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 403);
        expect(result).toHaveProperty("message", "You don't have permission to perform this action.");
      });

      it("should handle StripeSignatureVerificationError", () => {
        const { service } = setup();
        const error = createStripeError("StripeSignatureVerificationError", {
          message: "Invalid signature"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Invalid webhook signature. Please check your webhook configuration.");
      });

      it("should handle unknown Stripe error type", () => {
        const { service } = setup();
        const error = createStripeError("StripeUnknownError", {
          message: "Unknown error"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 500);
        expect(result).toHaveProperty("message", "An unexpected error occurred");
      });
    });

    describe("non-Error objects", () => {
      it("should handle non-Error objects", () => {
        const { service } = setup();
        const error: unknown = "String error";

        const result = service.toAppError(error, "payment");

        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("An unknown error occurred");
      });

      it("should handle null errors", () => {
        const { service } = setup();
        const error: unknown = null;

        const result = service.toAppError(error, "payment");

        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("An unknown error occurred");
      });

      it("should handle undefined errors", () => {
        const { service } = setup();
        const error: unknown = undefined;

        const result = service.toAppError(error, "payment");

        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe("An unknown error occurred");
      });
    });

    describe("unknown errors", () => {
      it("should return original error for unknown errors", () => {
        const { service } = setup();
        const error = new Error("Unknown error message");

        const result = service.toAppError(error, "payment");

        expect(result).toBe(error);
      });

      it("should return original error for unknown coupon errors", () => {
        const { service } = setup();
        const error = new Error("Unknown coupon error");

        const result = service.toAppError(error, "coupon");

        expect(result).toBe(error);
      });
    });
  });

  describe("toCouponResponseError", () => {
    it("should handle known coupon errors", () => {
      const { service } = setup();
      const error = new Error("No valid promotion code or coupon found with the provided code");

      const result = service.toCouponResponseError(error);

      expect(result).toEqual({
        coupon: null,
        error: {
          message: "No valid promotion code or coupon found with the provided code",
          code: "invalid_coupon_code",
          type: "coupon_error"
        }
      });
    });

    it("should handle unknown coupon errors", () => {
      const { service } = setup();
      const error = new Error("Unknown coupon error");

      const result = service.toCouponResponseError(error);

      expect(result).toEqual({
        coupon: null,
        error: {
          message: "Failed to apply coupon. Please check the code and try again.",
          code: "unknown_coupon_error",
          type: "coupon_error"
        }
      });
    });

    it("should handle non-Error objects", () => {
      const { service } = setup();
      const error: unknown = "String error";

      const result = service.toCouponResponseError(error);

      expect(result).toEqual({
        coupon: null,
        error: {
          message: "Failed to apply coupon. Please check the code and try again.",
          code: "unknown_coupon_error",
          type: "coupon_error"
        }
      });
    });
  });

  describe("isKnownError", () => {
    it("should return true for known coupon errors", () => {
      const { service } = setup();
      const error = new Error("No valid promotion code or coupon found with the provided code");
      const result = service.isKnownError(error, "coupon");

      expect(result).toBe(true);
    });

    it("should return true for known payment errors", () => {
      const { service } = setup();
      const error = new Error("Payment method does not belong to the user");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return true for Stripe errors", () => {
      const { service } = setup();
      const error = createStripeError("StripeCardError", {
        code: "card_declined",
        message: "Your card was declined"
      });

      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return false for unknown errors", () => {
      const { service } = setup();
      const error = new Error("Unknown error message");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });

    it("should return false for coupon errors when checking payment context", () => {
      const { service } = setup();
      const error = new Error("No valid promotion code or coupon found with the provided code");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      const { service } = setup();
      const error: unknown = "String error";
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });

    it("should return false for null errors", () => {
      const { service } = setup();
      const error: unknown = null;
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable Stripe errors", () => {
      const { service } = setup();
      const connectionError = createStripeError("StripeConnectionError", {
        message: "Connection error"
      });

      const apiError = createStripeError("StripeAPIError", {
        message: "API error"
      });

      const rateLimitError = createStripeError("StripeRateLimitError", {
        message: "Rate limit error"
      });

      expect(service.isRetryableError(connectionError)).toBe(true);
      expect(service.isRetryableError(apiError)).toBe(true);
      expect(service.isRetryableError(rateLimitError)).toBe(true);
    });

    it("should return false for non-retryable Stripe errors", () => {
      const { service } = setup();
      const cardError = createStripeError("StripeCardError", {
        message: "Card error"
      });

      const invalidRequestError = createStripeError("StripeInvalidRequestError", {
        message: "Invalid request"
      });

      expect(service.isRetryableError(cardError)).toBe(false);
      expect(service.isRetryableError(invalidRequestError)).toBe(false);
    });

    it("should return false for non-Stripe errors", () => {
      const { service } = setup();
      const error = new Error("Regular error");

      expect(service.isRetryableError(error)).toBe(false);
    });
  });

  describe("getRetryDelay", () => {
    it("should return 0 for non-retryable errors", () => {
      const { service } = setup();
      const error = new Error("Non-retryable error");

      const delay = service.getRetryDelay(error);

      expect(delay).toBe(0);
    });

    it("should return exponential backoff for retryable errors", () => {
      const { service } = setup();
      const error = createStripeError("StripeConnectionError", {
        message: "Connection error"
      });

      const delay1 = service.getRetryDelay(error, 1);
      const delay2 = service.getRetryDelay(error, 2);
      const delay3 = service.getRetryDelay(error, 3);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1100); // 1000 + 10% jitter
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2200); // 2000 + 10% jitter
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(4400); // 4000 + 10% jitter
    });

    it("should cap delay at maximum", () => {
      const { service } = setup();
      const error = createStripeError("StripeConnectionError", {
        message: "Connection error"
      });

      const delay = service.getRetryDelay(error, 10); // Should be capped at 30s

      expect(delay).toBeLessThanOrEqual(33000); // 30000 + 10% jitter
    });
  });

  describe("handleWebhookError", () => {
    it("should handle webhook signature verification errors", () => {
      const { service } = setup();
      const error = createStripeError("StripeSignatureVerificationError", {
        message: "Invalid signature"
      });

      const result = service.handleWebhookError(error);

      expect(result).toHaveProperty("status", 400);
      expect(result).toHaveProperty("message", "Invalid webhook signature. Please check your webhook configuration.");
    });

    it("should handle other webhook errors", () => {
      const { service } = setup();
      const error = createStripeError("StripeAPIError", {
        message: "API error"
      });

      const result = service.handleWebhookError(error);

      expect(result).toHaveProperty("status", 502);
    });

    it("should handle non-Stripe webhook errors", () => {
      const { service } = setup();
      const error = new Error("Regular error");

      const result = service.handleWebhookError(error);

      expect(result).toHaveProperty("status", 500);
      expect(result).toHaveProperty("message", "Webhook processing error");
    });
  });

  describe("getErrorDetails", () => {
    it("should get detailed error information for Stripe errors", () => {
      const { service } = setup();
      const error = createStripeError("StripeCardError", {
        code: "card_declined",
        decline_code: "insufficient_funds",
        message: "Your card has insufficient funds"
      });

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
      const { service } = setup();
      const error = new Error("Custom error");
      const details = service.getErrorDetails(error);

      expect(details).toEqual({
        type: "Unknown",
        message: "Custom error",
        retryable: false,
        httpStatus: 500
      });
    });

    it("should handle Stripe errors with missing properties", () => {
      const { service } = setup();
      const error = createStripeError("StripeCardError", {
        message: "Card error"
      });

      const details = service.getErrorDetails(error);

      expect(details).toEqual({
        type: "StripeCardError",
        message: "Card error",
        retryable: false,
        httpStatus: 402
      });
    });
  });
});

function setup() {
  const service = new StripeErrorService();

  return {
    service
  };
}
