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
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { usePaymentMutations } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";

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

interface PaymentPopupProps {
  open: boolean;
  onClose: () => void;
  selectedPaymentMethodId?: string;
  setShowPaymentSuccess: ({ amount, show }: { amount: string; show: boolean }) => void;
}

export const PaymentPopup: React.FC<PaymentPopupProps> = ({ open, onClose, selectedPaymentMethodId, setShowPaymentSuccess }) => {
  const { enqueueSnackbar } = useSnackbar();

  const [error, setError] = useState<string>();
  const [errorAction, setErrorAction] = useState<string>();
  const submittedAmountRef = useRef<string>("");
  const { user } = useUser();
  const {
    confirmPayment: { isPending: isConfirmingPayment, mutateAsync: confirmPayment },
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon }
  } = usePaymentMutations();
  const { pollForPayment, isPolling } = usePaymentPolling();

  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    defaultValues: {
      amount: 0
    },
    resolver: zodResolver(paymentFormSchema)
  });

  const couponForm = useForm<z.infer<typeof couponFormSchema>>({
    defaultValues: {
      coupon: ""
    },
    resolver: zodResolver(couponFormSchema)
  });

  const threeDSecure = use3DSecure({
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
      console.error("Payment attempted without a user id");
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
      console.error("Payment confirmation failed:", error);

      const errorInfo = handleStripeError(error);

      setError(errorInfo.message);
      setErrorAction(errorInfo.userAction);
      enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
    }
  };

  const onClaimCoupon = async ({ coupon }: z.infer<typeof couponFormSchema>) => {
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
      couponForm.reset();
      onClose();
    } catch (error: unknown) {
      const errorInfo = handleStripeError(error);
      enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
      console.error("Coupon application error:", error);
    }
  };

  const amount = paymentForm.watch("amount");
  const isProcessing = isConfirmingPayment || isPolling || isApplyingCoupon;
  const disabled = isProcessing || !selectedPaymentMethodId;

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
            <Form {...paymentForm}>
              <form onSubmit={paymentForm.handleSubmit(onPayment)} className="space-y-4">
                <FormField
                  control={paymentForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormInput
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

                <LoadingButton loading={isProcessing} className="w-full" type="submit" disabled={disabled}>
                  {isConfirmingPayment || isPolling ? (
                    "Processing..."
                  ) : (
                    <>
                      Pay <FormattedNumber value={amount || 0} style="currency" currency="USD" />
                    </>
                  )}
                </LoadingButton>
              </form>
            </Form>

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
            <Form {...couponForm}>
              <form onSubmit={couponForm.handleSubmit(onClaimCoupon)} className="space-y-4">
                <FormField
                  control={couponForm.control}
                  name="coupon"
                  render={({ field }) => (
                    <FormInput
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

                <LoadingButton className="w-full" loading={isApplyingCoupon} type="submit">
                  Claim coupon
                </LoadingButton>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Popup>
  );
};
