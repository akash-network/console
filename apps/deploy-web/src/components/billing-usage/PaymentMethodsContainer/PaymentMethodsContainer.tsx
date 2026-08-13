import React, { useCallback } from "react";
import { usePopup } from "@akashnetwork/ui/context";

import { usePaymentMethodsQuery, usePaymentMutations, useWalletSettingsQuery } from "@src/queries";
import type { PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";

const DEPENDENCIES = {
  usePaymentMethodsQuery,
  usePaymentMutations,
  useWalletSettingsQuery,
  usePopup
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
  const { confirm } = d.usePopup();

  const onSetPaymentMethodAsDefault = useCallback(
    (id: string) => {
      paymentMutations.setPaymentMethodAsDefault.mutate(id);
    },
    [paymentMutations.setPaymentMethodAsDefault]
  );

  const onRemovePaymentMethod = useCallback(
    async (id: string) => {
      const paymentMethod = paymentMethods.find(method => method.id === id);
      const willDisableAutoTopUp = !!paymentMethod?.isDefault && isAutoReloadEnabled;

      const isConfirmed = await confirm(
        willDisableAutoTopUp
          ? {
              title: "Remove default payment method?",
              message:
                "Removing it will turn off Auto Top-Up. Your deployments may stop if your credit balance runs out, and no automatic charges will be made. You can turn Auto Top-Up back on after setting another card as default."
            }
          : {
              title: "Remove payment method?",
              message: "This payment method will be removed from your account."
            }
      );

      if (!isConfirmed) {
        return;
      }

      paymentMutations.removePaymentMethod.mutate(id);
    },
    [confirm, paymentMethods, isAutoReloadEnabled, paymentMutations.removePaymentMethod]
  );

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
        isLoadingPaymentMethods,
        isInProgress
      })}
    </>
  );
};
