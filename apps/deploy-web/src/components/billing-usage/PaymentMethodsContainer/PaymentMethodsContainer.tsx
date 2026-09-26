import React, { useCallback, useState } from "react";
import { usePopup } from "@akashnetwork/ui/context";

import { usePaymentMethodsQuery, usePaymentMutations, useWalletSettingsQuery } from "@src/queries";
import { handleStripeError } from "@src/utils/stripeErrorHandler";
import type { PaymentMethodOperationError, PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";

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
  const [operationError, setOperationError] = useState<PaymentMethodOperationError | null>(null);

  const onSetPaymentMethodAsDefault = useCallback(
    (id: string) => {
      setOperationError(null);
      paymentMutations.setPaymentMethodAsDefault.mutate(id, {
        onError: error => setOperationError({ title: "Couldn't set default payment method", ...handleStripeError(error) })
      });
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

      setOperationError(null);
      paymentMutations.removePaymentMethod.mutate(id, {
        onError: error => setOperationError({ title: "Couldn't remove payment method", ...handleStripeError(error) })
      });
    },
    [confirm, paymentMethods, isAutoReloadEnabled, paymentMutations.removePaymentMethod]
  );

  const dismissOperationError = useCallback(() => setOperationError(null), []);

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
        operationError,
        onDismissOperationError: dismissOperationError,
        isLoadingPaymentMethods,
        isInProgress
      })}
    </>
  );
};
