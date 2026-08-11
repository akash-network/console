import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { describe, expect, it, type Mock, vi } from "vitest";

import type { PaymentMethodsRowProps } from "./PaymentMethodsRow";
import { PaymentMethodsView } from "./PaymentMethodsView";

import { fireEvent, render, screen } from "@testing-library/react";
import { createMockPaymentMethod } from "@tests/seeders/payment";

const MockPaymentMethodsRow = ({ paymentMethod, onSetPaymentMethodAsDefault, onRemovePaymentMethod, isDisabled }: PaymentMethodsRowProps) => (
  <div data-testid={`payment-method-row-${paymentMethod.id}`}>
    <span>{paymentMethod.card?.last4}</span>
    <button disabled={isDisabled} onClick={() => onSetPaymentMethodAsDefault(paymentMethod.id)}>
      Set as Default
    </button>
    <button disabled={isDisabled} onClick={() => onRemovePaymentMethod(paymentMethod.id)}>
      Remove
    </button>
  </div>
);

const Passthrough = ({ children }: any) => <div>{children}</div>;
const MockSkeleton = ({ className }: any) => <div data-testid="skeleton" className={className} />;
const MockButton = ({ children, onClick, disabled }: any) => (
  <button onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

describe(PaymentMethodsView.name, () => {
  it("renders the header title and description", () => {
    setup();

    expect(screen.getByText("Payment Method")).toBeInTheDocument();
    expect(screen.getByText("All transactions will be made using your default card.")).toBeInTheDocument();
  });

  it("renders a row for each payment method", () => {
    setup({ data: createMockPaymentMethods() });

    expect(screen.getByTestId("payment-method-row-pm_123")).toBeInTheDocument();
    expect(screen.getByTestId("payment-method-row-pm_456")).toBeInTheDocument();
  });

  it("shows the empty state when there are no payment methods", () => {
    setup({ data: [] });

    expect(screen.getByText("No payment methods added yet.")).toBeInTheDocument();
    expect(screen.queryByTestId(/payment-method-row-/)).not.toBeInTheDocument();
  });

  it("opens the add-payment-method flow when the add button is clicked", () => {
    const { openAddPaymentMethod } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Add Payment Method" }));

    expect(openAddPaymentMethod).toHaveBeenCalledTimes(1);
  });

  it("disables the add button while an operation is in progress", () => {
    setup({ isInProgress: true });

    expect(screen.getByRole("button", { name: "Add Payment Method" })).toBeDisabled();
  });

  it("disables each row's actions while an operation is in progress", () => {
    setup({ data: createMockPaymentMethods(), isInProgress: true });

    expect(screen.getAllByText("Set as Default")[0]).toBeDisabled();
    expect(screen.getAllByText("Remove")[0]).toBeDisabled();
  });

  it("shows skeletons and no rows on first load", () => {
    setup({ isLoadingPaymentMethods: true, data: [] });

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("No payment methods added yet.")).not.toBeInTheDocument();
    expect(screen.queryByTestId(/payment-method-row-/)).not.toBeInTheDocument();
  });

  it("calls onSetPaymentMethodAsDefault with the payment method id", () => {
    const { onSetPaymentMethodAsDefault } = setup({ data: createMockPaymentMethods() });

    fireEvent.click(screen.getAllByText("Set as Default")[0]);

    expect(onSetPaymentMethodAsDefault).toHaveBeenCalledWith("pm_123");
  });

  it("calls onRemovePaymentMethod with the payment method id", () => {
    const { onRemovePaymentMethod } = setup({ data: createMockPaymentMethods() });

    fireEvent.click(screen.getAllByText("Remove")[0]);

    expect(onRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
  });

  function createMockPaymentMethods(count = 2): PaymentMethod[] {
    const cards = [
      { id: "pm_123", last4: "4242", brand: "visa" },
      { id: "pm_456", last4: "5555", brand: "mastercard" },
      { id: "pm_789", last4: "6789", brand: "amex" }
    ];
    return cards
      .slice(0, count)
      .map(({ id, last4, brand }) =>
        createMockPaymentMethod({ id, isDefault: id === "pm_123", card: { last4, brand, exp_month: 12, exp_year: 2030, funding: "credit" } })
      );
  }

  function setup(
    input: {
      data?: PaymentMethod[];
      isLoadingPaymentMethods?: boolean;
      isInProgress?: boolean;
      onSetPaymentMethodAsDefault?: Mock;
      onRemovePaymentMethod?: Mock;
      openAddPaymentMethod?: Mock;
    } = {}
  ) {
    const openAddPaymentMethod = input.openAddPaymentMethod ?? vi.fn();
    const onSetPaymentMethodAsDefault = input.onSetPaymentMethodAsDefault ?? vi.fn();
    const onRemovePaymentMethod = input.onRemovePaymentMethod ?? vi.fn();

    const dependencies: any = {
      useBillingActions: () => ({ openAddPaymentMethod }),
      PaymentMethodsRow: MockPaymentMethodsRow,
      Card: Passthrough,
      CardHeader: Passthrough,
      CardContent: Passthrough,
      Skeleton: MockSkeleton,
      Button: MockButton
    };

    const renderResult = render(
      <PaymentMethodsView
        data={input.data ?? createMockPaymentMethods()}
        onSetPaymentMethodAsDefault={onSetPaymentMethodAsDefault}
        onRemovePaymentMethod={onRemovePaymentMethod}
        isLoadingPaymentMethods={input.isLoadingPaymentMethods ?? false}
        isInProgress={input.isInProgress ?? false}
        dependencies={dependencies}
      />
    );

    return { ...renderResult, openAddPaymentMethod, onSetPaymentMethodAsDefault, onRemovePaymentMethod };
  }
});
