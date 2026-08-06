import React, { useCallback, useState } from "react";

import { usePaymentMethodsQuery, usePaymentMutations, useRefreshPaymentMethods, useSetupIntentMutation, useWalletSettingsQuery } from "@src/queries";
import type { PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";

const DEPENDENCIES = {
  usePaymentMethodsQuery,
  usePaymentMutations,
  useRefreshPaymentMethods,
  useSetupIntentMutation,
  useWalletSettingsQuery
};

type PaymentMethodsContainerProps = {
  children: (props: PaymentMethodsViewProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsContainer: React.FC<PaymentMethodsContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { data: paymentMethods = [], isLoading: isLoadingPaymentMethods, isRefetching: isRefetchingPaymentMethods } = d.usePaymentMethodsQuery();
  const { data: walletSettings, isLoading: isWalletSettingsLoading } = d.useWalletSettingsQuery();
  const isAutoReloadEnabled = walletSettings?.autoReloadEnabled ?? isWalletSettingsLoading;
  const paymentMutations = d.usePaymentMutations();
  const refreshPaymentMethods = d.useRefreshPaymentMethods();
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);

  const onSetPaymentMethodAsDefault = useCallback(
    (id: string) => {
      paymentMutations.setPaymentMethodAsDefault.mutate(id);
    },
    [paymentMutations.setPaymentMethodAsDefault]
  );

  const onRemovePaymentMethod = useCallback(
    (id: string) => {
      paymentMutations.removePaymentMethod.mutate(id);
    },
    [paymentMutations.removePaymentMethod]
  );

  const onAddCardSuccess = async () => {
    setShowAddPaymentMethod(false);
    await refreshPaymentMethods();
  };

  const onAddPaymentMethod = useCallback(() => {
    resetSetupIntent();
    createSetupIntent();
    setShowAddPaymentMethod(true);
  }, [createSetupIntent, resetSetupIntent]);

  const isInProgress =
    isLoadingPaymentMethods ||
    isRefetchingPaymentMethods ||
    paymentMutations.setPaymentMethodAsDefault.isPending ||
    paymentMutations.removePaymentMethod.isPending;

  return (
    <>
      {children({
        data: paymentMethods || [],
        onSetPaymentMethodAsDefault,
        onRemovePaymentMethod,
        onAddPaymentMethod,
        isLoadingPaymentMethods,
        showAddPaymentMethod,
        setShowAddPaymentMethod,
        setupIntent,
        onAddCardSuccess,
        isInProgress,
        isAutoReloadEnabled
      })}
    </>
  );
};
