import React, { useCallback, useState } from "react";

import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries";
import type { PaymentMethodsViewProps } from "../PaymentMethodsView/PaymentMethodsView";

const DEPENDENCIES = {
  usePaymentMethodsQuery,
  usePaymentMutations,
  useSetupIntentMutation
};

type PaymentMethodsContainerProps = {
  children: (props: PaymentMethodsViewProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodsContainer: React.FC<PaymentMethodsContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { data: paymentMethods = [], isLoading: isLoadingPaymentMethods, refetch: refetchPaymentMethods } = d.usePaymentMethodsQuery();
  const { setPaymentMethodAsDefault, removePaymentMethod } = d.usePaymentMutations();
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);

  const onSetPaymentMethodAsDefault = useCallback(
    (id: string) => {
      setPaymentMethodAsDefault.mutateAsync(id);
    },
    [setPaymentMethodAsDefault]
  );

  const onRemovePaymentMethod = useCallback(
    (id: string) => {
      removePaymentMethod.mutateAsync(id);
    },
    [removePaymentMethod]
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
        onAddCardSuccess
      })}
    </>
  );
};
