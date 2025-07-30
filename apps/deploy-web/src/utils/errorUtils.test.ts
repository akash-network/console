import type { AppError, ErrorResponse } from "@src/types";
import { extractErrorData, extractErrorMessage, isHttpErrorResponse } from "./errorUtils";

describe("errorUtils", () => {
  describe("extractErrorMessage", () => {
    it("returns fallback message for null error", () => {
      const result = extractErrorMessage(null);
      expect(result).toBe("An error occurred. Please try again.");
    });

    it("returns fallback message for undefined error", () => {
      const result = extractErrorMessage(undefined as unknown as AppError);
      expect(result).toBe("An error occurred. Please try again.");
    });

    it("extracts message from HTTP error response", () => {
      const httpError: AppError = {
        response: {
          data: {
            error: "payment_failed",
            message: "Your payment was declined",
            code: "card_declined"
          },
          status: 402,
          statusText: "Payment Required"
        }
      };

      const result = extractErrorMessage(httpError);
      expect(result).toBe("Your payment was declined");
    });

    it("returns fallback message when HTTP error has no message", () => {
      const httpError: AppError = {
        response: {
          data: {
            error: "payment_failed",
            message: "",
            code: "card_declined"
          },
          status: 402,
          statusText: "Payment Required"
        }
      };

      const result = extractErrorMessage(httpError);
      expect(result).toBe("An error occurred. Please try again.");
    });

    it("extracts message from Error object", () => {
      const errorObject = new Error("Network connection failed");
      const result = extractErrorMessage(errorObject);
      expect(result).toBe("Network connection failed");
    });

    it("returns fallback message when Error object has no message", () => {
      const errorObject = new Error();
      const result = extractErrorMessage(errorObject);
      expect(result).toBe("An error occurred. Please try again.");
    });

    it("extracts message from structured error object", () => {
      const structuredError: AppError = {
        message: "Invalid payment method",
        error: "invalid_payment_method",
        code: "invalid_card"
      };

      const result = extractErrorMessage(structuredError);
      expect(result).toBe("Invalid payment method");
    });

    it("returns fallback message when structured error has no message", () => {
      const structuredError: AppError = {
        message: "",
        error: "invalid_payment_method",
        code: "invalid_card"
      };

      const result = extractErrorMessage(structuredError);
      expect(result).toBe("An error occurred. Please try again.");
    });

    it("converts string error to string", () => {
      const stringError = "Something went wrong";
      const result = extractErrorMessage(stringError as unknown as AppError);
      expect(result).toBe("Something went wrong");
    });

    it("handles empty string error", () => {
      const emptyStringError = "";
      const result = extractErrorMessage(emptyStringError as unknown as AppError);
      expect(result).toBe("An error occurred. Please try again.");
    });

    it("handles number error", () => {
      const numberError = 404;
      const result = extractErrorMessage(numberError as unknown as AppError);
      expect(result).toBe("404");
    });

    it("handles boolean error", () => {
      const booleanError = false;
      const result = extractErrorMessage(booleanError as unknown as AppError);
      expect(result).toBe("false");
    });
  });

  describe("isHttpErrorResponse", () => {
    it("returns true for HTTP error response", () => {
      const httpError: AppError = {
        response: {
          data: {
            error: "payment_failed",
            message: "Your payment was declined",
            code: "card_declined"
          },
          status: 402,
          statusText: "Payment Required"
        }
      };

      const result = isHttpErrorResponse(httpError);
      expect(result).toBe(true);
    });

    it("returns false for Error object", () => {
      const errorObject = new Error("Network connection failed");
      const result = isHttpErrorResponse(errorObject);
      expect(result).toBe(false);
    });

    it("returns false for structured error object", () => {
      const structuredError: AppError = {
        message: "Invalid payment method",
        error: "invalid_payment_method",
        code: "invalid_card"
      };

      const result = isHttpErrorResponse(structuredError);
      expect(result).toBe(false);
    });

    it("returns false for string error", () => {
      const stringError = "Something went wrong";
      const result = isHttpErrorResponse(stringError as unknown as AppError);
      expect(result).toBe(false);
    });

    it("returns false for null", () => {
      const result = isHttpErrorResponse(null);
      expect(result).toBe(false);
    });

    it("returns false for undefined", () => {
      const result = isHttpErrorResponse(undefined as unknown as AppError);
      expect(result).toBe(false);
    });

    it("returns false for object without response property", () => {
      const objectWithoutResponse = { message: "test" };
      const result = isHttpErrorResponse(objectWithoutResponse as AppError);
      expect(result).toBe(false);
    });
  });

  describe("extractErrorData", () => {
    it("extracts error data from HTTP error response", () => {
      const errorData: ErrorResponse = {
        error: "payment_failed",
        message: "Your payment was declined",
        code: "card_declined"
      };

      const httpError: AppError = {
        response: {
          data: errorData,
          status: 402,
          statusText: "Payment Required"
        }
      };

      const result = extractErrorData(httpError);
      expect(result).toEqual(errorData);
    });

    it("returns null for Error object", () => {
      const errorObject = new Error("Network connection failed");
      const result = extractErrorData(errorObject);
      expect(result).toBe(null);
    });

    it("returns null for structured error object", () => {
      const structuredError: AppError = {
        message: "Invalid payment method",
        error: "invalid_payment_method",
        code: "invalid_card"
      };

      const result = extractErrorData(structuredError);
      expect(result).toBe(null);
    });

    it("returns null for string error", () => {
      const stringError = "Something went wrong";
      const result = extractErrorData(stringError as unknown as AppError);
      expect(result).toBe(null);
    });

    it("returns null for null", () => {
      const result = extractErrorData(null);
      expect(result).toBe(null);
    });

    it("returns null for undefined", () => {
      const result = extractErrorData(undefined as unknown as AppError);
      expect(result).toBe(null);
    });
  });
});
