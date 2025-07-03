import type Stripe from "stripe";

import { CouponError, PaymentError, StripeErrorService, ValidationError } from "./stripe-error.service";

// Helper function to create proper Stripe error objects
function createStripeError(type: string, props: Partial<Stripe.errors.StripeError> = {}): Stripe.errors.StripeError {
  const error = {
    type,
    message: props.message || "Stripe error",
    ...props
  } as Stripe.errors.StripeError;

  return error;
}

describe(StripeErrorService.name, () => {
  describe("toAppError", () => {
    describe("custom error types", () => {
      it("should handle CouponError", () => {
        const { service } = setup();
        const error = new CouponError("No valid promotion code or coupon found with the provided code");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "No valid promotion code or coupon found with the provided code");
      });

      it("should handle PaymentError", () => {
        const { service } = setup();
        const error = new PaymentError("Payment method does not belong to the user");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Payment method does not belong to the user");
      });

      it("should handle ValidationError", () => {
        const { service } = setup();
        const error = new ValidationError("Final amount after discount must be at least $1");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Final amount after discount must be at least $1");
      });

      it("should handle CouponError with different message", () => {
        const { service } = setup();
        const error = new CouponError("Promotion code is invalid or expired");
        const result = service.toAppError(error, "coupon");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Promotion code is invalid or expired");
      });

      it("should handle PaymentError with different message", () => {
        const { service } = setup();
        const error = new PaymentError("Payment account not properly configured. Please contact support.");
        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Payment account not properly configured. Please contact support.");
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

      it("should handle StripeInvalidRequestError", () => {
        const { service } = setup();
        const error = createStripeError("StripeInvalidRequestError", {
          message: "Invalid parameter: amount",
          param: "amount"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message", "Invalid amount: Invalid parameter: amount");
      });

      it("should handle StripeAPIError", () => {
        const { service } = setup();
        const error = createStripeError("StripeAPIError", {
          message: "Internal server error"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 502);
        expect(result).toHaveProperty("message", "Payment service temporarily unavailable. Please try again later.");
      });

      it("should handle StripeConnectionError", () => {
        const { service } = setup();
        const error = createStripeError("StripeConnectionError", {
          message: "Connection failed"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 503);
        expect(result).toHaveProperty("message", "Unable to connect to payment service. Please try again.");
      });

      it("should handle StripeAuthenticationError", () => {
        const { service } = setup();
        const error = createStripeError("StripeAuthenticationError", {
          message: "Authentication failed"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 500);
        expect(result).toHaveProperty("message", "Payment service configuration error");
      });

      it("should handle StripeRateLimitError", () => {
        const { service } = setup();
        const error = createStripeError("StripeRateLimitError", {
          message: "Rate limit exceeded"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 429);
        expect(result).toHaveProperty("message", "Too many requests. Please try again later.");
      });

      it("should handle StripeIdempotencyError", () => {
        const { service } = setup();
        const error = createStripeError("StripeIdempotencyError", {
          message: "Idempotency key conflict"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 409);
        expect(result).toHaveProperty("message", "This request conflicts with a previous request. Please try again with different parameters.");
      });

      it("should handle StripePermissionError", () => {
        const { service } = setup();
        const error = createStripeError("StripePermissionError", {
          message: "Permission denied"
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

      it("should handle unknown Stripe error", () => {
        const { service } = setup();
        const error = createStripeError("StripeUnknownError", {
          message: "Unknown error"
        });

        const result = service.toAppError(error, "payment");

        expect(result).toHaveProperty("status", 500);
        expect(result).toHaveProperty("message", "An unexpected error occurred");
      });
    });

    describe("unknown errors", () => {
      it("should return original error for unknown error types", () => {
        const { service } = setup();
        const error = new Error("Some unknown error");
        const result = service.toAppError(error, "payment");

        expect(result).toBe(error);
      });

      it("should handle non-Error objects", () => {
        const { service } = setup();
        const error = "String error";
        const result = service.toAppError(error, "payment");

        expect(result).toBeInstanceOf(Error);
        expect(result).toHaveProperty("message", "An unknown error occurred");
      });
    });
  });

  describe("toCouponResponseError", () => {
    it("should handle CouponError", () => {
      const { service } = setup();
      const error = new CouponError("No valid promotion code or coupon found with the provided code");
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

    it("should handle unknown coupon error", () => {
      const { service } = setup();
      const error = new Error("Some unknown coupon error");
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

  describe("getPaymentErrorCode", () => {
    it("should handle CouponError", () => {
      const { service } = setup();
      const error = new CouponError("No valid promotion code or coupon found with the provided code");
      const result = service.getPaymentErrorCode(error);

      expect(result).toEqual({
        message: "No valid promotion code or coupon found with the provided code",
        code: "invalid_coupon_code",
        type: "coupon_error"
      });
    });

    it("should handle PaymentError", () => {
      const { service } = setup();
      const error = new PaymentError("Payment method does not belong to the user");
      const result = service.getPaymentErrorCode(error);

      expect(result).toEqual({
        message: "Payment method does not belong to the user",
        code: "payment_method_not_owned",
        type: "payment_error"
      });
    });

    it("should handle unknown error", () => {
      const { service } = setup();
      const error = new Error("Some unknown error");
      const result = service.getPaymentErrorCode(error);

      expect(result).toEqual({
        message: "An unexpected payment error occurred",
        code: "unknown_payment_error",
        type: "payment_error"
      });
    });
  });

  describe("isKnownError", () => {
    it("should return true for CouponError", () => {
      const { service } = setup();
      const error = new CouponError("Some coupon error");
      const result = service.isKnownError(error, "coupon");

      expect(result).toBe(true);
    });

    it("should return true for PaymentError", () => {
      const { service } = setup();
      const error = new PaymentError("Some payment error");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return true for ValidationError", () => {
      const { service } = setup();
      const error = new ValidationError("Some validation error");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return true for Stripe errors", () => {
      const { service } = setup();
      const error = createStripeError("StripeCardError", {
        message: "Card declined"
      });
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(true);
    });

    it("should return false for unknown errors", () => {
      const { service } = setup();
      const error = new Error("Some unknown error");
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      const { service } = setup();
      const error = "String error";
      const result = service.isKnownError(error, "payment");

      expect(result).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable Stripe errors", () => {
      const { service } = setup();
      const connectionError = createStripeError("StripeConnectionError", {
        message: "Connection failed"
      });
      const apiError = createStripeError("StripeAPIError", {
        message: "API error"
      });
      const rateLimitError = createStripeError("StripeRateLimitError", {
        message: "Rate limit exceeded"
      });

      expect(service.isRetryableError(connectionError)).toBe(true);
      expect(service.isRetryableError(apiError)).toBe(true);
      expect(service.isRetryableError(rateLimitError)).toBe(true);
    });

    it("should return false for non-retryable Stripe errors", () => {
      const { service } = setup();
      const cardError = createStripeError("StripeCardError", {
        message: "Card declined"
      });
      const authError = createStripeError("StripeAuthenticationError", {
        message: "Auth failed"
      });

      expect(service.isRetryableError(cardError)).toBe(false);
      expect(service.isRetryableError(authError)).toBe(false);
    });

    it("should return false for custom errors", () => {
      const { service } = setup();
      const couponError = new CouponError("Some coupon error");
      const paymentError = new PaymentError("Some payment error");

      expect(service.isRetryableError(couponError)).toBe(false);
      expect(service.isRetryableError(paymentError)).toBe(false);
    });
  });

  describe("getRetryDelay", () => {
    it("should return 0 for non-retryable errors", () => {
      const { service } = setup();
      const cardError = createStripeError("StripeCardError", {
        message: "Card declined"
      });

      const delay = service.getRetryDelay(cardError);

      expect(delay).toBe(0);
    });

    it("should return exponential backoff for retryable errors", () => {
      const { service } = setup();
      const connectionError = createStripeError("StripeConnectionError", {
        message: "Connection failed"
      });

      const delay1 = service.getRetryDelay(connectionError, 1);
      const delay2 = service.getRetryDelay(connectionError, 2);
      const delay3 = service.getRetryDelay(connectionError, 3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("should cap delay at maximum", () => {
      const { service } = setup();
      const connectionError = createStripeError("StripeConnectionError", {
        message: "Connection failed"
      });

      const delay = service.getRetryDelay(connectionError, 10);

      expect(delay).toBeLessThanOrEqual(30000); // 30 seconds max
    });
  });

  describe("handleWebhookError", () => {
    it("should handle StripeSignatureVerificationError", () => {
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
      const error = new CouponError("Some coupon error");

      const result = service.handleWebhookError(error);

      expect(result).toHaveProperty("status", 400);
      expect(result).toHaveProperty("message", "Some coupon error");
    });
  });

  describe("getErrorDetails", () => {
    it("should return details for Stripe errors", () => {
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
        param: undefined,
        message: "Your card has insufficient funds",
        retryable: false,
        httpStatus: 402
      });
    });

    it("should return details for custom errors", () => {
      const { service } = setup();
      const error = new CouponError("Some coupon error");

      const details = service.getErrorDetails(error);

      expect(details).toEqual({
        type: "Unknown",
        message: "Some coupon error",
        retryable: false,
        httpStatus: 500
      });
    });
  });

  function setup() {
    const service = new StripeErrorService();
    return { service };
  }
});
