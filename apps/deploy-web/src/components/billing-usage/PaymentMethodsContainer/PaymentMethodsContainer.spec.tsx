import React from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk";
import type { usePopup } from "@akashnetwork/ui/context";
import { describe, expect, it, type MockedFunction, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { usePaymentMethodsQuery, usePaymentMutations, useRefreshPaymentMethods, useSetupIntentMutation, useWalletSettingsQuery } from "@src/queries";
import type { PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";
import { PaymentMethodsContainer } from "./PaymentMethodsContainer";

import { act, render } from "@testing-library/react";
import { createMockPaymentMethod, createMockSetupIntentResponse } from "@tests/seeders/payment";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

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

    expect(mockSetPaymentMethodAsDefault.mutate).toHaveBeenCalledWith(paymentMethodId);
  });

  it("calls removePaymentMethod mutation when the removal is confirmed", async () => {
    const { child, mockRemovePaymentMethod } = await setup();
    const paymentMethodId = "pm_123456";

    await child.onRemovePaymentMethod(paymentMethodId);

    expect(mockRemovePaymentMethod.mutate).toHaveBeenCalledWith(paymentMethodId);
  });

  it("does not remove the payment method when the confirmation is cancelled", async () => {
    const { child, mockRemovePaymentMethod, mockConfirm } = await setup({ confirmResult: false });

    await child.onRemovePaymentMethod("pm_123456");

    expect(mockConfirm).toHaveBeenCalled();
    expect(mockRemovePaymentMethod.mutate).not.toHaveBeenCalled();
  });

  it("initializes showAddPaymentMethod as false", async () => {
    const { child } = await setup();
    expect(child.showAddPaymentMethod).toBe(false);
  });

  it("calls createSetupIntent and sets showAddPaymentMethod to true when onAddPaymentMethod is invoked", async () => {
    const { childCapturer, mockCreateSetupIntent, mockResetSetupIntent } = await setup();

    let child = await childCapturer.awaitChild(() => true);

    await act(async () => {
      child.onAddPaymentMethod();
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === true);

    expect(mockResetSetupIntent).toHaveBeenCalled();
    expect(mockCreateSetupIntent).toHaveBeenCalled();
    expect(child.showAddPaymentMethod).toBe(true);
  });

  it("passes setupIntent data to children", async () => {
    const setupIntent = createMockSetupIntentResponse();
    const { child } = await setup({ setupIntent });
    expect(child.setupIntent).toEqual(setupIntent);
  });

  it("sets showAddPaymentMethod to false and refreshes payment methods when onAddCardSuccess is called", async () => {
    const { childCapturer, mockRefreshPaymentMethods } = await setup();

    let child = await childCapturer.awaitChild(() => true);

    await act(async () => {
      child.onAddPaymentMethod();
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === true);
    expect(child.showAddPaymentMethod).toBe(true);

    await act(async () => {
      await child.onAddCardSuccess();
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === false);

    expect(child.showAddPaymentMethod).toBe(false);
    expect(mockRefreshPaymentMethods).toHaveBeenCalled();
  });

  it("allows setShowAddPaymentMethod to update state", async () => {
    const { childCapturer } = await setup();

    let child = await childCapturer.awaitChild(() => true);
    expect(child.showAddPaymentMethod).toBe(false);

    await act(async () => {
      child.setShowAddPaymentMethod(true);
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === true);
    expect(child.showAddPaymentMethod).toBe(true);

    await act(async () => {
      child.setShowAddPaymentMethod(false);
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === false);
    expect(child.showAddPaymentMethod).toBe(false);
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
    expect(mockRemovePaymentMethod.mutate).toHaveBeenCalledWith("pm_default");
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

  async function setup(
    overrides: Partial<{
      paymentMethods: PaymentMethod[] | undefined;
      isLoadingPaymentMethods: boolean;
      isRefetchingPaymentMethods: boolean;
      isSetPaymentMethodAsDefaultPending: boolean;
      isRemovePaymentMethodPending: boolean;
      setupIntent: SetupIntentResponse;
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
    const setupIntent = overrides.setupIntent;

    const mockRefreshPaymentMethods = vi.fn().mockResolvedValue(undefined);
    const mockSetPaymentMethodAsDefault = {
      mutate: vi.fn(),
      isPending: isSetPaymentMethodAsDefaultPending
    };
    const mockRemovePaymentMethod = {
      mutate: vi.fn(),
      isPending: isRemovePaymentMethodPending
    };
    const mockCreateSetupIntent = vi.fn();
    const mockResetSetupIntent = vi.fn();

    const mockedUsePaymentMethodsQuery = vi.fn(() => ({
      data: paymentMethods,
      isLoading: isLoadingPaymentMethods,
      isRefetching: isRefetchingPaymentMethods
    })) as unknown as MockedFunction<typeof usePaymentMethodsQuery>;

    const mockedUsePaymentMutations = vi.fn(() => ({
      setPaymentMethodAsDefault: mockSetPaymentMethodAsDefault,
      removePaymentMethod: mockRemovePaymentMethod
    })) as unknown as MockedFunction<typeof usePaymentMutations>;

    const mockedUseRefreshPaymentMethods = vi.fn(() => mockRefreshPaymentMethods) as unknown as MockedFunction<typeof useRefreshPaymentMethods>;

    const mockedUseSetupIntentMutation = vi.fn(() => ({
      data: setupIntent,
      mutate: mockCreateSetupIntent,
      reset: mockResetSetupIntent
    })) as unknown as MockedFunction<typeof useSetupIntentMutation>;

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
      useRefreshPaymentMethods: mockedUseRefreshPaymentMethods,
      useSetupIntentMutation: mockedUseSetupIntentMutation,
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
      mockRefreshPaymentMethods,
      mockSetPaymentMethodAsDefault,
      mockRemovePaymentMethod,
      mockCreateSetupIntent,
      mockResetSetupIntent,
      mockConfirm
    };
  }
});
