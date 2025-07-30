import "@testing-library/jest-dom";

import React from "react";
import { act } from "react-dom/test-utils";

import { PaymentMethodContainer } from "./PaymentMethodContainer";

import { render } from "@testing-library/react";

describe("PaymentMethodContainer", () => {
  it("should render children with initial state", () => {
    const { child } = setup();

    expect(child).toHaveBeenCalledWith(
      expect.objectContaining({
        setupIntent: undefined,
        paymentMethods: [],
        showAddForm: false,
        showDeleteConfirmation: false,
        cardToDelete: undefined,
        isConnectingWallet: false,
        isLoading: false,
        isRemoving: false,
        onSuccess: expect.any(Function),
        onRemovePaymentMethod: expect.any(Function),
        onConfirmRemovePaymentMethod: expect.any(Function),
        onNext: expect.any(Function),
        onShowAddForm: expect.any(Function),
        onShowDeleteConfirmation: expect.any(Function),
        onSetCardToDelete: expect.any(Function),
        refetchPaymentMethods: expect.any(Function)
      })
    );
  });

  it("should create setup intent on mount", () => {
    const { mockCreateSetupIntent } = setup();

    expect(mockCreateSetupIntent).toHaveBeenCalled();
  });

  it("should handle payment method removal", async () => {
    const { child, mockRemovePaymentMethod } = setup();
    mockRemovePaymentMethod.mockResolvedValue(undefined);

    const { onRemovePaymentMethod } = child.mock.calls[0][0];
    await act(async () => {
      onRemovePaymentMethod("pm_123");
    });

    // Should set card to delete and show confirmation
    const { onConfirmRemovePaymentMethod } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onConfirmRemovePaymentMethod();
    });

    expect(mockRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
  });

  it("should handle payment method removal error", async () => {
    const { child, mockRemovePaymentMethod } = setup();
    mockRemovePaymentMethod.mockRejectedValue(new Error("Failed to remove"));

    const { onRemovePaymentMethod } = child.mock.calls[0][0];
    await act(async () => {
      onRemovePaymentMethod("pm_123");
    });

    const { onConfirmRemovePaymentMethod } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onConfirmRemovePaymentMethod();
    });

    expect(mockRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
    // Should still reset the state even on error
    expect(child.mock.calls[child.mock.calls.length - 1][0].showDeleteConfirmation).toBe(false);
    expect(child.mock.calls[child.mock.calls.length - 1][0].cardToDelete).toBeUndefined();
  });

  it("should handle success callback", async () => {
    const mockOnComplete = jest.fn();
    const { child, mockRefetchPaymentMethods } = setup({ onComplete: mockOnComplete });

    const { onSuccess } = child.mock.calls[0][0];
    await act(async () => {
      onSuccess();
    });

    expect(mockRefetchPaymentMethods).toHaveBeenCalled();
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("should handle next step with payment methods", async () => {
    const { child, mockConnectManagedWallet } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }]
    });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      onNext();
    });

    expect(mockConnectManagedWallet).toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(true);
  });

  it("should not proceed when no payment methods exist", async () => {
    const { child, mockConnectManagedWallet } = setup({ paymentMethods: [] });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      onNext();
    });

    expect(mockConnectManagedWallet).not.toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
  });

  it("should handle wallet connection state changes", () => {
    const { child } = setup({
      hasManagedWallet: true,
      isWalletLoading: false
    });

    // Test that the container properly tracks wallet state
    expect(child.mock.calls[0][0].isLoading).toBe(false);

    const { child: loadingChild } = setup({
      hasManagedWallet: false,
      isWalletLoading: true
    });

    expect(loadingChild.mock.calls[0][0].isLoading).toBe(true);
  });

  it("should handle state updates correctly", () => {
    const { child } = setup();

    const { onShowAddForm, onShowDeleteConfirmation, onSetCardToDelete } = child.mock.calls[0][0];

    act(() => {
      onShowAddForm(true);
    });

    expect(child.mock.calls[child.mock.calls.length - 1][0].showAddForm).toBe(true);

    act(() => {
      onShowDeleteConfirmation(true);
    });

    expect(child.mock.calls[child.mock.calls.length - 1][0].showDeleteConfirmation).toBe(true);

    act(() => {
      onSetCardToDelete("pm_123");
    });

    expect(child.mock.calls[child.mock.calls.length - 1][0].cardToDelete).toBe("pm_123");
  });

  it("should calculate loading state correctly", () => {
    const { child } = setup({ isWalletLoading: true });

    expect(child.mock.calls[0][0].isLoading).toBe(true);
  });

  it("should pass payment methods data correctly", () => {
    const paymentMethods = [
      { id: "pm_123", type: "card", card: { last4: "1234", brand: "visa" } },
      { id: "pm_456", type: "card", card: { last4: "5678", brand: "mastercard" } }
    ];

    const { child } = setup({ paymentMethods });

    expect(child.mock.calls[0][0].paymentMethods).toEqual(paymentMethods);
  });

  it("should pass setup intent data correctly", () => {
    const setupIntent = { client_secret: "seti_123", id: "seti_123" };
    const { child } = setup({ setupIntent });

    expect(child.mock.calls[0][0].setupIntent).toEqual(setupIntent);
  });

  it("should handle isRemoving state correctly", () => {
    const { child } = setup({ isRemoving: true });

    expect(child.mock.calls[0][0].isRemoving).toBe(true);
  });

  function setup(
    input: {
      paymentMethods?: any[];
      setupIntent?: any;
      hasManagedWallet?: boolean;
      isWalletLoading?: boolean;
      isConnectingWallet?: boolean;
      isRemoving?: boolean;
      onComplete?: jest.Mock;
    } = {}
  ) {
    jest.clearAllMocks();

    const mockCreateSetupIntent = jest.fn();
    const mockRefetchPaymentMethods = jest.fn();
    const mockRemovePaymentMethod = jest.fn();
    const mockConnectManagedWallet = jest.fn();

    const mockUseSetupIntentMutation = jest.fn().mockReturnValue({
      data: input.setupIntent,
      mutate: mockCreateSetupIntent
    });

    const mockUsePaymentMethodsQuery = jest.fn().mockReturnValue({
      data: input.paymentMethods || [],
      refetch: mockRefetchPaymentMethods
    });

    const mockUsePaymentMutations = jest.fn().mockReturnValue({
      removePaymentMethod: {
        mutateAsync: mockRemovePaymentMethod,
        isPending: input.isRemoving || false
      }
    });

    const mockUseWallet = jest.fn().mockReturnValue({
      connectManagedWallet: mockConnectManagedWallet,
      isWalletLoading: input.isWalletLoading || false,
      hasManagedWallet: input.hasManagedWallet || false
    });

    const dependencies = {
      useWallet: mockUseWallet,
      usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
      usePaymentMutations: mockUsePaymentMutations,
      useSetupIntentMutation: mockUseSetupIntentMutation
    };

    const mockChildren = jest.fn().mockReturnValue(<div>Test</div>);
    const mockOnComplete = input.onComplete || jest.fn();

    render(
      <PaymentMethodContainer onComplete={mockOnComplete} dependencies={dependencies}>
        {mockChildren}
      </PaymentMethodContainer>
    );

    return {
      child: mockChildren,
      mockCreateSetupIntent,
      mockRefetchPaymentMethods,
      mockRemovePaymentMethod,
      mockConnectManagedWallet,
      mockUseWallet,
      mockUsePaymentMethodsQuery,
      mockUsePaymentMutations,
      mockUseSetupIntentMutation
    };
  }
});
