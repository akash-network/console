import React from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

import { PaymentMethodContainer } from "./PaymentMethodContainer";

import { act, render } from "@testing-library/react";

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
    // State should remain unchanged on error (component doesn't reset state on error)
    expect(child.mock.calls[child.mock.calls.length - 1][0].showDeleteConfirmation).toBe(true);
    expect(child.mock.calls[child.mock.calls.length - 1][0].cardToDelete).toBe("pm_123");
  });

  it("should handle success callback", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockRefetchPaymentMethods } = setup({ onComplete: mockOnComplete });

    const { onSuccess } = child.mock.calls[0][0];
    await act(async () => {
      onSuccess();
    });

    expect(mockRefetchPaymentMethods).toHaveBeenCalled();
    // onSuccess only refetches payment methods, doesn't call onComplete
    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  it("should handle next step with payment methods", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockCreateWallet } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }],
      onComplete: mockOnComplete
    });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      await onNext();
    });

    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("should not proceed when no payment methods exist", async () => {
    const { child, mockCreateWallet } = setup({ paymentMethods: [] });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      onNext();
    });

    expect(mockCreateWallet).not.toHaveBeenCalled();
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

  it("should calculate hasValidatedCard correctly", () => {
    const paymentMethods = [
      { id: "pm_123", type: "card", validated: true },
      { id: "pm_456", type: "card", validated: false }
    ];
    const { child } = setup({ paymentMethods });

    expect(child.mock.calls[0][0].hasValidatedCard).toBe(true);
  });

  it("should calculate hasValidatedCard as false when no validated cards", () => {
    const paymentMethods = [
      { id: "pm_123", type: "card", validated: false },
      { id: "pm_456", type: "card", validated: false }
    ];
    const { child } = setup({ paymentMethods });

    expect(child.mock.calls[0][0].hasValidatedCard).toBe(false);
  });

  it("should calculate hasPaymentMethod correctly", () => {
    const paymentMethods = [{ id: "pm_123", type: "card" }];
    const { child } = setup({ paymentMethods });

    expect(child.mock.calls[0][0].hasPaymentMethod).toBe(true);
  });

  it("should calculate hasPaymentMethod as false when no payment methods", () => {
    const { child } = setup({ paymentMethods: [] });

    expect(child.mock.calls[0][0].hasPaymentMethod).toBe(false);
  });

  it("should handle wallet creation error", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockCreateWallet } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }],
      onComplete: mockOnComplete
    });
    mockCreateWallet.mockRejectedValue(new Error("Wallet creation failed"));

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      await onNext();
    });

    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
    expect(mockOnComplete).not.toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
  });

  it("should handle wallet creation when user ID is not available", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockCreateWallet } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }],
      onComplete: mockOnComplete,
      user: null
    });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      await onNext();
    });

    expect(mockCreateWallet).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
  });

  it("should handle 3D Secure required scenario", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockCreateWallet, mockStart3DSecure } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }],
      onComplete: mockOnComplete
    });
    mockCreateWallet.mockResolvedValue({
      requires3DS: true,
      clientSecret: "cs_test_123",
      paymentIntentId: "pi_test_123",
      paymentMethodId: "pm_test_123"
    });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      await onNext();
    });

    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
    expect(mockStart3DSecure).toHaveBeenCalledWith({
      clientSecret: "cs_test_123",
      paymentIntentId: "pi_test_123",
      paymentMethodId: "pm_test_123"
    });
    expect(mockOnComplete).not.toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
  });

  it("should handle 3D Secure validation failure - missing clientSecret", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockCreateWallet, mockStart3DSecure } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }],
      onComplete: mockOnComplete
    });
    mockCreateWallet.mockResolvedValue({
      requires3DS: true,
      clientSecret: "",
      paymentIntentId: "pi_test_123",
      paymentMethodId: "pm_test_123"
    });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      await onNext();
    });

    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
    expect(mockStart3DSecure).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
  });

  it("should handle 3D Secure validation failure - missing payment IDs", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockCreateWallet, mockStart3DSecure } = setup({
      paymentMethods: [{ id: "pm_123", type: "card" }],
      onComplete: mockOnComplete
    });
    mockCreateWallet.mockResolvedValue({
      requires3DS: true,
      clientSecret: "cs_test_123",
      paymentIntentId: "",
      paymentMethodId: ""
    });

    const { onNext } = child.mock.calls[0][0];
    await act(async () => {
      await onNext();
    });

    expect(mockCreateWallet).toHaveBeenCalledWith("user_123");
    expect(mockStart3DSecure).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
    expect(child.mock.calls[child.mock.calls.length - 1][0].isConnectingWallet).toBe(false);
  });

  it("should pass threeDSecure data correctly", () => {
    const { child } = setup();

    const { threeDSecure } = child.mock.calls[0][0];
    expect(threeDSecure).toEqual({
      isOpen: false,
      threeDSData: null,
      start3DSecure: expect.any(Function),
      close3DSecure: expect.any(Function),
      handle3DSSuccess: expect.any(Function),
      handle3DSError: expect.any(Function)
    });
  });

  function setup(
    input: {
      paymentMethods?: any[];
      setupIntent?: any;
      hasManagedWallet?: boolean;
      isWalletLoading?: boolean;
      isConnectingWallet?: boolean;
      isRemoving?: boolean;
      onComplete?: Mock;
      user?: { id: string } | null;
      managedWalletError?: Error;
    } = {}
  ) {
    vi.clearAllMocks();

    const mockCreateSetupIntent = vi.fn();
    const mockRefetchPaymentMethods = vi.fn();
    const mockRemovePaymentMethod = vi.fn();
    const mockConnectManagedWallet = vi.fn();

    const mockUseSetupIntentMutation = vi.fn().mockReturnValue({
      data: input.setupIntent,
      mutate: mockCreateSetupIntent,
      reset: vi.fn()
    });

    const mockUsePaymentMethodsQuery = vi.fn().mockReturnValue({
      data: input.paymentMethods || [],
      refetch: mockRefetchPaymentMethods
    });

    const mockUsePaymentMutations = vi.fn().mockReturnValue({
      removePaymentMethod: {
        mutateAsync: mockRemovePaymentMethod,
        isPending: input.isRemoving || false
      }
    });

    const mockUseWallet = vi.fn().mockReturnValue({
      connectManagedWallet: mockConnectManagedWallet,
      isWalletLoading: input.isWalletLoading || false,
      hasManagedWallet: input.hasManagedWallet || false,
      managedWalletError: input.managedWalletError
    });

    const mockCreateWallet = vi.fn().mockResolvedValue({});
    const mockUseCreateManagedWalletMutation = vi.fn().mockReturnValue({
      mutateAsync: mockCreateWallet
    });

    const mockStart3DSecure = vi.fn();
    const mockHandle3DSSuccess = vi.fn();
    const mockHandle3DSError = vi.fn();
    const mockUse3DSecure = vi.fn().mockReturnValue({
      isOpen: false,
      threeDSData: null,
      start3DSecure: mockStart3DSecure,
      close3DSecure: vi.fn(),
      handle3DSSuccess: mockHandle3DSSuccess,
      handle3DSError: mockHandle3DSError
    });

    const mockUseUser = vi.fn().mockReturnValue({
      user: input.user !== undefined ? input.user : { id: "user_123" }
    });

    const dependencies = {
      useWallet: mockUseWallet,
      useUser: mockUseUser,
      usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
      usePaymentMutations: mockUsePaymentMutations,
      useSetupIntentMutation: mockUseSetupIntentMutation,
      useCreateManagedWalletMutation: mockUseCreateManagedWalletMutation,
      use3DSecure: mockUse3DSecure
    };

    const mockChildren = vi.fn().mockReturnValue(<div>Test</div>);
    const mockOnComplete = input.onComplete || vi.fn();

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
      mockCreateWallet,
      mockStart3DSecure,
      mockHandle3DSSuccess,
      mockHandle3DSError,
      mockUseWallet,
      mockUsePaymentMethodsQuery,
      mockUsePaymentMutations,
      mockUseSetupIntentMutation
    };
  }
});
