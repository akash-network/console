import React, { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { FormattedNumber } from "react-intl";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormField,
  FormInput,
  LoadingButton,
  Popup,
  Snackbar
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Xmark } from "iconoir-react";
import { useSnackbar } from "notistack";
import { z } from "zod";

import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMutations } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";

export const DEPENDENCIES = {
  Popup,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Form,
  FormField,
  FormInput,
  LoadingButton,
  FormattedNumber,
  Alert,
  Button,
  Xmark,
  Snackbar,
  useForm,
  zodResolver,
  useSnackbar,
  usePaymentPolling,
  use3DSecure,
  useUser,
  usePaymentMutations,
  handleCouponError,
  handleStripeError,
  useServices,
};

const MINIMUM_PAYMENT_AMOUNT = 20;

const paymentFormSchema = z.object({
  amount: z.coerce
    .number({
      invalid_type_error: "Amount must be a number"
    })
    .positive("Amount must be greater than $0")
    .min(MINIMUM_PAYMENT_AMOUNT, `Minimum amount is $${MINIMUM_PAYMENT_AMOUNT}`)
});

const couponFormSchema = z.object({
  coupon: z.string().min(1, "Coupon code is required")
});

export interface PaymentPopupProps {
  open: boolean;
  onClose: () => void;
  selectedPaymentMethodId?: string;
  setShowPaymentSuccess: ({ amount, show }: { amount: string; show: boolean }) => void;
  dependencies?: typeof DEPENDENCIES;
}

export const PaymentPopup: React.FC<PaymentPopupProps> = ({
  open,
  onClose,
  selectedPaymentMethodId,
  setShowPaymentSuccess,
  dependencies: d = DEPENDENCIES
}) => {
  const { errorHandler } = d.useServices();
  const { enqueueSnackbar } = d.useSnackbar();

  const [error, setError] = useState<string>();
  const [errorAction, setErrorAction] = useState<string>();
  const submittedAmountRef = useRef<string>("");
  const { user } = d.useUser();
  const {
    confirmPayment: { isPending: isConfirmingPayment, mutateAsync: confirmPayment },
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon }
  } = d.usePaymentMutations();
  const { pollForPayment, isPolling } = d.usePaymentPolling();

  const paymentForm = d.useForm<z.infer<typeof paymentFormSchema>>({
    defaultValues: {
      amount: 0
    },
    resolver: d.zodResolver(paymentFormSchema)
  });

  const couponForm = d.useForm<z.infer<typeof couponFormSchema>>({
    defaultValues: {
      coupon: ""
    },
    resolver: d.zodResolver(couponFormSchema)
  });

  const threeDSecure = d.use3DSecure({
    onSuccess: () => {
      pollForPayment();
      setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
      paymentForm.reset();
      couponForm.reset();
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

  const onPayment = async ({ amount }: z.infer<typeof paymentFormSchema>) => {
    if (!user?.id) {
      errorHandler.reportError({
        message: "Payment attempted without a user id",
        tags: { category: "payment" }
      });
      setError("Unable to process payment. Please refresh the page and try again.");
      return;
    }

    if (!selectedPaymentMethodId) {
      return;
    }

    // Capture the submitted amount before starting the payment flow
    submittedAmountRef.current = amount.toString();
    clearError();

    try {
      const response = await confirmPayment({
        userId: user.id,
        paymentMethodId: selectedPaymentMethodId,
        amount,
        currency: "usd"
      });

      if (response && response.requiresAction && response.clientSecret && response.paymentIntentId) {
        threeDSecure.start3DSecure({
          clientSecret: response.clientSecret,
          paymentIntentId: response.paymentIntentId,
          paymentMethodId: selectedPaymentMethodId
        });
      } else if (response.success) {
        pollForPayment();
        setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
        paymentForm.reset();
        couponForm.reset();
        onClose();
      } else {
        throw new Error("Payment failed");
      }
    } catch (error: unknown) {
      const errorInfo = d.handleStripeError(error);

      setError(errorInfo.message);
      setErrorAction(errorInfo.userAction);
      enqueueSnackbar(<d.Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
    }
  };

  const onClaimCoupon = async ({ coupon }: z.infer<typeof couponFormSchema>) => {
    try {
      if (!user?.id) {
        errorHandler.reportError({
          message: "Coupon application attempted without a user id",
          tags: { category: "payment" }
        });

        enqueueSnackbar(<d.Snackbar title="Unable to apply coupon. Please refresh the page and try again." iconVariant="error" />, { variant: "error" });
        return;
      }

      const response = await applyCoupon({ coupon, userId: user.id });

      if (response.error) {
        const errorInfo = d.handleCouponError(response);
        enqueueSnackbar(<d.Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
        return;
      }

      if (response.amountAdded && response.amountAdded > 0) {
        pollForPayment();
        setShowPaymentSuccess({ amount: response.amountAdded.toString(), show: true });
      }

      enqueueSnackbar(<d.Snackbar title="Coupon applied successfully!" iconVariant="success" />, { variant: "success", autoHideDuration: 5_000 });
      couponForm.reset();
      onClose();
    } catch (error: unknown) {
      const errorInfo = d.handleStripeError(error);
      enqueueSnackbar(<d.Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
      errorHandler.reportError({
        error,
        message: "Coupon application error",
        tags: { category: "payment" }
      });
    }
  };

  const amount = paymentForm.watch("amount");
  const isProcessing = isConfirmingPayment || isPolling || isApplyingCoupon;
  const disabled = isProcessing || !selectedPaymentMethodId;

  return (
    <d.Popup
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
        <d.Card>
          <d.CardHeader>
            <d.CardTitle className="text-lg">Add credits</d.CardTitle>
          </d.CardHeader>
          <d.CardContent className="space-y-4">
            <d.Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(onPayment)} className="space-y-4">
                <d.FormField
                  control={paymentForm.control}
                  name="amount"
                  render={({ field }) => (
                    <d.FormInput
                      {...field}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      label="Amount (USD)"
                      onChange={e => {
                        field.onChange(e);
                        clearError();
                      }}
                    />
                  )}
                />

                <d.LoadingButton loading={isProcessing} className="w-full" type="submit" disabled={disabled}>
                  {isConfirmingPayment || isPolling ? (
                    "Processing..."
                  ) : (
                    <>
                      Pay <d.FormattedNumber value={amount || 0} style="currency" currency="USD" />
                    </>
                  )}
                </d.LoadingButton>
              </form>
            </d.Form>

            {!selectedPaymentMethodId && <p className="text-center text-sm text-muted-foreground">Please select a payment method above</p>}

            {error && (
              <div className="mx-auto mt-6 max-w-md">
                <d.Alert variant="destructive" className="mb-4">
                  <p className="font-medium">Payment Error</p>
                  <p className="text-sm">{error}</p>
                  {errorAction && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      <strong>Suggestion:</strong> {errorAction}
                    </p>
                  )}
                  <d.Button onClick={clearError} variant="default" size="sm" className="mt-2">
                    <d.Xmark className="mr-2 h-4 w-4" />
                    Clear Error
                  </d.Button>
                </d.Alert>
              </div>
            )}
          </d.CardContent>
        </d.Card>

        <d.Card>
          <d.CardHeader>
            <d.CardTitle className="text-lg">Have a coupon code?</d.CardTitle>
            <d.CardDescription>Enter your coupon code to claim credits</d.CardDescription>
          </d.CardHeader>
          <d.CardContent className="space-y-4">
            <d.Form {...couponForm}>
              <form onSubmit={couponForm.handleSubmit(onClaimCoupon)} className="space-y-4">
                <d.FormField
                  control={couponForm.control}
                  name="coupon"
                  render={({ field }) => (
                    <d.FormInput
                      {...field}
                      type="text"
                      placeholder="Enter coupon code"
                      label="Coupon Code"
                      onChange={e => {
                        field.onChange(e);
                        clearError();
                      }}
                    />
                  )}
                />

                <d.LoadingButton className="w-full" loading={isApplyingCoupon} type="submit">
                  Claim coupon
                </d.LoadingButton>
              </form>
            </d.Form>
          </d.CardContent>
        </d.Card>
      </div>
    </d.Popup>
  );
};
