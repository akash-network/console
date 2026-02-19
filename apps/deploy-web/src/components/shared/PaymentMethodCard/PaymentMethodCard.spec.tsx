import "@testing-library/jest-dom";

import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";

import { DEPENDENCIES, PaymentMethodCard } from "./PaymentMethodCard";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMockLinkPaymentMethod, createMockPaymentMethod } from "@tests/seeders/payment";
import { MockComponents } from "@tests/unit/mocks";

describe(PaymentMethodCard.name, () => {
  describe("when in display mode (default)", () => {
    it("renders card payment method with brand and last4", () => {
      setup({
        method: createMockPaymentMethod({
          card: { brand: "visa", last4: "4242", funding: "credit", exp_month: 12, exp_year: 2025 }
        })
      });

      expect(screen.getByText(/VISA •••• 4242/)).toBeInTheDocument();
      expect(screen.getByText(/Expires 12\/2025/)).toBeInTheDocument();
    });

    it("renders link payment method with email", () => {
      setup({
        method: createMockLinkPaymentMethod({ link: { email: "user@example.com" } })
      });

      expect(screen.getByText(/Link \(user@example\.com\)/)).toBeInTheDocument();
    });

    it("renders link payment method without email", () => {
      setup({
        method: createMockLinkPaymentMethod({ link: undefined })
      });

      expect(screen.getByText("Link")).toBeInTheDocument();
    });

    it("renders unknown payment method type with capitalized name", () => {
      const method: PaymentMethod = {
        id: "pm_test",
        type: "sepa_debit",
        created: Date.now(),
        validated: true
      };

      setup({ method });

      expect(screen.getByText("Sepa_debit")).toBeInTheDocument();
    });

    it("passes onRemove handler to Button with correct method id", () => {
      const onRemove = jest.fn();
      const { dependencies } = setup({
        method: createMockPaymentMethod({ id: "pm_abc" }),
        onRemove
      });

      const buttonProps = (dependencies.Button as jest.Mock).mock.calls[0][0];
      act(() => {
        buttonProps.onClick({ stopPropagation: jest.fn() });
      });

      expect(onRemove).toHaveBeenCalledWith("pm_abc");
    });

    it("passes disabled state to Button when isRemoving is true", () => {
      const { dependencies } = setup({ isRemoving: true });

      const buttonProps = (dependencies.Button as jest.Mock).mock.calls[0][0];
      expect(buttonProps.disabled).toBe(true);
    });
  });

  describe("when in selection mode", () => {
    it("renders RadioGroupItem with method id", () => {
      const { dependencies } = setup({
        isSelectable: true,
        method: createMockPaymentMethod({ id: "pm_sel" })
      });

      const radioProps = (dependencies.RadioGroupItem as jest.Mock).mock.calls[0][0];
      expect(radioProps.value).toBe("pm_sel");
      expect(radioProps.id).toBe("pm_sel");
    });

    it("calls onSelect with method id when clicked", () => {
      const onSelect = jest.fn();
      setup({
        isSelectable: true,
        onSelect,
        method: createMockPaymentMethod({ id: "pm_click" })
      });

      fireEvent.click(screen.getByText(/•••• /));

      expect(onSelect).toHaveBeenCalledWith("pm_click");
    });

    it("renders Remove button when not trialing", () => {
      const { dependencies } = setup({ isSelectable: true, isTrialing: false });

      expect((dependencies.Button as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    });

    it("does not render Remove button when trialing", () => {
      const { dependencies } = setup({ isSelectable: true, isTrialing: true });

      expect((dependencies.Button as jest.Mock).mock.calls.length).toBe(0);
    });

    it("does not show expiry for link methods", () => {
      setup({
        isSelectable: true,
        method: createMockLinkPaymentMethod()
      });

      expect(screen.queryByText(/Expires/)).not.toBeInTheDocument();
    });

    it("shows expiry for card methods", () => {
      setup({
        isSelectable: true,
        method: createMockPaymentMethod({
          card: { brand: "mastercard", last4: "1234", funding: "debit", exp_month: 3, exp_year: 2027 }
        })
      });

      expect(screen.getByText(/Expires 3\/2027/)).toBeInTheDocument();
    });
  });

  function setup(
    input: {
      method?: PaymentMethod;
      isRemoving?: boolean;
      onRemove?: jest.Mock;
      isSelectable?: boolean;
      isSelected?: boolean;
      onSelect?: jest.Mock;
      showValidationBadge?: boolean;
      isTrialing?: boolean;
    } = {}
  ) {
    const dependencies = MockComponents(DEPENDENCIES);
    const props = {
      method: createMockPaymentMethod(),
      isRemoving: false,
      onRemove: jest.fn(),
      dependencies,
      ...input
    };

    const result = render(<PaymentMethodCard {...props} />);

    return { ...result, dependencies };
  }
});
