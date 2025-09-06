import createError, { HttpError } from "http-errors";
import Stripe from "stripe";
import { singleton } from "tsyringe";

@singleton()
export class StripeErrorService {
  private readonly COUPON_ERRORS = {
    "No valid promotion code or coupon found with the provided code": {
      code: 400,
      message: "No valid promotion code or coupon found with the provided code"
    },
    "Promotion code is invalid or expired": {
      code: 400,
      message: "Promotion code is invalid or expired"
    },
    "Coupon is invalid or expired": {
      code: 400,
      message: "Coupon is invalid or expired"
    },
    "This promotion code cannot be used": {
      code: 400,
      message: "This promotion code cannot be used"
    },
    "Promotion code has already been used": {
      code: 400,
      message: "Promotion code has already been used"
    },
    "Percentage-based coupons are not supported. Only fixed amount coupons are allowed.": {
      code: 400,
      message: "Percentage-based coupons are not supported. Only fixed amount coupons are allowed."
    },
    "Invalid coupon type. Only fixed amount coupons are supported.": {
      code: 400,
      message: "Invalid coupon type. Only fixed amount coupons are supported."
    }
  };

  private readonly PAYMENT_ERRORS = {
    "Final amount after discount must be at least $1": {
      code: 400,
      message: "Final amount after discount must be at least $1"
    },
    "Minimum payment amount is $20 (before any discounts)": {
      code: 400,
      message: "Minimum payment amount is $20 (before any discounts)"
    },
    "Payment method does not belong to the user": {
      code: 403,
      message: "Payment method does not belong to the user"
    },
    "Payment not successful": {
      code: 402,
      message: "Payment not successful"
    },
    "Payment account not properly configured. Please contact support.": {
      code: 500,
      message: "Payment account not properly configured. Please contact support."
    },
    "Coupon ID is required": {
      code: 400,
      message: "Coupon ID is required"
    },
    "Duplicate card validation request detected. Please wait before retrying.": {
      code: 429,
      message: "Duplicate card validation request detected. Please wait before retrying."
    },
    "Card validation failed. Please ensure your payment method is valid and try again.": {
      code: 400,
      message: "Card validation failed. Please ensure your payment method is valid and try again."
    }
  };

  public toAppError(error: unknown, context: "coupon" | "payment" = "payment"): HttpError | Error {
    // Ensure error is an Error object
    if (!(error instanceof Error)) {
      return new Error("An unknown error occurred");
    }

    // Handle Stripe-specific errors first
    if (this.isStripeError(error)) {
      return this.handleStripeError(error);
    }

    // Handle our custom business logic errors
    const errorMap = context === "coupon" ? this.COUPON_ERRORS : this.PAYMENT_ERRORS;
    const clues = Object.keys(errorMap) as (keyof typeof errorMap)[];

    const clue = clues.find(clue => error.message.includes(clue));

    if (!clue) {
      // Return original error for unknown errors
      return error;
    }

    const { message, code } = errorMap[clue];
    const errorCode = this.getPaymentErrorCodeFromMessage(message);
    const errorType = context === "coupon" ? "coupon_error" : "payment_error";

    return createError(code, message, {
      originalError: error,
      errorCode,
      errorType
    });
  }

  public toCouponResponseError(error: unknown): { coupon: null; error: { message: string; code?: string; type?: string } } {
    const appError = this.toAppError(error, "coupon");

    // If it's a known coupon error, return it as a response error
    if (appError instanceof HttpError && appError.status >= 400 && appError.status < 500) {
      const errorCode = this.getCouponErrorCode(appError.message);
      return {
        coupon: null,
        error: {
          message: appError.message,
          code: errorCode,
          type: "coupon_error"
        }
      };
    }

    // For unknown errors, return a generic message
    return {
      coupon: null,
      error: {
        message: "Failed to apply coupon. Please check the code and try again.",
        code: "unknown_coupon_error",
        type: "coupon_error"
      }
    };
  }

  /**
   * Get error code for payment errors to be used by frontend
   */
  public getPaymentErrorCode(error: unknown): { message: string; code: string; type: string } {
    const appError = this.toAppError(error, "payment");

    if (appError instanceof HttpError) {
      const errorCode = this.getPaymentErrorCodeFromMessage(appError.message);
      return {
        message: appError.message,
        code: errorCode,
        type: "payment_error"
      };
    }

    return {
      message: "An unexpected payment error occurred",
      code: "unknown_payment_error",
      type: "payment_error"
    };
  }

  private getCouponErrorCode(message: string): string {
    const messageLower = message.toLowerCase();

    if (messageLower.includes("no valid promotion code")) {
      return "invalid_coupon_code";
    } else if (messageLower.includes("invalid") || messageLower.includes("expired")) {
      return "coupon_expired";
    } else if (messageLower.includes("already been used")) {
      return "coupon_already_used";
    } else if (messageLower.includes("cannot be used")) {
      return "coupon_not_applicable";
    } else if (messageLower.includes("percentage-based coupons are not supported")) {
      return "percentage_coupon_not_supported";
    } else if (messageLower.includes("invalid coupon type")) {
      return "invalid_coupon_type";
    }

    return "unknown_coupon_error";
  }

  private getPaymentErrorCodeFromMessage(message: string): string {
    const messageLower = message.toLowerCase();

    if (messageLower.includes("insufficient funds")) {
      return "insufficient_funds";
    } else if (messageLower.includes("expired")) {
      return "card_expired";
    } else if (messageLower.includes("declined")) {
      return "card_declined";
    } else if (messageLower.includes("invalid")) {
      return "invalid_card_info";
    } else if (messageLower.includes("minimum payment amount")) {
      return "minimum_payment_amount";
    } else if (messageLower.includes("final amount after discount")) {
      return "final_amount_too_low";
    } else if (messageLower.includes("payment method does not belong")) {
      return "payment_method_not_owned";
    } else if (messageLower.includes("payment account not properly configured")) {
      return "no_stripe_customer";
    } else if (messageLower.includes("coupon id is required")) {
      return "coupon_id_required";
    } else if (messageLower.includes("duplicate card validation request")) {
      return "duplicate_validation_request";
    } else if (messageLower.includes("card validation failed")) {
      return "card_validation_failed";
    }

    return "unknown_payment_error";
  }

  public isKnownError(error: unknown, context: "coupon" | "payment" = "payment"): boolean {
    // Ensure error is an Error object
    if (!(error instanceof Error)) {
      return false;
    }

    // Check if it's a Stripe error
    if (this.isStripeError(error)) {
      return true;
    }

    // Check our custom business logic errors
    const errorMap = context === "coupon" ? this.COUPON_ERRORS : this.PAYMENT_ERRORS;
    const clues = Object.keys(errorMap) as (keyof typeof errorMap)[];

    return clues.some(clue => error.message.includes(clue));
  }

  private isStripeError(error: Error | Stripe.errors.StripeError): error is Stripe.errors.StripeError {
    return error && typeof error === "object" && "type" in error && error.type?.startsWith("Stripe");
  }

  private handleStripeError(error: Stripe.errors.StripeError): HttpError {
    switch (error.type) {
      case "StripeCardError":
        return this.handleCardError(error as Stripe.errors.StripeCardError);
      case "StripeInvalidRequestError":
        return this.handleInvalidRequestError(error as Stripe.errors.StripeInvalidRequestError);
      case "StripeAPIError":
        return this.handleAPIError(error as Stripe.errors.StripeAPIError);
      case "StripeConnectionError":
        return this.handleConnectionError(error as Stripe.errors.StripeConnectionError);
      case "StripeAuthenticationError":
        return this.handleAuthenticationError(error as Stripe.errors.StripeAuthenticationError);
      case "StripeRateLimitError":
        return this.handleRateLimitError(error as Stripe.errors.StripeRateLimitError);
      case "StripeIdempotencyError":
        return this.handleIdempotencyError(error as Stripe.errors.StripeIdempotencyError);
      case "StripePermissionError":
        return this.handlePermissionError(error as Stripe.errors.StripePermissionError);
      case "StripeSignatureVerificationError":
        return this.handleSignatureVerificationError(error as Stripe.errors.StripeSignatureVerificationError);
      default:
        return createError(500, "An unexpected error occurred", { originalError: error });
    }
  }

  private handleCardError(error: Stripe.errors.StripeCardError): HttpError {
    // Map common card error codes to user-friendly messages
    const cardErrorMessages: Record<string, string> = {
      card_declined: "Your card was declined",
      expired_card: "Your card has expired",
      incorrect_cvc: "Invalid CVC",
      processing_error: "An error occurred while processing your card",
      insufficient_funds: "Your card has insufficient funds",
      invalid_cvc: "Invalid CVC",
      invalid_expiry_month: "Invalid expiry month",
      invalid_expiry_year: "Invalid expiry year",
      invalid_number: "Invalid card number"
    };

    // Enhanced decline code handling
    const declineCodeMessages: Record<string, string> = {
      generic_decline: "Your card was declined",
      insufficient_funds: "Your card has insufficient funds",
      lost_card: "Your card was declined",
      stolen_card: "Your card was declined",
      expired_card: "Your card has expired",
      incorrect_cvc: "Incorrect CVC",
      processing_error: "An error occurred while processing your card",
      incorrect_number: "Incorrect card number",
      fraudulent: "Your card was declined for security reasons",
      currency_not_supported: "Your card does not support this currency",
      duplicate_transaction: "A transaction with identical amount and credit card information was submitted very recently",
      card_not_supported: "Your card is not supported for this type of purchase",
      restricted_card: "Your card is not supported for this type of purchase",
      try_again_later: "The card was declined for an unknown reason",
      invalid_cvc: "The card's security code is incorrect",
      invalid_expiry_month: "The card's expiration month is incorrect",
      invalid_expiry_year: "The card's expiration year is incorrect",
      invalid_swipe_data: "The card's swipe data is invalid",
      incorrect_zip: "The card's zip code failed validation",
      incorrect_address: "The card's address failed validation",
      incorrect_pin: "The card's PIN is incorrect",
      card_velocity_exceeded: "You have exceeded the maximum number of attempts for this card",
      customer_declined: "The customer declined the payment",
      new_account_information_available: "The card was declined, but the customer should contact their bank for more information",
      no_action_taken: "The card was declined, but no specific reason was given",
      not_permitted: "The payment is not permitted",
      pickup_card: "The card has been declined for pick up",
      soft_decline: "The card was declined, but the customer should contact their bank for more information",
      withdrawal_count_limit_exceeded: "The customer has exceeded the maximum number of withdrawals for this card"
    };

    let message = (error.code && cardErrorMessages[error.code]) || error.message || "Your card was declined";

    // Use decline code message if available and more specific
    if (error.decline_code && declineCodeMessages[error.decline_code]) {
      message = declineCodeMessages[error.decline_code];
    }

    // Map Stripe error codes to our internal error codes
    let errorCode = "card_declined";
    if (error.code === "insufficient_funds" || error.decline_code === "insufficient_funds") {
      errorCode = "insufficient_funds";
    } else if (error.code === "expired_card" || error.decline_code === "expired_card") {
      errorCode = "card_expired";
    } else if (error.code === "incorrect_cvc" || error.decline_code === "incorrect_cvc") {
      errorCode = "invalid_card_info";
    } else if (error.code === "invalid_number" || error.decline_code === "incorrect_number") {
      errorCode = "invalid_card_info";
    }

    return createError(402, message, {
      originalError: error,
      errorCode,
      errorType: "payment_error"
    });
  }

  private handleInvalidRequestError(error: Stripe.errors.StripeInvalidRequestError): HttpError {
    // Handle specific invalid request errors
    if (error.param) {
      return createError(400, `Invalid ${error.param}: ${error.message}`, {
        originalError: error,
        errorCode: "validation_error",
        errorType: "validation_error"
      });
    }
    return createError(400, error.message || "Invalid request", {
      originalError: error,
      errorCode: "bad_request",
      errorType: "validation_error"
    });
  }

  private handleAPIError(error: Stripe.errors.StripeAPIError): HttpError {
    return createError(502, "Payment service temporarily unavailable. Please try again later.", {
      originalError: error,
      retryable: true,
      errorCode: "service_unavailable",
      errorType: "server_error"
    });
  }

  private handleConnectionError(error: Stripe.errors.StripeConnectionError): HttpError {
    return createError(503, "Unable to connect to payment service. Please try again.", {
      originalError: error,
      retryable: true,
      errorCode: "service_unavailable",
      errorType: "server_error"
    });
  }

  private handleAuthenticationError(error: Stripe.errors.StripeAuthenticationError): HttpError {
    return createError(500, "Payment service configuration error", {
      originalError: error,
      errorCode: "internal_server_error",
      errorType: "server_error"
    });
  }

  private handleRateLimitError(error: Stripe.errors.StripeRateLimitError): HttpError {
    return createError(429, "Too many requests. Please try again later.", {
      originalError: error,
      retryable: true,
      errorCode: "rate_limited",
      errorType: "client_error"
    });
  }

  private handleIdempotencyError(error: Stripe.errors.StripeIdempotencyError): HttpError {
    return createError(409, "This request conflicts with a previous request. Please try again with different parameters.", {
      originalError: error,
      errorCode: "conflict",
      errorType: "client_error"
    });
  }

  private handlePermissionError(error: Stripe.errors.StripePermissionError): HttpError {
    return createError(403, "You don't have permission to perform this action.", {
      originalError: error,
      errorCode: "forbidden",
      errorType: "authorization_error"
    });
  }

  private handleSignatureVerificationError(error: Stripe.errors.StripeSignatureVerificationError): HttpError {
    return createError(400, "Invalid webhook signature. Please check your webhook configuration.", {
      originalError: error,
      errorCode: "validation_error",
      errorType: "validation_error"
    });
  }
}
