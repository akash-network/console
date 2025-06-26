import { handleCouponError, handleStripeError } from "../../src/utils/stripeErrorHandler";

describe("StripeErrorHandler", () => {
  describe("handleStripeError", () => {
    it("should handle 402 payment declined errors", () => {
      const error = {
        response: {
          status: 402,
          data: {
            message: "Your card was declined"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card was declined");
      expect(result.userAction).toBe("Try a different payment method or contact your bank.");
    });

    it("should handle 400 bad request errors", () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: "Invalid payment information"
          }
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Invalid payment information");
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

    it("should handle insufficient funds error messages", () => {
      const error = {
        message: "Your card has insufficient funds"
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card has insufficient funds. Please try a different payment method.");
      expect(result.userAction).toBe("Try a different card or payment method.");
    });

    it("should handle expired card error messages", () => {
      const error = {
        message: "Your card has expired"
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card has expired. Please update your payment method.");
      expect(result.userAction).toBe("Update your card information or use a different card.");
    });

    it("should handle declined card error messages", () => {
      const error = {
        message: "Your card was declined"
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Your card was declined. Please check with your bank or try a different card.");
      expect(result.userAction).toBe("Contact your bank or try a different card.");
    });

    it("should handle minimum payment amount errors", () => {
      const error = {
        message: "Payment amount must be at least $20"
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Payment amount must be at least $20 (before any discounts).");
      expect(result.userAction).toBe("Increase your payment amount to at least $20.");
    });

    it("should handle final amount after discount errors", () => {
      const error = {
        message: "Final amount after discount must be at least $1"
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Final amount after discount must be at least $1.");
      expect(result.userAction).toBe("Increase your payment amount or use a smaller discount.");
    });

    it("should handle unknown errors gracefully", () => {
      const error = {
        response: {
          status: 500
        }
      };

      const result = handleStripeError(error);

      expect(result.message).toBe("Payment processing error. Please try again.");
      expect(result.userAction).toBe("Try again or contact support if the problem persists.");
    });

    it("should handle errors without response or message", () => {
      const error = {};

      const result = handleStripeError(error);

      expect(result.message).toBe("An unexpected error occurred. Please try again.");
    });
  });

  describe("handleCouponError", () => {
    it("should handle invalid coupon codes", () => {
      const response = {
        error: {
          message: "No valid promotion code"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("Invalid coupon code. Please check the code and try again.");
      expect(result.userAction).toBe("Verify your coupon code or try a different one.");
    });

    it("should handle expired coupons", () => {
      const response = {
        error: {
          message: "This promotion code is invalid"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("This coupon has expired or is no longer valid.");
      expect(result.userAction).toBe("Try a different coupon or proceed without one.");
    });

    it("should handle already used coupons", () => {
      const response = {
        error: {
          message: "This coupon has already been used"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("This coupon has already been used.");
      expect(result.userAction).toBe("Try a different coupon or proceed without one.");
    });

    it("should handle unknown coupon errors", () => {
      const response = {
        error: {
          message: "Unknown coupon error"
        }
      };

      const result = handleCouponError(response);

      expect(result.message).toBe("Unknown coupon error");
    });

    it("should handle responses without error", () => {
      const response = {};

      const result = handleCouponError(response);

      expect(result.message).toBe("Failed to apply coupon. Please check the code and try again.");
      expect(result.userAction).toBe("Verify your coupon code and try again.");
    });
  });
});
