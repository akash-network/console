import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import type { usePopup } from "@akashnetwork/ui/context";
import { describe, expect, it, type MockedFunction, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { usePaymentMethodsQuery, usePaymentMutations, useWalletSettingsQuery } from "@src/queries";
import type { PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";
import { PaymentMethodsContainer } from "./PaymentMethodsContainer";

import { act, render } from "@testing-library/react";
import { createMockPaymentMethod } from "@tests/seeders/payment";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

type MutateWithCallbacks = (id: string, options?: { onError?: (error: unknown) => void }) => void;

describe(PaymentMethodsContainer.name, () => {
  it("renders payment methods data", async () => {
    const paymentMethods = [createMockPaymentMethod(), createMockPaymentMethod()];
    const { child } = await setup({ paymentMethods });
    expect(child.data).toEqual(paymentMethods);
  });

  it("passes through loading flag", async () => {
    const { child } = await setup({ isLoadingPaymentMethods: true });
    expect(child.isLoadingPaymentMethods).toBe(true);
  });

  it("uses default empty array when payment methods data is undefined", async () => {
    const { child } = await setup({ paymentMethods: undefined });
    expect(child.data).toEqual([]);
  });

  it("calls setPaymentMethodAsDefault mutation when onSetPaymentMethodAsDefault is invoked", async () => {
    const { child, mockSetPaymentMethodAsDefault } = await setup();
    const paymentMethodId = "pm_123456";

    child.onSetPaymentMethodAsDefault(paymentMethodId);

    expect(mockSetPaymentMethodAsDefault.mutate).toHaveBeenCalledWith(paymentMethodId, expect.anything());
  });

  it("calls removePaymentMethod mutation when the removal is confirmed", async () => {
    const { child, mockRemovePaymentMethod } = await setup();
    const paymentMethodId = "pm_123456";

    await child.onRemovePaymentMethod(paymentMethodId);

    expect(mockRemovePaymentMethod.mutate).toHaveBeenCalledWith(paymentMethodId, expect.anything());
  });

  it("does not remove the payment method when the confirmation is cancelled", async () => {
    const { child, mockRemovePaymentMethod, mockConfirm } = await setup({ confirmResult: false });

    await child.onRemovePaymentMethod("pm_123456");

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockRemovePaymentMethod.mutate).not.toHaveBeenCalled();
  });

  it("sets isInProgress to false when no operations are in progress", async () => {
    const { child } = await setup();
    expect(child.isInProgress).toBe(false);
  });

  it("sets isInProgress to true when isLoadingPaymentMethods is true", async () => {
    const { child } = await setup({ isLoadingPaymentMethods: true });
    expect(child.isInProgress).toBe(true);
  });

  it("sets isInProgress to true when isRefetchingPaymentMethods is true", async () => {
    const { child } = await setup({ isRefetchingPaymentMethods: true });
    expect(child.isInProgress).toBe(true);
  });

  it("sets isInProgress to true when setPaymentMethodAsDefault mutation is pending", async () => {
    const { child } = await setup({ isSetPaymentMethodAsDefaultPending: true });
    expect(child.isInProgress).toBe(true);
  });

  it("sets isInProgress to true when removePaymentMethod mutation is pending", async () => {
    const { child } = await setup({ isRemovePaymentMethodPending: true });
    expect(child.isInProgress).toBe(true);
  });

  it("sets isInProgress to true when multiple operations are in progress", async () => {
    const { child } = await setup({
      isLoadingPaymentMethods: true,
      isRefetchingPaymentMethods: true,
      isSetPaymentMethodAsDefaultPending: true
    });
    expect(child.isInProgress).toBe(true);
  });

  it("warns that auto top-up turns off when removing the default payment method while auto reload is enabled", async () => {
    const { child, mockConfirm, mockRemovePaymentMethod } = await setup({
      paymentMethods: [createMockPaymentMethod({ id: "pm_default", isDefault: true })],
      autoReloadEnabled: true
    });

    await child.onRemovePaymentMethod("pm_default");

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Remove default payment method?" }));
    expect(mockRemovePaymentMethod.mutate).toHaveBeenCalledWith("pm_default", expect.anything());
  });

  it("shows the plain removal confirmation for a non-default payment method while auto reload is enabled", async () => {
    const { child, mockConfirm } = await setup({
      paymentMethods: [createMockPaymentMethod({ id: "pm_other", isDefault: false })],
      autoReloadEnabled: true
    });

    await child.onRemovePaymentMethod("pm_other");

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Remove payment method?" }));
  });

  it("shows the plain removal confirmation for the default payment method when auto reload is disabled", async () => {
    const { child, mockConfirm } = await setup({
      paymentMethods: [createMockPaymentMethod({ id: "pm_default", isDefault: true })],
      autoReloadEnabled: false
    });

    await child.onRemovePaymentMethod("pm_default");

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Remove payment method?" }));
  });

  it("warns about auto top-up for the default payment method while wallet settings are still loading", async () => {
    const { child, mockConfirm } = await setup({
      paymentMethods: [createMockPaymentMethod({ id: "pm_default", isDefault: true })],
      isWalletSettingsLoading: true
    });

    await child.onRemovePaymentMethod("pm_default");

    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Remove default payment method?" }));
  });

  it("starts without an operation error", async () => {
    const { child } = await setup();

    expect(child.operationError).toBeNull();
  });

  it("explains why the removal failed when removing a payment method is rejected", async () => {
    const { child, childCapturer, mockRemovePaymentMethod } = await setup();
    mockRemovePaymentMethod.mutate.mockImplementation((_id, options) =>
      options?.onError?.({ response: { status: 403, data: { code: "forbidden", message: "Payment method does not belong to the user" } } })
    );

    await act(() => child.onRemovePaymentMethod("pm_123456"));

    const { operationError } = await childCapturer.awaitChild(props => props.operationError !== null);
    expect(operationError).toEqual({
      title: "Couldn't remove payment method",
      message: "You don't have permission to perform this action.",
      userAction: "Contact support if you believe this is an error."
    });
  });

  it("surfaces the api message for an uncatalogued removal failure", async () => {
    const { child, childCapturer, mockRemovePaymentMethod } = await setup();
    mockRemovePaymentMethod.mutate.mockImplementation((_id, options) =>
      options?.onError?.({ response: { status: 500, data: { code: "unknown_error", message: "Payment account not properly configured. Please contact support." } } })
    );

    await act(() => child.onRemovePaymentMethod("pm_123456"));

    const { operationError } = await childCapturer.awaitChild(props => props.operationError !== null);
    expect(operationError?.message).toBe("Payment account not properly configured. Please contact support.");
  });

  it("explains the failure when setting the default payment method is rejected", async () => {
    const { child, childCapturer, mockSetPaymentMethodAsDefault } = await setup();
    mockSetPaymentMethodAsDefault.mutate.mockImplementation((_id, options) => options?.onError?.(new Error("Network Error")));

    act(() => child.onSetPaymentMethodAsDefault("pm_123456"));

    const { operationError } = await childCapturer.awaitChild(props => props.operationError !== null);
    expect(operationError).toEqual({
      title: "Couldn't set default payment method",
      message: "An unexpected error occurred. Please try again.",
      userAction: "Try again or contact support if the problem persists."
    });
  });

  it("clears the operation error when it is dismissed", async () => {
    const { child, childCapturer, mockRemovePaymentMethod } = await setup();
    mockRemovePaymentMethod.mutate.mockImplementation((_id, options) => options?.onError?.(new Error("Network Error")));
    await act(() => child.onRemovePaymentMethod("pm_123456"));
    const childWithError = await childCapturer.awaitChild(props => props.operationError !== null);

    act(() => childWithError.onDismissOperationError());

    const dismissedChild = await childCapturer.awaitChild(props => props.operationError === null);
    expect(dismissedChild.operationError).toBeNull();
  });

  it("clears the previous operation error when another operation starts", async () => {
    const { child, childCapturer, mockRemovePaymentMethod } = await setup();
    mockRemovePaymentMethod.mutate.mockImplementationOnce((_id, options) => options?.onError?.(new Error("Network Error")));
    await act(() => child.onRemovePaymentMethod("pm_123456"));
    const childWithError = await childCapturer.awaitChild(props => props.operationError !== null);

    act(() => childWithError.onSetPaymentMethodAsDefault("pm_123456"));

    const retriedChild = await childCapturer.awaitChild(props => props.operationError === null);
    expect(retriedChild.operationError).toBeNull();
  });

  async function setup(
    overrides: Partial<{
      paymentMethods: PaymentMethod[] | undefined;
      isLoadingPaymentMethods: boolean;
      isRefetchingPaymentMethods: boolean;
      isSetPaymentMethodAsDefaultPending: boolean;
      isRemovePaymentMethodPending: boolean;
      autoReloadEnabled: boolean;
      isWalletSettingsLoading: boolean;
      confirmResult: boolean;
    }> = {}
  ) {
    const useDefaultPaymentMethods = !Object.prototype.hasOwnProperty.call(overrides, "paymentMethods");
    const paymentMethods = useDefaultPaymentMethods ? [createMockPaymentMethod()] : overrides.paymentMethods;
    const isLoadingPaymentMethods = overrides.isLoadingPaymentMethods ?? false;
    const isRefetchingPaymentMethods = overrides.isRefetchingPaymentMethods ?? false;
    const isSetPaymentMethodAsDefaultPending = overrides.isSetPaymentMethodAsDefaultPending ?? false;
    const isRemovePaymentMethodPending = overrides.isRemovePaymentMethodPending ?? false;

    const mockSetPaymentMethodAsDefault = {
      mutate: vi.fn<MutateWithCallbacks>(),
      isPending: isSetPaymentMethodAsDefaultPending
    };
    const mockRemovePaymentMethod = {
      mutate: vi.fn<MutateWithCallbacks>(),
      isPending: isRemovePaymentMethodPending
    };

    const mockedUsePaymentMethodsQuery = vi.fn(() => ({
      data: paymentMethods,
      isLoading: isLoadingPaymentMethods,
      isRefetching: isRefetchingPaymentMethods
    })) as unknown as MockedFunction<typeof usePaymentMethodsQuery>;

    const mockedUsePaymentMutations = vi.fn(() => ({
      setPaymentMethodAsDefault: mockSetPaymentMethodAsDefault,
      removePaymentMethod: mockRemovePaymentMethod
    })) as unknown as MockedFunction<typeof usePaymentMutations>;

    const walletSettingsData = Object.prototype.hasOwnProperty.call(overrides, "autoReloadEnabled")
      ? { autoReloadEnabled: overrides.autoReloadEnabled! }
      : undefined;

    const mockedUseWalletSettingsQuery = vi.fn(() => ({
      data: walletSettingsData,
      isLoading: overrides.isWalletSettingsLoading ?? false
    })) as unknown as MockedFunction<typeof useWalletSettingsQuery>;

    const mockConfirm = vi.fn().mockResolvedValue(overrides.confirmResult ?? true);
    const mockedUsePopup: typeof usePopup = () => mock<ReturnType<typeof usePopup>>({ confirm: mockConfirm });

    const dependencies = {
      usePaymentMethodsQuery: mockedUsePaymentMethodsQuery,
      usePaymentMutations: mockedUsePaymentMutations,
      useWalletSettingsQuery: mockedUseWalletSettingsQuery,
      usePopup: mockedUsePopup
    };

    const childCapturer = createContainerTestingChildCapturer<PaymentMethodsViewProps>();

    render(<PaymentMethodsContainer dependencies={dependencies}>{props => childCapturer.renderChild(props)}</PaymentMethodsContainer>);

    const child = await childCapturer.awaitChild(() => true);

    return {
      paymentMethods,
      child,
      childCapturer,
      mockSetPaymentMethodAsDefault,
      mockRemovePaymentMethod,
      mockConfirm
    };
  }
});
