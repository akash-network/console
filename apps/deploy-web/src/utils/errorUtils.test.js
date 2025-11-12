"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var errorUtils_1 = require("./errorUtils");
describe("errorUtils", function () {
    describe("extractErrorMessage", function () {
        it("returns fallback message for null error", function () {
            var result = (0, errorUtils_1.extractErrorMessage)(null);
            expect(result).toBe("An error occurred. Please try again.");
        });
        it("returns fallback message for undefined error", function () {
            var result = (0, errorUtils_1.extractErrorMessage)(undefined);
            expect(result).toBe("An error occurred. Please try again.");
        });
        it("extracts message from HTTP error response", function () {
            var httpError = {
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
            var result = (0, errorUtils_1.extractErrorMessage)(httpError);
            expect(result).toBe("Your payment was declined");
        });
        it("returns fallback message when HTTP error has no message", function () {
            var httpError = {
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
            var result = (0, errorUtils_1.extractErrorMessage)(httpError);
            expect(result).toBe("An error occurred. Please try again.");
        });
        it("extracts message from Error object", function () {
            var errorObject = new Error("Network connection failed");
            var result = (0, errorUtils_1.extractErrorMessage)(errorObject);
            expect(result).toBe("Network connection failed");
        });
        it("returns fallback message when Error object has no message", function () {
            var errorObject = new Error();
            var result = (0, errorUtils_1.extractErrorMessage)(errorObject);
            expect(result).toBe("An error occurred. Please try again.");
        });
        it("extracts message from structured error object", function () {
            var structuredError = {
                message: "Invalid payment method",
                error: "invalid_payment_method",
                code: "invalid_card"
            };
            var result = (0, errorUtils_1.extractErrorMessage)(structuredError);
            expect(result).toBe("Invalid payment method");
        });
        it("returns fallback message when structured error has no message", function () {
            var structuredError = {
                message: "",
                error: "invalid_payment_method",
                code: "invalid_card"
            };
            var result = (0, errorUtils_1.extractErrorMessage)(structuredError);
            expect(result).toBe("An error occurred. Please try again.");
        });
        it("converts string error to string", function () {
            var stringError = "Something went wrong";
            var result = (0, errorUtils_1.extractErrorMessage)(stringError);
            expect(result).toBe("Something went wrong");
        });
        it("handles empty string error", function () {
            var emptyStringError = "";
            var result = (0, errorUtils_1.extractErrorMessage)(emptyStringError);
            expect(result).toBe("An error occurred. Please try again.");
        });
        it("handles number error", function () {
            var numberError = 404;
            var result = (0, errorUtils_1.extractErrorMessage)(numberError);
            expect(result).toBe("404");
        });
        it("handles boolean error", function () {
            var booleanError = false;
            var result = (0, errorUtils_1.extractErrorMessage)(booleanError);
            expect(result).toBe("false");
        });
    });
    describe("isHttpErrorResponse", function () {
        it("returns true for HTTP error response", function () {
            var httpError = {
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
            var result = (0, errorUtils_1.isHttpErrorResponse)(httpError);
            expect(result).toBe(true);
        });
        it("returns false for Error object", function () {
            var errorObject = new Error("Network connection failed");
            var result = (0, errorUtils_1.isHttpErrorResponse)(errorObject);
            expect(result).toBe(false);
        });
        it("returns false for structured error object", function () {
            var structuredError = {
                message: "Invalid payment method",
                error: "invalid_payment_method",
                code: "invalid_card"
            };
            var result = (0, errorUtils_1.isHttpErrorResponse)(structuredError);
            expect(result).toBe(false);
        });
        it("returns false for string error", function () {
            var stringError = "Something went wrong";
            var result = (0, errorUtils_1.isHttpErrorResponse)(stringError);
            expect(result).toBe(false);
        });
        it("returns false for null", function () {
            var result = (0, errorUtils_1.isHttpErrorResponse)(null);
            expect(result).toBe(false);
        });
        it("returns false for undefined", function () {
            var result = (0, errorUtils_1.isHttpErrorResponse)(undefined);
            expect(result).toBe(false);
        });
        it("returns false for object without response property", function () {
            var objectWithoutResponse = { message: "test" };
            var result = (0, errorUtils_1.isHttpErrorResponse)(objectWithoutResponse);
            expect(result).toBe(false);
        });
    });
    describe("extractErrorData", function () {
        it("extracts error data from HTTP error response", function () {
            var errorData = {
                error: "payment_failed",
                message: "Your payment was declined",
                code: "card_declined"
            };
            var httpError = {
                response: {
                    data: errorData,
                    status: 402,
                    statusText: "Payment Required"
                }
            };
            var result = (0, errorUtils_1.extractErrorData)(httpError);
            expect(result).toEqual(errorData);
        });
        it("returns null for Error object", function () {
            var errorObject = new Error("Network connection failed");
            var result = (0, errorUtils_1.extractErrorData)(errorObject);
            expect(result).toBe(null);
        });
        it("returns null for structured error object", function () {
            var structuredError = {
                message: "Invalid payment method",
                error: "invalid_payment_method",
                code: "invalid_card"
            };
            var result = (0, errorUtils_1.extractErrorData)(structuredError);
            expect(result).toBe(null);
        });
        it("returns null for string error", function () {
            var stringError = "Something went wrong";
            var result = (0, errorUtils_1.extractErrorData)(stringError);
            expect(result).toBe(null);
        });
        it("returns null for null", function () {
            var result = (0, errorUtils_1.extractErrorData)(null);
            expect(result).toBe(null);
        });
        it("returns null for undefined", function () {
            var result = (0, errorUtils_1.extractErrorData)(undefined);
            expect(result).toBe(null);
        });
    });
});
