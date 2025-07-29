import type { AppError, ErrorResponse } from "@src/types";

/**
 * Extracts a user-friendly error message from various error types
 */
export function extractErrorMessage(error: AppError): string {
  if (!error) return "An error occurred. Please try again.";

  // Handle HttpErrorResponse
  if (typeof error === "object" && error !== null && "response" in error) {
    const httpError = error as { response: { data: ErrorResponse } };
    return httpError.response.data.message || "An error occurred. Please try again.";
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message || "An error occurred. Please try again.";
  }

  // Handle structured error objects
  if (typeof error === "object" && error !== null && "message" in error) {
    const structuredError = error as { message: string };
    return structuredError.message || "An error occurred. Please try again.";
  }

  // Fallback
  return String(error) || "An error occurred. Please try again.";
}

/**
 * Checks if an error is an HTTP error response
 */
export function isHttpErrorResponse(error: AppError): error is { response: { data: ErrorResponse; status: number; statusText: string } } {
  return typeof error === "object" && error !== null && "response" in error;
}

/**
 * Extracts error data from HTTP error responses
 */
export function extractErrorData(error: AppError): ErrorResponse | null {
  if (isHttpErrorResponse(error)) {
    return error.response.data;
  }
  return null;
}
