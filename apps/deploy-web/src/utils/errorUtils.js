"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractErrorMessage = extractErrorMessage;
exports.isHttpErrorResponse = isHttpErrorResponse;
exports.extractErrorData = extractErrorData;
/**
 * Extracts a user-friendly error message from various error types
 */
function extractErrorMessage(error) {
    if (!error)
        return "An error occurred. Please try again.";
    // Handle HttpErrorResponse
    if (typeof error === "object" && error !== null && "response" in error) {
        var httpError = error;
        return httpError.response.data.message || "An error occurred. Please try again.";
    }
    // Handle Error objects
    if (error instanceof Error) {
        return error.message || "An error occurred. Please try again.";
    }
    // Handle structured error objects
    if (typeof error === "object" && error !== null && "message" in error) {
        var structuredError = error;
        return structuredError.message || "An error occurred. Please try again.";
    }
    // Fallback
    return String(error) || "An error occurred. Please try again.";
}
/**
 * Checks if an error is an HTTP error response
 */
function isHttpErrorResponse(error) {
    return typeof error === "object" && error !== null && "response" in error;
}
/**
 * Extracts error data from HTTP error responses
 */
function extractErrorData(error) {
    if (isHttpErrorResponse(error)) {
        return error.response.data;
    }
    return null;
}
