export interface StripeErrorInfo {
  message: string;
  userAction?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Centralized Stripe error handling utility
 * Provides user-friendly error messages and retry logic based on error codes
 */
export function handleStripeError(error: unknown): StripeErrorInfo {
  // Handle HTTP errors with status codes and error codes
  if (error && typeof error === "object" && "response" in error && error.response && typeof error.response === "object" && "status" in error.response) {
    const response = error.response as {
      status: number;
      data?: ErrorResponse | { message?: string };
    };
    const status = response.status;
    const errorData = response.data as ErrorResponse;

    // If we have error codes, use them for precise error handling
    if (errorData?.code) {
      return handleErrorByCode(errorData.code, errorData.message);
    }

    // Fallback to status code handling only
    return handleErrorByStatus(status, errorData?.message);
  }

  // For errors without response structure, return generic error
  return {
    message: "An unexpected error occurred. Please try again.",
    userAction: "Try again or contact support if the problem persists."
  };
}

/**
 * Handle errors by their specific error codes for precise error handling
 */
function handleErrorByCode(errorCode: string, originalMessage?: string): StripeErrorInfo {
  const errorHandlers: Record<string, StripeErrorInfo> = {
    // Payment-related error codes
    insufficient_funds: {
      message: "Your card has insufficient funds. Please try a different payment method.",
      userAction: "Try a different card or payment method."
    },
    card_expired: {
      message: "Your card has expired. Please update your payment method.",
      userAction: "Update your card information or use a different card."
    },
    card_declined: {
      message: "Your card was declined. Please check with your bank or try a different card.",
      userAction: "Contact your bank or try a different card."
    },
    invalid_card_info: {
      message: "Invalid card information. Please check your details and try again.",
      userAction: "Verify your card details and try again."
    },
    minimum_payment_amount: {
      message: "Payment amount must be at least $20 (before any discounts).",
      userAction: "Increase your payment amount to at least $20."
    },
    final_amount_too_low: {
      message: "Final amount after discount must be at least $1.",
      userAction: "Increase your payment amount or use a smaller discount."
    },
    payment_method_not_owned: {
      message: "Payment method not found. Please select a different payment method.",
      userAction: "Select a different payment method or add a new one."
    },
    no_stripe_customer: {
      message: "Payment account not found. Please contact support.",
      userAction: "Contact support to set up your payment account."
    },
    payment_failed: {
      message: "Your payment was declined. Please check your payment method and try again.",
      userAction: "Try a different payment method or contact your bank."
    },

    // Coupon-related error codes
    invalid_coupon_code: {
      message: "Invalid coupon code. Please check the code and try again.",
      userAction: "Verify your coupon code or try a different one."
    },
    coupon_expired: {
      message: "This coupon has expired or is no longer valid.",
      userAction: "Try a different coupon or proceed without one."
    },
    coupon_already_used: {
      message: "This coupon has already been used.",
      userAction: "Try a different coupon or proceed without one."
    },
    coupon_not_applicable: {
      message: "This coupon cannot be used for this purchase.",
      userAction: "Try a different coupon or proceed without one."
    },
    coupon_id_required: {
      message: "Coupon code is required.",
      userAction: "Enter a valid coupon code."
    },

    // HTTP status-based error codes
    bad_request: {
      message: "Invalid payment information. Please check your details and try again.",
      userAction: "Verify your payment details and try again."
    },
    unauthorized: {
      message: "Please log in to continue.",
      userAction: "Log in and try again."
    },
    forbidden: {
      message: "You don't have permission to perform this action.",
      userAction: "Contact support if you believe this is an error."
    },
    not_found: {
      message: "The requested resource was not found.",
      userAction: "Refresh the page and try again."
    },
    conflict: {
      message: "This payment request conflicts with a previous one. Please try again.",
      userAction: "Try the payment again."
    },
    rate_limited: {
      message: "Too many payment attempts. Please wait a moment and try again.",
      userAction: "Wait a moment and try again."
    },
    service_unavailable: {
      message: "Payment service temporarily unavailable. Please try again in a moment.",
      userAction: "Try again in a few moments."
    },
    validation_error: {
      message: "Invalid payment information. Please check your details and try again.",
      userAction: "Verify your payment details and try again."
    },
    internal_server_error: {
      message: "Payment processing error. Please try again.",
      userAction: "Try again or contact support if the problem persists."
    }
  };

  // Return the specific error handler or fallback to original message
  return (
    errorHandlers[errorCode] || {
      message: originalMessage || "An unexpected error occurred. Please try again.",
      userAction: "Try again or contact support if the problem persists."
    }
  );
}

/**
 * Handle errors by HTTP status code when no specific error code is available
 */
function handleErrorByStatus(status: number, originalMessage?: string): StripeErrorInfo {
  switch (status) {
    case 402:
      return {
        message: originalMessage || "Your payment was declined. Please check your payment method and try again.",
        userAction: "Try a different payment method or contact your bank."
      };
    case 400:
      return {
        message: originalMessage || "Invalid payment information. Please check your details and try again.",
        userAction: "Verify your payment details and try again."
      };
    case 403:
      return {
        message: "Payment method not found. Please select a different payment method.",
        userAction: "Select a different payment method or add a new one."
      };
    case 429:
      return {
        message: "Too many payment attempts. Please wait a moment and try again.",
        userAction: "Wait a moment and try again."
      };
    case 502:
    case 503:
      return {
        message: "Payment service temporarily unavailable. Please try again in a moment.",
        userAction: "Try again in a few moments."
      };
    case 409:
      return {
        message: "This payment request conflicts with a previous one. Please try again.",
        userAction: "Try the payment again."
      };
    case 404:
      return {
        message: "The requested resource was not found.",
        userAction: "Refresh the page and try again."
      };
    default:
      return {
        message: originalMessage || "Payment processing error. Please try again.",
        userAction: "Try again or contact support if the problem persists."
      };
  }
}

/**
 * Handle coupon-specific errors
 */
export function handleCouponError(response: { error?: { message: string; code?: string; type?: string } }): StripeErrorInfo {
  if (response.error) {
    // If we have error codes, use them for precise error handling
    if (response.error.code) {
      return handleErrorByCode(response.error.code, response.error.message);
    }

    // If no error code, return the original message without string matching
    return {
      message: response.error.message,
      userAction: "Try again or contact support if the problem persists."
    };
  }

  return {
    message: "Failed to apply coupon. Please check the code and try again.",
    userAction: "Verify your coupon code and try again."
  };
}
