"use client";
import type { FC, ReactNode } from "react";
import React, { useEffect, useState } from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";

import { useWallet } from "@src/context/WalletProvider";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries/usePaymentQueries";
import type { AppError } from "@src/types";

const DEPENDENCIES = {
  useWallet,
  usePaymentMethodsQuery,
  usePaymentMutations,
  useSetupIntentMutation
};

export type PaymentMethodContainerProps = {
  children: (props: {
    setupIntent: SetupIntentResponse | undefined;
    paymentMethods: PaymentMethod[];
    showAddForm: boolean;
    showDeleteConfirmation: boolean;
    cardToDelete?: string;
    isConnectingWallet: boolean;
    isLoading: boolean;
    isRemoving: boolean;
    managedWalletError?: AppError;
    onSuccess: () => void;
    onRemovePaymentMethod: (paymentMethodId: string) => void;
    onConfirmRemovePaymentMethod: () => Promise<void>;
    onNext: () => void;
    onShowAddForm: (show: boolean) => void;
    onShowDeleteConfirmation: (show: boolean) => void;
    onSetCardToDelete: (cardId?: string) => void;
    refetchPaymentMethods: () => void;
  }) => ReactNode;
  onComplete: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodContainer: FC<PaymentMethodContainerProps> = ({ children, onComplete, dependencies: d = DEPENDENCIES }) => {
  const { data: setupIntent, mutate: createSetupIntent } = d.useSetupIntentMutation();
  const { data: paymentMethods = [], refetch: refetchPaymentMethods } = d.usePaymentMethodsQuery();
  const { removePaymentMethod } = d.usePaymentMutations();
  const { connectManagedWallet, isWalletLoading, hasManagedWallet, managedWalletError } = d.useWallet();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);

  useEffect(() => {
    if (!setupIntent) {
      createSetupIntent();
    }
  }, [setupIntent, createSetupIntent]);

  useEffect(() => {
    if (isConnectingWallet && hasManagedWallet && !isWalletLoading) {
      setIsConnectingWallet(false);
      onComplete();
    }
  }, [isConnectingWallet, hasManagedWallet, isWalletLoading, onComplete]);

  useEffect(() => {
    if (isConnectingWallet && managedWalletError) {
      setIsConnectingWallet(false);
    }
  }, [isConnectingWallet, managedWalletError]);

  const handleSuccess = () => {
    setShowAddForm(false);
    refetchPaymentMethods();
    onComplete();
  };

  const handleRemovePaymentMethod = (paymentMethodId: string) => {
    setCardToDelete(paymentMethodId);
    setShowDeleteConfirmation(true);
  };

  const confirmRemovePaymentMethod = async () => {
    if (!cardToDelete) return;

    try {
      await removePaymentMethod.mutateAsync(cardToDelete);
    } catch (error) {
      console.error("Failed to remove payment method:", error);
    } finally {
      setShowDeleteConfirmation(false);
      setCardToDelete(undefined);
    }
  };

  const handleNext = () => {
    if (paymentMethods.length === 0) {
      return;
    }

    setIsConnectingWallet(true);
    // Start the trial
    connectManagedWallet();
  };

  const isLoading = isConnectingWallet || isWalletLoading;

  return (
    <>
      {children({
        setupIntent,
        paymentMethods,
        showAddForm,
        showDeleteConfirmation,
        cardToDelete,
        isConnectingWallet,
        isLoading,
        isRemoving: removePaymentMethod.isPending,
        managedWalletError,
        onSuccess: handleSuccess,
        onRemovePaymentMethod: handleRemovePaymentMethod,
        onConfirmRemovePaymentMethod: confirmRemovePaymentMethod,
        onNext: handleNext,
        onShowAddForm: setShowAddForm,
        onShowDeleteConfirmation: setShowDeleteConfirmation,
        onSetCardToDelete: setCardToDelete,
        refetchPaymentMethods
      })}
    </>
  );
};
