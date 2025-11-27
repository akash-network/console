import "@testing-library/jest-dom";

import React from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";

import type { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries";
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

    expect(mockSetPaymentMethodAsDefault.mutateAsync).toHaveBeenCalledWith(paymentMethodId);
  });

  it("calls removePaymentMethod mutation when onRemovePaymentMethod is invoked", async () => {
    const { child, mockRemovePaymentMethod } = await setup();
    const paymentMethodId = "pm_123456";

    child.onRemovePaymentMethod(paymentMethodId);

    expect(mockRemovePaymentMethod.mutateAsync).toHaveBeenCalledWith(paymentMethodId);
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

  it("sets showAddPaymentMethod to false and refetches payment methods when onAddCardSuccess is called", async () => {
    const { childCapturer, mockRefetchPaymentMethods } = await setup();

    let child = await childCapturer.awaitChild(() => true);

    // First, open the add payment method dialog
    await act(async () => {
      child.onAddPaymentMethod();
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === true);
    expect(child.showAddPaymentMethod).toBe(true);

    // Then call onAddCardSuccess
    await act(async () => {
      await child.onAddCardSuccess();
    });

    child = await childCapturer.awaitChild(c => c.showAddPaymentMethod === false);

    expect(child.showAddPaymentMethod).toBe(false);
    expect(mockRefetchPaymentMethods).toHaveBeenCalled();
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

  async function setup(
    overrides: Partial<{
      paymentMethods: PaymentMethod[] | undefined;
      isLoadingPaymentMethods: boolean;
      setupIntent: SetupIntentResponse;
    }> = {}
  ) {
    const useDefaultPaymentMethods = !Object.prototype.hasOwnProperty.call(overrides, "paymentMethods");
    const paymentMethods = useDefaultPaymentMethods ? [createMockPaymentMethod()] : overrides.paymentMethods;
    const isLoadingPaymentMethods = overrides.isLoadingPaymentMethods ?? false;
    const setupIntent = overrides.setupIntent;

    const mockRefetchPaymentMethods = jest.fn();
    const mockSetPaymentMethodAsDefault = {
      mutateAsync: jest.fn()
    };
    const mockRemovePaymentMethod = {
      mutateAsync: jest.fn()
    };
    const mockCreateSetupIntent = jest.fn();
    const mockResetSetupIntent = jest.fn();

    const mockedUsePaymentMethodsQuery = jest.fn(() => ({
      data: paymentMethods,
      isLoading: isLoadingPaymentMethods,
      refetch: mockRefetchPaymentMethods
    })) as unknown as jest.MockedFunction<typeof usePaymentMethodsQuery>;

    const mockedUsePaymentMutations = jest.fn(() => ({
      setPaymentMethodAsDefault: mockSetPaymentMethodAsDefault,
      removePaymentMethod: mockRemovePaymentMethod
    })) as unknown as jest.MockedFunction<typeof usePaymentMutations>;

    const mockedUseSetupIntentMutation = jest.fn(() => ({
      data: setupIntent,
      mutate: mockCreateSetupIntent,
      reset: mockResetSetupIntent
    })) as unknown as jest.MockedFunction<typeof useSetupIntentMutation>;

    const dependencies = {
      usePaymentMethodsQuery: mockedUsePaymentMethodsQuery,
      usePaymentMutations: mockedUsePaymentMutations,
      useSetupIntentMutation: mockedUseSetupIntentMutation
    };

    const childCapturer = createContainerTestingChildCapturer<PaymentMethodsViewProps>();

    render(<PaymentMethodsContainer dependencies={dependencies}>{props => childCapturer.renderChild(props)}</PaymentMethodsContainer>);

    const child = await childCapturer.awaitChild(() => true);

    return {
      paymentMethods,
      child,
      childCapturer,
      mockRefetchPaymentMethods,
      mockSetPaymentMethodAsDefault,
      mockRemovePaymentMethod,
      mockCreateSetupIntent,
      mockResetSetupIntent
    };
  }
});
