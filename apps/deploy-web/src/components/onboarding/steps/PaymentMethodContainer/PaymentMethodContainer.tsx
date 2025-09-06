"use client";
import React, { type FC, useEffect, useState } from "react";
import type { ApiWalletWithOptional3DS } from "@akashnetwork/http-sdk";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUser } from "@src/hooks/useUser";
import { useCreateManagedWalletMutation } from "@src/queries/useManagedWalletQuery";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries/usePaymentQueries";
import type { AppError } from "@src/types/errors";
import { extractErrorMessage } from "@src/utils/errorUtils";

const DEPENDENCIES = {
  useWallet,
  usePaymentMethodsQuery,
  usePaymentMutations,
  useSetupIntentMutation,
  useCreateManagedWalletMutation
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
    hasValidatedCard: boolean;
    hasPaymentMethod: boolean;
    threeDSecureData: ApiWalletWithOptional3DS | null;
    on3DSecureSuccess: () => void;
    on3DSecureError: (error: string) => void;
  }) => React.ReactNode;
  onComplete: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodContainer: FC<PaymentMethodContainerProps> = ({ children, onComplete, dependencies: d = DEPENDENCIES }) => {
  const { data: setupIntent, mutate: createSetupIntent } = d.useSetupIntentMutation();
  const { data: paymentMethods = [], refetch: refetchPaymentMethods } = d.usePaymentMethodsQuery();
  const { removePaymentMethod } = d.usePaymentMutations();
  const { isWalletLoading, hasManagedWallet, managedWalletError } = d.useWallet();
  const { user } = useUser();
  const { enqueueSnackbar } = useSnackbar();
  const { managedWalletService } = useServices();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [threeDSecureData, setThreeDSecureData] = useState<ApiWalletWithOptional3DS | null>(null);
  const { mutateAsync: createWallet } = d.useCreateManagedWalletMutation();
  const hasValidatedCard = paymentMethods.length > 0 && paymentMethods.some(method => method.validated);
  const hasPaymentMethod = paymentMethods.length > 0;

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
  };

  const handleRemovePaymentMethod = (paymentMethodId: string) => {
    setCardToDelete(paymentMethodId);
    setShowDeleteConfirmation(true);
  };

  const confirmRemovePaymentMethod = async () => {
    if (!cardToDelete) return;

    try {
      await removePaymentMethod.mutateAsync(cardToDelete);
      // Success - close the modal and refresh payment methods
      setShowDeleteConfirmation(false);
      setCardToDelete(undefined);
      await refetchPaymentMethods();
    } catch (error) {
      console.error("Failed to remove payment method:", error);
      // Extract error message using the existing utility
      const errorMessage = extractErrorMessage(error as AppError);

      // Show error in snackbar
      enqueueSnackbar(errorMessage, {
        variant: "error",
        autoHideDuration: 5000
      });
    }
  };

  const handleNext = async () => {
    if (paymentMethods.length === 0) {
      return;
    }

    setIsConnectingWallet(true);

    if (!user?.id) {
      console.error("User ID not available");
      setIsConnectingWallet(false);
      return;
    }

    try {
      const result = await createWallet(user.id);

      // Check if it's a 3D Secure response
      if ("requires3DS" in result && result.requires3DS) {
        setThreeDSecureData(result as ApiWalletWithOptional3DS);
        setIsConnectingWallet(false);
        return;
      }

      // If it's a successful wallet creation, proceed normally
      onComplete();
    } catch (error) {
      console.error("Wallet creation failed:", error);
      setIsConnectingWallet(false);

      // Extract error message using the existing utility
      const errorMessage = extractErrorMessage(error as AppError);

      // Show error in snackbar
      enqueueSnackbar(errorMessage, {
        variant: "error",
        autoHideDuration: 5000
      });
    }
  };

  const on3DSecureSuccess = async () => {
    // After successful 3D Secure authentication, mark payment method as validated and retry trial creation
    setThreeDSecureData(null);
    setIsConnectingWallet(true);

    if (!user?.id) {
      console.error("User ID not available");
      setIsConnectingWallet(false);
      return;
    }

    try {
      // Mark the payment method as validated after successful 3D Secure authentication
      if (threeDSecureData?.paymentMethodId && threeDSecureData?.paymentIntentId) {
        await managedWalletService.markPaymentMethodValidatedAfter3DS(threeDSecureData.paymentMethodId, threeDSecureData.paymentIntentId);
      }

      // Refresh payment methods to pick up the validation status change
      await refetchPaymentMethods();

      const result = await createWallet(user.id);

      // Check if it's still a 3D Secure response (shouldn't happen after successful auth)
      if ("requires3DS" in result && result.requires3DS) {
        setThreeDSecureData(result as ApiWalletWithOptional3DS);
        setIsConnectingWallet(false);
        return;
      }

      // If it's a successful wallet creation, proceed normally
      onComplete();
    } catch (error) {
      console.error("Wallet creation failed after 3D Secure:", error);
      setIsConnectingWallet(false);

      // Extract error message using the existing utility
      const errorMessage = extractErrorMessage(error as AppError);

      // Show error in snackbar
      enqueueSnackbar(errorMessage, {
        variant: "error",
        autoHideDuration: 5000
      });
    }
  };

  const on3DSecureError = (error: string) => {
    // Clear 3D Secure data on error
    setThreeDSecureData(null);
    setIsConnectingWallet(false);
    console.error("3D Secure authentication failed:", error);

    // Show error in snackbar
    enqueueSnackbar(error, {
      variant: "error",
      autoHideDuration: 5000
    });
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
        refetchPaymentMethods,
        hasValidatedCard,
        hasPaymentMethod,
        threeDSecureData,
        on3DSecureSuccess,
        on3DSecureError
      })}
    </>
  );
};
