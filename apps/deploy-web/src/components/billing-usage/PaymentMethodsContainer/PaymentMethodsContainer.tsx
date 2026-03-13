import React, { useCallback, useState } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation, useWalletSettingsQuery } from "@src/queries";
import type { PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";

const DEPENDENCIES = {
  usePaymentMethodsQuery,
  usePaymentMutations,
  useSetupIntentMutation,
  useWallet,
  useWalletSettingsQuery
};

type PaymentMethodsContainerProps = {
  children: (props: PaymentMethodsViewProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsContainer: React.FC<PaymentMethodsContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const {
    data: paymentMethods = [],
    isLoading: isLoadingPaymentMethods,
    refetch: refetchPaymentMethods,
    isRefetching: isRefetchingPaymentMethods
  } = d.usePaymentMethodsQuery();
  const { isTrialing } = d.useWallet();
  const { data: walletSettings } = d.useWalletSettingsQuery();
  const isAutoReloadEnabled = walletSettings?.autoReloadEnabled ?? false;
  const paymentMutations = d.usePaymentMutations();
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
    refetchPaymentMethods();
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
        isTrialing,
        isAutoReloadEnabled
      })}
    </>
  );
};
