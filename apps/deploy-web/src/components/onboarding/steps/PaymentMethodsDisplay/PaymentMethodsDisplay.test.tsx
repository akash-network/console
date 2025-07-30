import React from "react";

import { ServicesProvider } from "@src/context/ServicesProvider/ServicesProvider";
import type { AppError } from "@src/types";
import { PaymentMethodsDisplay } from "./PaymentMethodsDisplay";

import { fireEvent, render, screen } from "@testing-library/react";

describe("PaymentMethodsDisplay", () => {
  describe("Basic Rendering", () => {
    it("renders payment methods correctly", () => {
      setup();

      expect(screen.getByText("Payment Method Added")).toBeInTheDocument();
      expect(screen.getByText("Payment Methods")).toBeInTheDocument();
      expect(screen.getByText("•••• •••• •••• 4242")).toBeInTheDocument();
      expect(screen.getByText("•••• •••• •••• 5555")).toBeInTheDocument();
      expect(screen.getByText("visa • Expires 12/25")).toBeInTheDocument();
      expect(screen.getByText("mastercard • Expires 03/26")).toBeInTheDocument();
    });

    it("renders success alert when payment method is added", () => {
      setup();

      const successAlert = screen.getByText("Payment Method Added");
      expect(successAlert).toBeInTheDocument();
      expect(screen.getByText("Your payment method has been successfully added.")).toBeInTheDocument();
    });

    it("renders start trial button", () => {
      setup();

      expect(screen.getByRole("button", { name: "Start Trial" })).toBeInTheDocument();
    });

    it("renders terms and privacy links", () => {
      setup();

      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
    });
  });

  describe("Payment Method Interactions", () => {
    it("calls onRemovePaymentMethod when trash button is clicked", () => {
      const { mockOnRemovePaymentMethod } = setup();

      const trashButtons = screen.getAllByRole("button", { name: "" });
      fireEvent.click(trashButtons[0]);

      expect(mockOnRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
    });

    it("calls onStartTrial when start trial button is clicked", () => {
      const { mockOnStartTrial } = setup();

      const startTrialButton = screen.getByRole("button", { name: "Start Trial" });
      fireEvent.click(startTrialButton);

      expect(mockOnStartTrial).toHaveBeenCalled();
    });

    it("disables start trial button when no payment methods", () => {
      setup({ paymentMethods: [] });

      const startTrialButton = screen.getByRole("button", { name: "Start Trial" });
      expect(startTrialButton).toBeDisabled();
    });

    it("disables start trial button when loading", () => {
      setup({ isLoading: true });

      const startTrialButton = screen.getByRole("button", { name: "Starting Trial..." });
      expect(startTrialButton).toBeDisabled();
    });

    it("disables remove buttons when isRemoving is true", () => {
      setup({ isRemoving: true });

      const trashButtons = screen.getAllByRole("button", { name: "" });
      trashButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe("Error Handling", () => {
    it("does not render error alert when no error", () => {
      setup();

      expect(screen.queryByText("Failed to Start Trial")).not.toBeInTheDocument();
    });

    it("renders error alert with HTTP error response", () => {
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

      setup({ managedWalletError: httpError });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Your payment was declined")).toBeInTheDocument();
    });

    it("renders error alert with Error object", () => {
      const errorObject = new Error("Network connection failed");

      setup({ managedWalletError: errorObject });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Network connection failed")).toBeInTheDocument();
    });

    it("renders error alert with structured error object", () => {
      const structuredError: AppError = {
        message: "Invalid payment method",
        error: "invalid_payment_method",
        code: "invalid_card"
      };

      setup({ managedWalletError: structuredError });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Invalid payment method")).toBeInTheDocument();
    });

    it("renders error alert with string error", () => {
      const stringError = "Something went wrong" as unknown as AppError;

      setup({ managedWalletError: stringError });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("renders fallback error message for null error", () => {
      setup({ managedWalletError: null });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("An error occurred while starting your trial. Please try again.")).toBeInTheDocument();
    });

    it("renders fallback error message for undefined error", () => {
      setup({ managedWalletError: undefined });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("An error occurred while starting your trial. Please try again.")).toBeInTheDocument();
    });

    it("renders fallback error message for empty object error", () => {
      const emptyError = {} as unknown as AppError;

      setup({ managedWalletError: emptyError });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("An error occurred while starting your trial. Please try again.")).toBeInTheDocument();
    });

    it("renders error alert with complex HTTP error response", () => {
      const complexError: AppError = {
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

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Your card has insufficient funds")).toBeInTheDocument();
    });

    it("renders error alert with error object without message", () => {
      const errorWithoutMessage = new Error();

      setup({ managedWalletError: errorWithoutMessage });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
    });

    it("renders error alert with structured error without message", () => {
      const structuredErrorWithoutMessage: AppError = {
        message: "An error occurred. Please try again.",
        error: "unknown_error",
        code: "unknown"
      };

      setup({ managedWalletError: structuredErrorWithoutMessage });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles payment method without card details", () => {
      const paymentMethodsWithoutCard = [
        {
          id: "pm_789"
        }
      ];

      setup({ paymentMethods: paymentMethodsWithoutCard });

      expect(screen.getByText("Payment Method")).toBeInTheDocument();
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("handles mixed payment methods with and without card details", () => {
      const mixedPaymentMethods = [
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

      expect(screen.getByText("•••• •••• •••• 4242")).toBeInTheDocument();
      expect(screen.getByText("visa • Expires 12/25")).toBeInTheDocument();
      expect(screen.getByText("Payment Method")).toBeInTheDocument();
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });

    it("formats card expiry correctly for single digit month", () => {
      const paymentMethodWithSingleDigitMonth = [
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

      expect(screen.getByText("visa • Expires 03/25")).toBeInTheDocument();
    });

    it("formats card expiry correctly for double digit month", () => {
      const paymentMethodWithDoubleDigitMonth = [
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

      expect(screen.getByText("visa • Expires 12/25")).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("shows loading state on start trial button", () => {
      setup({ isLoading: true });

      expect(screen.getByRole("button", { name: "Starting Trial..." })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Start Trial" })).not.toBeInTheDocument();
    });

    it("disables interactions during loading", () => {
      setup({ isLoading: true });

      const startTrialButton = screen.getByRole("button", { name: "Starting Trial..." });
      expect(startTrialButton).toBeDisabled();
    });

    it("disables remove buttons during removal", () => {
      setup({ isRemoving: true });

      const trashButtons = screen.getAllByRole("button", { name: "" });
      trashButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  function setup(
    input: {
      paymentMethods?: any[];
      onRemovePaymentMethod?: jest.Mock;
      onStartTrial?: jest.Mock;
      isLoading?: boolean;
      isRemoving?: boolean;
      managedWalletError?: AppError;
    } = {}
  ) {
    const mockPaymentMethods = [
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

    const defaultProps = {
      paymentMethods: mockPaymentMethods,
      onRemovePaymentMethod: jest.fn(),
      onStartTrial: jest.fn(),
      isLoading: false,
      isRemoving: false
    };

    jest.clearAllMocks();

    const mockOnRemovePaymentMethod = input.onRemovePaymentMethod || jest.fn();
    const mockOnStartTrial = input.onStartTrial || jest.fn();

    const mockUrlService = () =>
      ({
        termsOfService: jest.fn().mockReturnValue("/terms"),
        privacyPolicy: jest.fn().mockReturnValue("/privacy")
      }) as any;

    const props = {
      ...defaultProps,
      ...input,
      onRemovePaymentMethod: mockOnRemovePaymentMethod,
      onStartTrial: mockOnStartTrial
    };

    render(
      <ServicesProvider services={{ urlService: mockUrlService }}>
        <PaymentMethodsDisplay {...props} />
      </ServicesProvider>
    );

    return {
      mockOnRemovePaymentMethod,
      mockOnStartTrial,
      mockUrlService
    };
  }
});
