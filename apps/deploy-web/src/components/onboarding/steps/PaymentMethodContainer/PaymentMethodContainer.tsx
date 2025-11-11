"use client";
import React, { type FC, useCallback, useEffect, useState } from "react";
import type { ApiWalletWithOptional3DS } from "@akashnetwork/http-sdk/src/managed-wallet-http/managed-wallet-http.service";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { useCreateManagedWalletMutation } from "@src/queries/useManagedWalletQuery";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries/usePaymentQueries";
import type { AppError } from "@src/types/errors";
import { extractErrorMessage } from "@src/utils/errorUtils";

const DEPENDENCIES = {
  useWallet,
  useUser,
  usePaymentMethodsQuery,
  usePaymentMutations,
  useSetupIntentMutation,
  useCreateManagedWalletMutation,
  use3DSecure
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
    onSuccess: (organization?: string) => void;
    onRemovePaymentMethod: (paymentMethodId: string) => void;
    onConfirmRemovePaymentMethod: () => Promise<void>;
    onNext: () => void;
    onShowAddForm: (show: boolean) => void;
    onShowDeleteConfirmation: (show: boolean) => void;
    onSetCardToDelete: (cardId?: string) => void;
    refetchPaymentMethods: () => void;
    hasValidatedCard: boolean;
    hasPaymentMethod: boolean;
    threeDSecure: {
      isOpen: boolean;
      threeDSData: { clientSecret: string; paymentIntentId: string; paymentMethodId: string } | null;
      handle3DSSuccess: () => Promise<void>;
      handle3DSError: (error: string) => void;
    };
  }) => React.ReactNode;
  onComplete: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const PaymentMethodContainer: FC<PaymentMethodContainerProps> = ({ children, onComplete, dependencies: d = DEPENDENCIES }) => {
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = d.useSetupIntentMutation();
  const { data: paymentMethods = [], refetch: refetchPaymentMethods } = d.usePaymentMethodsQuery();
  const { removePaymentMethod } = d.usePaymentMutations();
  const { isWalletLoading, hasManagedWallet, managedWalletError } = d.useWallet();
  const { user } = d.useUser();
  const { stripe, sentry } = useServices();
  const { enqueueSnackbar } = useSnackbar();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const { mutateAsync: createWallet } = d.useCreateManagedWalletMutation();
  const hasValidatedCard = paymentMethods.length > 0 && paymentMethods.some(method => method.validated);
  const hasPaymentMethod = paymentMethods.length > 0;

  const threeDSecure = d.use3DSecure({
    onSuccess: async () => {
      setIsConnectingWallet(true);
      await refetchPaymentMethods();

      if (!user?.id) {
        console.error("User ID not available");
        setIsConnectingWallet(false);
        return;
      }

      try {
        const result = await createWallet(user.id);

        if ("requires3DS" in result && result.requires3DS) {
          // Start another 3D Secure flow if needed
          if (!validateAndStart3DSecure(result)) {
            setIsConnectingWallet(false);
            return;
          }
          setIsConnectingWallet(false);
          return;
        }

        setIsConnectingWallet(false);
        onComplete();
      } catch (error) {
        console.error("Wallet creation failed after 3D Secure:", error);
        setIsConnectingWallet(false);
        const errorMessage = extractErrorMessage(error as AppError);
        enqueueSnackbar(errorMessage, { variant: "error", autoHideDuration: 5000 });
      }
    },
    onError: (error: string) => {
      setIsConnectingWallet(false);
      console.error("3D Secure authentication failed:", error);
    },
    showSuccessMessage: false
  });

  const validateAndStart3DSecure = useCallback(
    (result: ApiWalletWithOptional3DS) => {
      const { clientSecret, paymentIntentId, paymentMethodId } = result;

      // Validate required fields
      if (!clientSecret || clientSecret.trim() === "") {
        console.error("3D Secure validation failed: clientSecret is missing or empty");
        enqueueSnackbar("Authentication data is incomplete. Please try again.", { variant: "error" });
        return false;
      }

      if ((!paymentIntentId || paymentIntentId.trim() === "") && (!paymentMethodId || paymentMethodId.trim() === "")) {
        console.error("3D Secure validation failed: both paymentIntentId and paymentMethodId are missing or empty");
        enqueueSnackbar("Payment method information is incomplete. Please try again.", { variant: "error" });
        return false;
      }

      threeDSecure.start3DSecure({
        clientSecret: clientSecret.trim(),
        paymentIntentId: paymentIntentId?.trim() || "",
        paymentMethodId: paymentMethodId?.trim() || ""
      });
      return true;
    },
    [threeDSecure, enqueueSnackbar]
  );

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

  const handleSuccess = async (organization?: string) => {
    if (organization) {
      try {
        await stripe.updateCustomerOrganization(organization);
      } catch (error) {
        sentry.captureException(error, { extra: { context: "Failed to update customer organization" } });
      }
    }

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

      // Reset the setupIntent to force a fresh one when form is shown
      resetSetupIntent();

      setShowDeleteConfirmation(false);
      setCardToDelete(undefined);
      await refetchPaymentMethods();
    } catch (error) {
      console.error("Failed to remove payment method:", error);
      const errorMessage = extractErrorMessage(error as AppError);

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

      if ("requires3DS" in result && result.requires3DS) {
        if (!validateAndStart3DSecure(result)) {
          setIsConnectingWallet(false);
          return;
        }
        setIsConnectingWallet(false);
        return;
      }

      setIsConnectingWallet(false);
      onComplete();
    } catch (error) {
      console.error("Wallet creation failed:", error);
      setIsConnectingWallet(false);

      const errorMessage = extractErrorMessage(error as AppError);

      enqueueSnackbar(errorMessage, {
        variant: "error",
        autoHideDuration: 5000
      });
    }
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
        threeDSecure
      })}
    </>
  );
};
