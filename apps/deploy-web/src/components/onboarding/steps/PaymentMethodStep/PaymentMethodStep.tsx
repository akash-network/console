"use client";
import React, { useEffect, useState } from "react";
import { Alert, Popup } from "@akashnetwork/ui/components";
import { CreditCard } from "iconoir-react";

import { Title } from "@src/components/shared/Title";
import { useWallet } from "@src/context/WalletProvider";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries/usePaymentQueries";
import { PaymentMethodsDisplay } from "./PaymentMethodsDisplay";
import { PaymentVerificationCard } from "./PaymentVerificationCard";

interface PaymentMethodStepProps {
  onComplete: () => void;
}

export const PaymentMethodStep: React.FunctionComponent<PaymentMethodStepProps> = ({ onComplete }) => {
  const { data: setupIntent, mutate: createSetupIntent } = useSetupIntentMutation();
  const { data: paymentMethods = [], refetch: refetchPaymentMethods } = usePaymentMethodsQuery();
  const { removePaymentMethod } = usePaymentMutations();
  const { connectManagedWallet, isWalletLoading, hasManagedWallet } = useWallet();
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
    <div className="space-y-6 text-center">
      <Title>Add Payment Method</Title>

      {paymentMethods.length > 0 && !showAddForm && (
        <PaymentMethodsDisplay
          paymentMethods={paymentMethods}
          onRemovePaymentMethod={handleRemovePaymentMethod}
          onStartTrial={handleNext}
          isLoading={isLoading}
          isRemoving={removePaymentMethod.isPending}
        />
      )}

      {(paymentMethods.length === 0 || showAddForm) && <PaymentVerificationCard setupIntent={setupIntent} onSuccess={handleSuccess} />}

      {paymentMethods.length === 0 && !showAddForm && (
        <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="warning">
          <div className="rounded-full bg-card p-3">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-medium">Payment Method Required</h4>
            <p className="text-sm">You must add a payment method to continue to the next step.</p>
          </div>
        </Alert>
      )}

      <Popup
        open={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setCardToDelete(undefined);
        }}
        title="Remove Payment Method"
        variant="custom"
        actions={[
          {
            label: "Cancel",
            variant: "ghost",
            onClick: () => {
              setShowDeleteConfirmation(false);
              setCardToDelete(undefined);
            },
            side: "left"
          },
          {
            label: "Remove",
            onClick: confirmRemovePaymentMethod,
            variant: "default",
            disabled: removePaymentMethod.isPending,
            side: "right"
          }
        ]}
      >
        <p>Are you sure you want to remove this payment method?</p>
      </Popup>
    </div>
  );
};
