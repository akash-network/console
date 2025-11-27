import React, { useRef, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, LoadingButton, Popup, Snackbar } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";
import { useSnackbar } from "notistack";

import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMutations } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";

const MINIMUM_PAYMENT_AMOUNT = 20;

interface PaymentPopupProps {
  open: boolean;
  onClose: () => void;
  selectedPaymentMethodId?: string;
  setShowPaymentSuccess: ({ amount, show }: { amount: string; show: boolean }) => void;
}

export const PaymentPopup: React.FC<PaymentPopupProps> = ({ open, onClose, selectedPaymentMethodId, setShowPaymentSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();

  const [amount, setAmount] = useState<string>("");
  const [coupon, setCoupon] = useState<string>("");
  const [amountError, setAmountError] = useState<string>();
  const [error, setError] = useState<string>();
  const [errorAction, setErrorAction] = useState<string>();
  const submittedAmountRef = useRef<string>("");
  const { user } = useUser();
  const {
    confirmPayment: { isPending: isConfirmingPayment, mutateAsync: confirmPayment },
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon }
  } = usePaymentMutations();
  const { pollForPayment, isPolling } = usePaymentPolling();
  const threeDSecure = use3DSecure({
    onSuccess: () => {
      pollForPayment();
      setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
      setAmount("");
      setCoupon("");
      onClose();
    },
    showSuccessMessage: false
  });

  const clearError = () => {
    if (error) {
      setError(undefined);
      setErrorAction(undefined);
    }
  };

  const onPayment = async (paymentMethodId: string) => {
    if (!amount) return;

    // Capture the submitted amount before starting the payment flow
    submittedAmountRef.current = amount;
    clearError();

    try {
      const response = await confirmPayment({
        userId: user?.id || "",
        paymentMethodId,
        amount: parseFloat(amount),
        currency: "usd"
      });

      if (response && response.requiresAction && response.clientSecret && response.paymentIntentId) {
        threeDSecure.start3DSecure({
          clientSecret: response.clientSecret,
          paymentIntentId: response.paymentIntentId,
          paymentMethodId
        });
      } else if (response.success) {
        pollForPayment();
        setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
        setAmount("");
        setCoupon("");
        onClose();
      } else {
        throw new Error("Payment failed");
      }
    } catch (error: unknown) {
      console.error("Payment confirmation failed:", error);

      const errorInfo = handleStripeError(error);

      setError(errorInfo.message);
      setErrorAction(errorInfo.userAction);
      enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
    }
  };

  const onClaimCoupon = async () => {
    if (!coupon) return;

    try {
      const response = await applyCoupon({ coupon, userId: user?.id || "" });

      if (response.error) {
        const errorInfo = handleCouponError(response);
        enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
        return;
      }

      if (response.amountAdded && response.amountAdded > 0) {
        pollForPayment();
        setShowPaymentSuccess({ amount: response.amountAdded.toString(), show: true });
      }

      enqueueSnackbar(<Snackbar title="Coupon applied successfully!" iconVariant="success" />, { variant: "success", autoHideDuration: 5_000 });
      setCoupon("");
      onClose();
    } catch (error: unknown) {
      const errorInfo = handleStripeError(error);
      enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
      console.error("Coupon application error:", error);
    }
  };

  const validateAmount = (value: number) => {
    if (value <= 0) {
      setAmountError("Amount must be greater than $0");
      return false;
    }

    if (value < MINIMUM_PAYMENT_AMOUNT) {
      setAmountError(`Minimum amount is $${MINIMUM_PAYMENT_AMOUNT}`);
      return false;
    }

    setAmountError(undefined);
    return true;
  };

  const onAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    clearError();

    if (value !== "") {
      validateAmount(parseFloat(value));
    } else {
      setAmountError(undefined);
    }
  };

  const onCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCoupon(value);
    clearError();
  };

  const isProcessing = isConfirmingPayment || isPolling;
  const disabled = !amount || parseFloat(amount) <= 0 || isProcessing || !selectedPaymentMethodId || !!amountError;
  const disabledCoupon = !coupon || isProcessing || isApplyingCoupon;

  return (
    <Popup
      open={open}
      onClose={onClose}
      title="Add Funds"
      variant="custom"
      actions={[
        {
          label: "Cancel",
          variant: "ghost",
          onClick: onClose,
          side: "right"
        }
      ]}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add credits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                error={!!amountError}
                type="number"
                name="amount"
                id="amount"
                min="0"
                step="0.01"
                value={amount}
                onChange={onAmountChange}
                placeholder="0.00"
                label="Amount (USD)"
              />
              {amountError && <p className="mt-2 text-sm text-destructive">{amountError}</p>}
            </div>

            <LoadingButton
              loading={isProcessing}
              className="w-full"
              onClick={() => selectedPaymentMethodId && onPayment(selectedPaymentMethodId)}
              disabled={disabled}
            >
              {isConfirmingPayment || isPolling ? (
                "Processing..."
              ) : (
                <>
                  Pay <FormattedNumber value={parseFloat(amount) || 0} style="currency" currency="USD" />
                </>
              )}
            </LoadingButton>
            {!selectedPaymentMethodId && <p className="text-center text-sm text-muted-foreground">Please select a payment method above</p>}

            {error && (
              <div className="mx-auto mt-6 max-w-md">
                <Alert variant="destructive" className="mb-4">
                  <p className="font-medium">Error Loading Payment Information</p>
                  <p className="text-sm">{error}</p>
                  {errorAction && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <strong>Suggestion:</strong> {errorAction}
                    </p>
                  )}
                  <Button onClick={clearError} variant="default" size="sm" className="mt-2">
                    <Xmark className="mr-2 h-4 w-4" />
                    Clear Error
                  </Button>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Have a coupon code?</CardTitle>
            <CardDescription>Enter your coupon code to claim credits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="text"
                name="coupon"
                id="coupon"
                className="flex-grow"
                value={coupon}
                onChange={onCouponChange}
                placeholder="Enter coupon code"
                label="Coupon Code"
              />
            </div>

            <LoadingButton className="w-full" loading={isApplyingCoupon} onClick={onClaimCoupon} disabled={disabledCoupon}>
              Claim coupon
            </LoadingButton>
          </CardContent>
        </Card>
      </div>
    </Popup>
  );
};
