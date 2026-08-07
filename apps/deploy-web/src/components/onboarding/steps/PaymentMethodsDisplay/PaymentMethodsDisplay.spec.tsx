import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";

import type { AppError } from "@src/types";
import { PaymentMethodsDisplay } from "./PaymentMethodsDisplay";

import { fireEvent, render, screen } from "@testing-library/react";
import { createMockPaymentMethod } from "@tests/seeders/payment";

describe("PaymentMethodsDisplay", () => {
  it("renders the title and payment methods with brand and expiry", () => {
    setup();

    expect(screen.getByText("Your Payment Method")).toBeInTheDocument();
    expect(screen.getByText("VISA •••• 4242")).toBeInTheDocument();
    expect(screen.getByText("Expires 12/2025")).toBeInTheDocument();
    expect(screen.getByText("MASTERCARD •••• 5555")).toBeInTheDocument();
    expect(screen.getByText("Expires 3/2026")).toBeInTheDocument();
  });

  it("renders the method type when card details are missing", () => {
    setup({ paymentMethods: [createMockPaymentMethod({ card: undefined })] });

    expect(screen.getByText("Card")).toBeInTheDocument();
  });

  it("renders the empty state when there are no payment methods", () => {
    setup({ paymentMethods: [] });

    expect(screen.getByText("No Payment Methods")).toBeInTheDocument();
    expect(screen.getByText("You need to add a payment method to continue.")).toBeInTheDocument();
  });

  it("renders terms and privacy links", () => {
    setup();

    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });

  it("calls onRemovePaymentMethod with the method id when remove is clicked", () => {
    const { onRemovePaymentMethod } = setup();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(onRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
  });

  it("disables remove buttons while removal is in progress", () => {
    setup({ isRemoving: true });

    screen.getAllByRole("button", { name: "Remove" }).forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it("calls onStartTrial when start trial is clicked", () => {
    const { onStartTrial } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Start Trial" }));

    expect(onStartTrial).toHaveBeenCalled();
  });

  it("disables start trial when there is no payment method", () => {
    setup({ paymentMethods: [], hasPaymentMethod: false });

    expect(screen.getByRole("button", { name: "Start Trial" })).toBeDisabled();
  });

  it("shows a disabled loading button while the trial is starting", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("button", { name: /Starting Trial/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Start Trial" })).not.toBeInTheDocument();
  });

  describe("error alert", () => {
    it("does not render when there is no error", () => {
      setup();

      expect(screen.queryByText("Failed to Start Trial")).not.toBeInTheDocument();
    });

    it("renders the message from an HTTP error response", () => {
      setup({
        walletError: {
          response: {
            data: { error: "payment_failed", message: "Your payment was declined", code: "card_declined" },
            status: 402,
            statusText: "Payment Required"
          }
        }
      });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Your payment was declined")).toBeInTheDocument();
    });

    it("renders the message from an Error object", () => {
      setup({ walletError: new Error("Network connection failed") });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Network connection failed")).toBeInTheDocument();
    });

    it("renders the message from a structured error object", () => {
      setup({ walletError: { message: "Invalid payment method", error: "invalid_payment_method", code: "invalid_card" } });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Invalid payment method")).toBeInTheDocument();
    });

    it("renders a string error as-is", () => {
      setup({ walletError: "Something went wrong" as unknown as AppError });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("renders a fallback message when the error has no message", () => {
      setup({ walletError: new Error() });

      expect(screen.getByText("Failed to Start Trial")).toBeInTheDocument();
      expect(screen.getByText("An error occurred. Please try again.")).toBeInTheDocument();
    });
  });

  function setup(
    input: { paymentMethods?: PaymentMethod[]; isLoading?: boolean; isRemoving?: boolean; walletError?: AppError; hasPaymentMethod?: boolean } = {}
  ) {
    const onRemovePaymentMethod = vi.fn();
    const onStartTrial = vi.fn();

    render(
      <PaymentMethodsDisplay
        paymentMethods={
          input.paymentMethods ?? [
            createMockPaymentMethod({ id: "pm_123", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2025, funding: "credit" } }),
            createMockPaymentMethod({ id: "pm_456", card: { brand: "mastercard", last4: "5555", exp_month: 3, exp_year: 2026, funding: "credit" } })
          ]
        }
        onRemovePaymentMethod={onRemovePaymentMethod}
        onStartTrial={onStartTrial}
        isLoading={input.isLoading ?? false}
        isRemoving={input.isRemoving ?? false}
        walletError={input.walletError}
        hasPaymentMethod={input.hasPaymentMethod ?? true}
      />
    );

    return { onRemovePaymentMethod, onStartTrial };
  }
});
