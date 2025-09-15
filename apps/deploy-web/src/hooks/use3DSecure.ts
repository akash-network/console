import { useCallback, useState } from "react";
import { useSnackbar } from "notistack";

import { usePaymentMutations } from "@src/queries";

interface ThreeDSecureData {
  clientSecret: string;
  paymentIntentId: string;
  paymentMethodId: string;
}

interface Use3DSecureOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  showSuccessMessage?: boolean;
  showErrorMessage?: boolean;
}

interface Use3DSecureReturn {
  isOpen: boolean;
  threeDSData: ThreeDSecureData | null;
  isLoading: boolean;

  start3DSecure: (data: ThreeDSecureData) => void;
  close3DSecure: () => void;
  handle3DSSuccess: () => Promise<void>;
  handle3DSError: (error: string) => void;
}

export const use3DSecure = (options: Use3DSecureOptions = {}): Use3DSecureReturn => {
  const { onSuccess, onError, showSuccessMessage = true, showErrorMessage = true } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [threeDSData, setThreeDSData] = useState<ThreeDSecureData | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const { validatePaymentMethodAfter3DS } = usePaymentMutations();

  const start3DSecure = useCallback((data: ThreeDSecureData) => {
    setThreeDSData(data);
    setIsOpen(true);
  }, []);

  const close3DSecure = useCallback(() => {
    setIsOpen(false);
    setThreeDSData(null);
  }, []);

  const handle3DSSuccess = useCallback(async () => {
    if (!threeDSData) {
      const errorMessage = "Authentication data is missing. Please try again.";
      console.error("3D Secure data is missing");

      if (showErrorMessage) {
        enqueueSnackbar(errorMessage, { variant: "error" });
      }

      onError?.(errorMessage);
      close3DSecure();
      return;
    }

    console.log("3D Secure authentication successful, processing...");

    try {
      // Mark payment method as validated after 3D Secure
      console.log("Marking payment method as validated...", {
        paymentMethodId: threeDSData.paymentMethodId,
        paymentIntentId: threeDSData.paymentIntentId
      });

      await validatePaymentMethodAfter3DS.mutateAsync({
        paymentMethodId: threeDSData.paymentMethodId,
        paymentIntentId: threeDSData.paymentIntentId
      });

      console.log("Payment method validation successful");
    } catch (error: unknown) {
      console.error("Failed to validate payment method after 3D Secure:", error);
      // Don't fail the entire flow if validation fails - the payment was successful
      // Just log the error and continue
    }

    // Always call onSuccess and show success message since 3D Secure authentication succeeded
    if (showSuccessMessage) {
      enqueueSnackbar("Payment completed successfully!", { variant: "success" });
    }

    console.log("Calling onSuccess callback...");
    onSuccess?.();
    close3DSecure();
  }, [threeDSData, validatePaymentMethodAfter3DS, onSuccess, onError, showSuccessMessage, showErrorMessage, enqueueSnackbar, close3DSecure]);

  const handle3DSError = useCallback(
    (error: string) => {
      console.error("3D Secure authentication failed:", error);

      // Provide more specific error messages
      let errorMessage = error;
      if (error.includes("declined") || error.includes("insufficient_funds")) {
        errorMessage = "Your payment method was declined. Please try a different card or contact your bank.";
      } else if (error.includes("timeout")) {
        errorMessage = "Authentication timed out. Please try again.";
      } else if (error.includes("network")) {
        errorMessage = "Network error occurred. Please check your connection and try again.";
      }

      if (showErrorMessage) {
        enqueueSnackbar(errorMessage, { variant: "error" });
      }

      onError?.(errorMessage);
      close3DSecure();
    },
    [onError, showErrorMessage, enqueueSnackbar, close3DSecure]
  );

  return {
    isOpen,
    threeDSData,
    isLoading: validatePaymentMethodAfter3DS.isPending,
    start3DSecure,
    close3DSecure,
    handle3DSSuccess,
    handle3DSError
  };
};
