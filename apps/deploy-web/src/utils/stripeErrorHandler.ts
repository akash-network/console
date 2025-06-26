export interface StripeErrorInfo {
  message: string;
  userAction?: string;
}

/**
 * Centralized Stripe error handling utility
 * Provides user-friendly error messages and retry logic
 */
export function handleStripeError(error: unknown): StripeErrorInfo {
  let message = "An unexpected error occurred. Please try again.";
  let userAction: string | undefined;

  // Handle HTTP errors with status codes
  if (error && typeof error === "object" && "response" in error && error.response && typeof error.response === "object" && "status" in error.response) {
    const response = error.response as { status: number; data?: { message?: string } };
    const status = response.status;

    switch (status) {
      case 402:
        // Payment failed - card declined, insufficient funds, etc.
        message = response.data?.message || "Your payment was declined. Please check your payment method and try again.";
        userAction = "Try a different payment method or contact your bank.";
        break;
      case 400:
        // Bad request - invalid parameters
        message = response.data?.message || "Invalid payment information. Please check your details and try again.";
        userAction = "Verify your payment details and try again.";
        break;
      case 403:
        // Forbidden - payment method doesn't belong to user
        message = "Payment method not found. Please select a different payment method.";
        userAction = "Select a different payment method or add a new one.";
        break;
      case 429:
        // Rate limited
        message = "Too many payment attempts. Please wait a moment and try again.";
        userAction = "Wait a moment and try again.";
        break;
      case 502:
      case 503:
        // Service unavailable - retryable
        message = "Payment service temporarily unavailable. Please try again in a moment.";
        userAction = "Try again in a few moments.";
        break;
      case 409:
        // Idempotency error
        message = "This payment request conflicts with a previous one. Please try again.";
        userAction = "Try the payment again.";
        break;
      case 404:
        // Not found
        message = "The requested resource was not found.";
        userAction = "Refresh the page and try again.";
        break;
      default:
        message = response.data?.message || "Payment processing error. Please try again.";
        userAction = "Try again or contact support if the problem persists.";
    }
  } else if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    // Handle specific error messages from our backend
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes("insufficient funds")) {
      message = "Your card has insufficient funds. Please try a different payment method.";
      userAction = "Try a different card or payment method.";
    } else if (errorMsg.includes("expired")) {
      message = "Your card has expired. Please update your payment method.";
      userAction = "Update your card information or use a different card.";
    } else if (errorMsg.includes("declined")) {
      message = "Your card was declined. Please check with your bank or try a different card.";
      userAction = "Contact your bank or try a different card.";
    } else if (errorMsg.includes("invalid")) {
      message = "Invalid card information. Please check your details and try again.";
      userAction = "Verify your card details and try again.";
    } else if (errorMsg.includes("minimum payment amount")) {
      message = "Payment amount must be at least $20 (before any discounts).";
      userAction = "Increase your payment amount to at least $20.";
    } else if (errorMsg.includes("final amount after discount")) {
      message = "Final amount after discount must be at least $1.";
      userAction = "Increase your payment amount or use a smaller discount.";
    } else if (errorMsg.includes("no valid promotion code")) {
      message = "Invalid coupon code. Please check the code and try again.";
      userAction = "Verify your coupon code or try a different one.";
    } else if (errorMsg.includes("promotion code is invalid") || errorMsg.includes("coupon is invalid")) {
      message = "This coupon has expired or is no longer valid.";
      userAction = "Try a different coupon or proceed without one.";
    } else if (errorMsg.includes("already been used")) {
      message = "This coupon has already been used.";
      userAction = "Try a different coupon or proceed without one.";
    } else {
      message = error.message;
    }
  }

  return {
    message,
    userAction
  };
}

/**
 * Handle coupon-specific errors
 */
export function handleCouponError(response: { error?: { message: string } }): StripeErrorInfo {
  if (response.error) {
    const errorMsg = response.error.message.toLowerCase();

    if (errorMsg.includes("no valid promotion code")) {
      return {
        message: "Invalid coupon code. Please check the code and try again.",
        userAction: "Verify your coupon code or try a different one."
      };
    } else if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
      return {
        message: "This coupon has expired or is no longer valid.",
        userAction: "Try a different coupon or proceed without one."
      };
    } else if (errorMsg.includes("already been used")) {
      return {
        message: "This coupon has already been used.",
        userAction: "Try a different coupon or proceed without one."
      };
    } else {
      return {
        message: response.error.message
      };
    }
  }

  return {
    message: "Failed to apply coupon. Please check the code and try again.",
    userAction: "Verify your coupon code and try again."
  };
}
