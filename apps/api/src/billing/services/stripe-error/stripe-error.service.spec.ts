import { HttpError } from "http-errors";
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
    it("handles percentage-based coupon error", () => {
      const { service } = setup();
      const error = new Error("Percentage-based coupons are not supported. Only fixed amount coupons are allowed.");
      const result = service.toAppError(error, "coupon");

      expect(result).toBeInstanceOf(HttpError);
      expect((result as HttpError).status).toBe(400);
      expect((result as HttpError).message).toBe("Percentage-based coupons are not supported. Only fixed amount coupons are allowed.");
    });

    it("handles invalid coupon type error", () => {
      const { service } = setup();
      const error = new Error("Invalid coupon type. Only fixed amount coupons are supported.");
      const result = service.toAppError(error, "coupon");

      expect(result).toBeInstanceOf(HttpError);
      expect((result as HttpError).status).toBe(400);
      expect((result as HttpError).message).toBe("Invalid coupon type. Only fixed amount coupons are supported.");
    });

    it("identifies percentage-based coupon error as known error", () => {
      const { service } = setup();
      const error = new Error("Percentage-based coupons are not supported. Only fixed amount coupons are allowed.");
      const result = service.isKnownError(error, "coupon");

      expect(result).toBe(true);
    });

    it("identifies invalid coupon type error as known error", () => {
      const { service } = setup();
      const error = new Error("Invalid coupon type. Only fixed amount coupons are supported.");
      const result = service.isKnownError(error, "coupon");

      expect(result).toBe(true);
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
