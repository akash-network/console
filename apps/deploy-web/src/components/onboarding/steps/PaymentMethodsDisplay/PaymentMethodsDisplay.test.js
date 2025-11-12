"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var PaymentMethodsDisplay_1 = require("./PaymentMethodsDisplay");
var react_2 = require("@testing-library/react");
describe("PaymentMethodsDisplay", function () {
    describe("Basic Rendering", function () {
        it("renders payment methods correctly", function () {
            setup();
            expect(react_2.screen.getByText("Payment Method Added")).toBeInTheDocument();
            expect(react_2.screen.getByText("Payment Methods")).toBeInTheDocument();
            expect(react_2.screen.getByText("•••• •••• •••• 4242")).toBeInTheDocument();
            expect(react_2.screen.getByText("•••• •••• •••• 5555")).toBeInTheDocument();
            expect(react_2.screen.getByText("visa • Expires 12/25")).toBeInTheDocument();
            expect(react_2.screen.getByText("mastercard • Expires 03/26")).toBeInTheDocument();
        });
        it("renders success alert when payment method is added", function () {
            setup();
            var successAlert = react_2.screen.getByText("Payment Method Added");
            expect(successAlert).toBeInTheDocument();
            expect(react_2.screen.getByText("Your payment method has been successfully added.")).toBeInTheDocument();
        });
        it("renders start trial button", function () {
            setup();
            expect(react_2.screen.getByRole("button", { name: "Start Trial" })).toBeInTheDocument();
        });
        it("renders terms and privacy links", function () {
            setup();
            expect(react_2.screen.getByText("Terms of Service")).toBeInTheDocument();
            expect(react_2.screen.getByText("Privacy Policy")).toBeInTheDocument();
        });
    });
    describe("Payment Method Interactions", function () {
        it("calls onRemovePaymentMethod when trash button is clicked", function () {
            var mockOnRemovePaymentMethod = setup().mockOnRemovePaymentMethod;
            var trashButtons = react_2.screen.getAllByRole("button", { name: "" });
            react_2.fireEvent.click(trashButtons[0]);
            expect(mockOnRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
        });
        it("calls onStartTrial when start trial button is clicked", function () {
            var mockOnStartTrial = setup().mockOnStartTrial;
            var startTrialButton = react_2.screen.getByRole("button", { name: "Start Trial" });
            react_2.fireEvent.click(startTrialButton);
            expect(mockOnStartTrial).toHaveBeenCalled();
        });
        it("disables start trial button when no payment methods", function () {
            setup({ paymentMethods: [], hasPaymentMethod: false });
            var startTrialButton = react_2.screen.getByRole("button", { name: "Start Trial" });
            expect(startTrialButton).toBeDisabled();
        });
        it("disables start trial button when loading", function () {
            setup({ isLoading: true });
            var startTrialButton = react_2.screen.getByRole("button", { name: "Starting Trial..." });
            expect(startTrialButton).toBeDisabled();
        });
        it("disables remove buttons when isRemoving is true", function () {
            setup({ isRemoving: true });
            var trashButtons = react_2.screen.getAllByRole("button", { name: "" });
            trashButtons.forEach(function (button) {
                expect(button).toBeDisabled();
            });
        });
    });
    describe("Error Handling", function () {
        it("does not render error alert when no error", function () {
            setup();
            expect(react_2.screen.queryByText("Failed to Start Trial")).not.toBeInTheDocument();
        });
        it("renders error alert with HTTP error response", function () {
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
            setup({ managedWalletError: httpError });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("Your payment was declined")).toBeInTheDocument();
        });
        it("renders error alert with Error object", function () {
            var errorObject = new Error("Network connection failed");
            setup({ managedWalletError: errorObject });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("Network connection failed")).toBeInTheDocument();
        });
        it("renders error alert with structured error object", function () {
            var structuredError = {
                message: "Invalid payment method",
                error: "invalid_payment_method",
                code: "invalid_card"
            };
            setup({ managedWalletError: structuredError });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("Invalid payment method")).toBeInTheDocument();
        });
        it("renders error alert with string error", function () {
            var stringError = "Something went wrong";
            setup({ managedWalletError: stringError });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("Something went wrong")).toBeInTheDocument();
        });
        it("renders fallback error message for null error", function () {
            setup({ managedWalletError: null });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("An error occurred while starting your trial. Please try again.")).toBeInTheDocument();
        });
        it("renders fallback error message for undefined error", function () {
            setup({ managedWalletError: undefined });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("An error occurred while starting your trial. Please try again.")).toBeInTheDocument();
        });
        it("renders fallback error message for empty object error", function () {
            var emptyError = {};
            setup({ managedWalletError: emptyError });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("An error occurred while starting your trial. Please try again.")).toBeInTheDocument();
        });
        it("renders error alert with complex HTTP error response", function () {
            var complexError = {
                response: {
                    data: {
                        error: "insufficient_funds",
                        message: "Your card has insufficient funds",
                        code: "insufficient_funds",
                        type: "card_error",
                        data: {
                            decline_code: "insufficient_funds",
                            payment_method: "pm_123"
                        }
                    },
                    status: 402,
                    statusText: "Payment Required"
                }
            };
            setup({ managedWalletError: complexError });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("Your card has insufficient funds")).toBeInTheDocument();
        });
        it("renders error alert with error object without message", function () {
            var errorWithoutMessage = new Error();
            setup({ managedWalletError: errorWithoutMessage });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
        });
        it("renders error alert with structured error without message", function () {
            var structuredErrorWithoutMessage = {
                message: "An error occurred. Please try again.",
                error: "unknown_error",
                code: "unknown"
            };
            setup({ managedWalletError: structuredErrorWithoutMessage });
            expect(react_2.screen.getByText("Failed to Start Trial")).toBeInTheDocument();
            expect(react_2.screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
        });
    });
    describe("Edge Cases", function () {
        it("handles payment method without card details", function () {
            var paymentMethodsWithoutCard = [
                {
                    id: "pm_789"
                }
            ];
            setup({ paymentMethods: paymentMethodsWithoutCard });
            expect(react_2.screen.getByText("Payment Method")).toBeInTheDocument();
            expect(react_2.screen.getByText("N/A")).toBeInTheDocument();
        });
        it("handles mixed payment methods with and without card details", function () {
            var mixedPaymentMethods = [
                {
                    id: "pm_123",
                    card: {
                        last4: "4242",
                        brand: "visa",
                        exp_month: 12,
                        exp_year: 2025
                    }
                },
                {
                    id: "pm_789"
                }
            ];
            setup({ paymentMethods: mixedPaymentMethods });
            expect(react_2.screen.getByText("•••• •••• •••• 4242")).toBeInTheDocument();
            expect(react_2.screen.getByText("visa • Expires 12/25")).toBeInTheDocument();
            expect(react_2.screen.getByText("Payment Method")).toBeInTheDocument();
            expect(react_2.screen.getByText("N/A")).toBeInTheDocument();
        });
        it("formats card expiry correctly for single digit month", function () {
            var paymentMethodWithSingleDigitMonth = [
                {
                    id: "pm_123",
                    card: {
                        last4: "4242",
                        brand: "visa",
                        exp_month: 3,
                        exp_year: 2025
                    }
                }
            ];
            setup({ paymentMethods: paymentMethodWithSingleDigitMonth });
            expect(react_2.screen.getByText("visa • Expires 03/25")).toBeInTheDocument();
        });
        it("formats card expiry correctly for double digit month", function () {
            var paymentMethodWithDoubleDigitMonth = [
                {
                    id: "pm_123",
                    card: {
                        last4: "4242",
                        brand: "visa",
                        exp_month: 12,
                        exp_year: 2025
                    }
                }
            ];
            setup({ paymentMethods: paymentMethodWithDoubleDigitMonth });
            expect(react_2.screen.getByText("visa • Expires 12/25")).toBeInTheDocument();
        });
    });
    describe("Loading States", function () {
        it("shows loading state on start trial button", function () {
            setup({ isLoading: true });
            expect(react_2.screen.getByRole("button", { name: "Starting Trial..." })).toBeInTheDocument();
            expect(react_2.screen.queryByRole("button", { name: "Start Trial" })).not.toBeInTheDocument();
        });
        it("disables interactions during loading", function () {
            setup({ isLoading: true });
            var startTrialButton = react_2.screen.getByRole("button", { name: "Starting Trial..." });
            expect(startTrialButton).toBeDisabled();
        });
        it("disables remove buttons during removal", function () {
            setup({ isRemoving: true });
            var trashButtons = react_2.screen.getAllByRole("button", { name: "" });
            trashButtons.forEach(function (button) {
                expect(button).toBeDisabled();
            });
        });
    });
    function setup(input) {
        if (input === void 0) { input = {}; }
        var mockPaymentMethods = [
            {
                id: "pm_123",
                card: {
                    last4: "4242",
                    brand: "visa",
                    exp_month: 12,
                    exp_year: 2025
                }
            },
            {
                id: "pm_456",
                card: {
                    last4: "5555",
                    brand: "mastercard",
                    exp_month: 3,
                    exp_year: 2026
                }
            }
        ];
        var defaultProps = {
            paymentMethods: mockPaymentMethods,
            onRemovePaymentMethod: jest.fn(),
            onStartTrial: jest.fn(),
            isLoading: false,
            isRemoving: false,
            hasPaymentMethod: true
        };
        jest.clearAllMocks();
        var mockOnRemovePaymentMethod = input.onRemovePaymentMethod || jest.fn();
        var mockOnStartTrial = input.onStartTrial || jest.fn();
        var mockUrlService = function () {
            return ({
                termsOfService: jest.fn().mockReturnValue("/terms"),
                privacyPolicy: jest.fn().mockReturnValue("/privacy")
            });
        };
        var props = __assign(__assign(__assign({}, defaultProps), input), { onRemovePaymentMethod: mockOnRemovePaymentMethod, onStartTrial: mockOnStartTrial });
        (0, react_2.render)(<ServicesProvider_1.ServicesProvider services={{ urlService: mockUrlService }}>
        <PaymentMethodsDisplay_1.PaymentMethodsDisplay {...props}/>
      </ServicesProvider_1.ServicesProvider>);
        return {
            mockOnRemovePaymentMethod: mockOnRemovePaymentMethod,
            mockOnStartTrial: mockOnStartTrial,
            mockUrlService: mockUrlService
        };
    }
});
