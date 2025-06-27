import { handleCouponError, handleStripeError } from "../../src/utils/stripeErrorHandler";

describe("StripeErrorHandler", () => {
  describe("handleStripeError", () => {
    it("should handle 402 payment declined errors", () => {
      const error = {
        response: {
          status: 402
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your payment was declined. Please check your payment method and try again.");
      expect(result.userAction).toBe("Try a different payment method or contact your bank.");
    });

    it("should handle 400 bad request errors", () => {
      const error = {
        response: {
          status: 400
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Invalid payment information. Please check your details and try again.");
      expect(result.userAction).toBe("Verify your payment details and try again.");
    });

    it("should handle 403 forbidden errors", () => {
      const error = {
        response: {
          status: 403
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Payment method not found. Please select a different payment method.");
      expect(result.userAction).toBe("Select a different payment method or add a new one.");
    });

    it("should handle 429 rate limit errors", () => {
      const error = {
        response: {
          status: 429
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Too many payment attempts. Please wait a moment and try again.");
      expect(result.userAction).toBe("Wait a moment and try again.");
    });

    it("should handle 502/503 service unavailable errors", () => {
      const error = {
        response: {
          status: 502
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Payment service temporarily unavailable. Please try again in a moment.");
      expect(result.userAction).toBe("Try again in a few moments.");
    });

    it("should handle 409 idempotency errors", () => {
      const error = {
        response: {
          status: 409
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("This payment request conflicts with a previous one. Please try again.");
      expect(result.userAction).toBe("Try the payment again.");
    });

    it("should handle insufficient funds error codes", () => {
      const error = {
        response: {
          status: 402,
          data: {
            error: "PaymentError",
            message: "Your card has insufficient funds",
            code: "insufficient_funds",
            type: "payment_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card has insufficient funds. Please try a different payment method.");
      expect(result.userAction).toBe("Try a different card or payment method.");
    });

    it("should handle card expired error codes", () => {
      const error = {
        response: {
          status: 402,
          data: {
            error: "PaymentError",
            message: "Your card has expired",
            code: "card_expired",
            type: "payment_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card has expired. Please update your payment method.");
      expect(result.userAction).toBe("Update your card information or use a different card.");
    });

    it("should handle card declined error codes", () => {
      const error = {
        response: {
          status: 402,
          data: {
            error: "PaymentError",
            message: "Your card was declined",
            code: "card_declined",
            type: "payment_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card was declined. Please check with your bank or try a different card.");
      expect(result.userAction).toBe("Contact your bank or try a different card.");
    });

    it("should handle minimum payment amount error codes", () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: "ValidationError",
            message: "Payment amount must be at least $20",
            code: "minimum_payment_amount",
            type: "validation_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Payment amount must be at least $20 (before any discounts).");
      expect(result.userAction).toBe("Increase your payment amount to at least $20.");
    });

    it("should handle final amount too low error codes", () => {
      const error = {
        response: {
          status: 400,
          data: {
            error: "ValidationError",
            message: "Final amount after discount must be at least $1",
            code: "final_amount_too_low",
            type: "validation_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Final amount after discount must be at least $1.");
      expect(result.userAction).toBe("Increase your payment amount or use a smaller discount.");
    });

    it("should handle payment method not owned error codes", () => {
      const error = {
        response: {
          status: 403,
          data: {
            error: "ForbiddenError",
            message: "Payment method does not belong to the user",
            code: "payment_method_not_owned",
            type: "authorization_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Payment method not found. Please select a different payment method.");
      expect(result.userAction).toBe("Select a different payment method or add a new one.");
    });

    it("should handle unknown error codes gracefully", () => {
      const error = {
        response: {
          status: 500,
          data: {
            error: "InternalServerError",
            message: "Custom error message",
            code: "unknown_error_code",
            type: "server_error"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Custom error message");
      expect(result.userAction).toBe("Try again or contact support if the problem persists.");
    });

    it("should handle errors without response structure", () => {
      const error = {};

      const result = handleStripeError(error);

      expect(result.message).toBe("An unexpected error occurred. Please try again.");
      expect(result.userAction).toBe("Try again or contact support if the problem persists.");
    });

    it("should handle errors with message but no response structure", () => {
      const error = {
        message: "Some error message"
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("An unexpected error occurred. Please try again.");
      expect(result.userAction).toBe("Try again or contact support if the problem persists.");
    });
  });

  describe("handleCouponError", () => {
    it("should handle invalid coupon code error codes", () => {
      const response = {
        error: {
          message: "No valid promotion code found",
          code: "invalid_coupon_code",
          type: "coupon_error"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("Invalid coupon code. Please check the code and try again.");
      expect(result.userAction).toBe("Verify your coupon code or try a different one.");
    });

    it("should handle coupon expired error codes", () => {
      const response = {
        error: {
          message: "Coupon is invalid or expired",
          code: "coupon_expired",
          type: "coupon_error"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("This coupon has expired or is no longer valid.");
      expect(result.userAction).toBe("Try a different coupon or proceed without one.");
    });

    it("should handle coupon already used error codes", () => {
      const response = {
        error: {
          message: "Promotion code has already been used",
          code: "coupon_already_used",
          type: "coupon_error"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("This coupon has already been used.");
      expect(result.userAction).toBe("Try a different coupon or proceed without one.");
    });

    it("should handle coupon not applicable error codes", () => {
      const response = {
        error: {
          message: "This promotion code cannot be used",
          code: "coupon_not_applicable",
          type: "coupon_error"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("This coupon cannot be used for this purchase.");
      expect(result.userAction).toBe("Try a different coupon or proceed without one.");
    });

    it("should handle unknown coupon error codes gracefully", () => {
      const response = {
        error: {
          message: "Custom coupon error",
          code: "unknown_coupon_error",
          type: "coupon_error"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("Custom coupon error");
      expect(result.userAction).toBe("Try again or contact support if the problem persists.");
    });

    it("should handle coupon errors without code", () => {
      const response = {
        error: {
          message: "Custom error message"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("Custom error message");
      expect(result.userAction).toBe("Try again or contact support if the problem persists.");
    });

    it("should handle response without error", () => {
      const response = {};

      const result = handleCouponError(response);

      expect(result.message).toBe("Failed to apply coupon. Please check the code and try again.");
      expect(result.userAction).toBe("Verify your coupon code and try again.");
    });
  });
});
