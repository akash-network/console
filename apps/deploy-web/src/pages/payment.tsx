import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Snackbar } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";
import { useTheme } from "next-themes";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { ThreeDSecurePopup } from "@src/components/shared/PaymentMethodForm/ThreeDSecurePopup";
import { PaymentMethodsList } from "@src/components/shared/PaymentMethodsList";
import { Title } from "@src/components/shared/Title";
import { AddPaymentMethodPopup, DeletePaymentMethodPopup, PaymentForm } from "@src/components/user/payment";
import { PaymentSuccessAnimation } from "@src/components/user/payment/PaymentSuccessAnimation";
import { useWallet } from "@src/context/WalletProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useUser } from "@src/hooks/useUser";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { usePaymentDiscountsQuery, usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const MINIMUM_PAYMENT_AMOUNT = 20;

const PayPage: React.FunctionComponent = () => {
  const { resolvedTheme } = useTheme();
  const [amount, setAmount] = useState<string>("");
  const [coupon, setCoupon] = useState<string>("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | undefined>();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; show: boolean }>({ amount: "", show: false });
  const [error, setError] = useState<string>();
  const [errorAction, setErrorAction] = useState<string>();
  const submittedAmountRef = useRef<string>("");
  const isDarkMode = resolvedTheme === "dark";
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useUser();
  const { data: paymentMethods = [], isLoading: isLoadingPaymentMethods, refetch: refetchPaymentMethods } = usePaymentMethodsQuery();
  const { data: discounts = [], isLoading: isLoadingDiscounts, refetch: refetchDiscounts } = usePaymentDiscountsQuery();
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = useSetupIntentMutation();
  const {
    confirmPayment: { isPending: isConfirmingPayment, mutateAsync: confirmPayment },
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon },
    removePaymentMethod
  } = usePaymentMutations();
  const threeDSecure = use3DSecure({
    onSuccess: () => {
      setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
      setAmount("");
      setCoupon("");
    },
    showSuccessMessage: false
  });

  const isLoading = isLoadingPaymentMethods || isLoadingDiscounts;
  const { isTrialing } = useWallet();

  useEffect(() => {
    if (paymentMethods.length > 0) {
      if (!selectedPaymentMethodId || !paymentMethods.some(method => method.id === selectedPaymentMethodId)) {
        setSelectedPaymentMethodId(paymentMethods[0].id);
      }
    }
  }, [paymentMethods, selectedPaymentMethodId]);

  useEffect(() => {
    if (amount) {
      validateAmount(parseFloat(amount));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  useEffect(() => {
    if (discounts.length > 0 && !amount) {
      setAmount(getDiscountedAmount().toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discounts]);

  const clearError = () => {
    if (error) {
      setError(undefined);
      setErrorAction(undefined);
    }
  };

  const handlePayment = async (paymentMethodId: string) => {
    if (!amount) return;
    if (!selectedPaymentMethodId || !paymentMethods.some(method => method.id === selectedPaymentMethodId)) return;

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
        setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
        setAmount("");
        setCoupon("");
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

  const handleAddCardSuccess = async () => {
    setShowAddPaymentMethod(false);
    refetchPaymentMethods();
  };

  const handleShowAddPaymentMethod = () => {
    resetSetupIntent();
    createSetupIntent();
    setShowAddPaymentMethod(true);
  };

  const handleClaimCoupon = async () => {
    if (!coupon) return;

    try {
      const response = await applyCoupon({ coupon, userId: user?.id || "" });

      if (response.error) {
        const errorInfo = handleCouponError(response);
        enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
        return;
      }

      if (response.amountAdded && response.amountAdded > 0) {
        setShowPaymentSuccess({ amount: response.amountAdded.toString(), show: true });
      }

      enqueueSnackbar(<Snackbar title="Coupon applied successfully!" iconVariant="success" />, { variant: "success", autoHideDuration: 5_000 });
      refetchDiscounts();
      setCoupon("");
    } catch (error: unknown) {
      const errorInfo = handleStripeError(error);
      enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
      console.error("Coupon application error:", error);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    setCardToDelete(paymentMethodId);
    setShowDeleteConfirmation(true);
  };

  const confirmRemovePaymentMethod = async () => {
    if (!cardToDelete) return;

    try {
      await removePaymentMethod.mutateAsync(cardToDelete);
      setSelectedPaymentMethodId(undefined);
      enqueueSnackbar(<Snackbar title="Payment method removed successfully" iconVariant="success" />, { variant: "success" });
    } catch (error: unknown) {
      console.error("Failed to remove payment method:", error);

      const errorInfo = handleStripeError(error);
      enqueueSnackbar(<Snackbar title={errorInfo.message} iconVariant="error" />, { variant: "error" });
    } finally {
      setShowDeleteConfirmation(false);
      setCardToDelete(undefined);
    }
  };

  const getDiscountedAmount = () => {
    let totalDiscount = 0;
    discounts.forEach(discount => {
      if (discount.valid && discount.amount_off) {
        totalDiscount += discount.amount_off / 100; // Convert cents to dollars
      }
    });
    return totalDiscount;
  };

  const calculateDiscountAmount = (amount: number) => {
    let totalDiscount = 0;
    discounts.forEach(discount => {
      if (discount.valid) {
        if (discount.percent_off) {
          totalDiscount += (amount * discount.percent_off) / 100;
        } else if (discount.amount_off) {
          totalDiscount += discount.amount_off / 100; // Convert cents to dollars
        }
      }
    });
    return totalDiscount;
  };

  const getFinalAmount = (amount: string) => {
    const numAmount = amount ? parseFloat(amount) : 0;
    const discount = calculateDiscountAmount(numAmount);
    return Math.max(0, numAmount - discount);
  };

  const validateAmount = (value: number) => {
    const finalAmount = getFinalAmount(value.toString());

    if (value <= 0) {
      setAmountError("Amount must be greater than $0");
      return false;
    }

    if (!discounts.length && value < MINIMUM_PAYMENT_AMOUNT) {
      setAmountError(`Minimum amount is $${MINIMUM_PAYMENT_AMOUNT}`);
      return false;
    }

    if (finalAmount > 0 && finalAmount < 1) {
      setAmountError("Final amount after discount must be at least $1");
      return false;
    }

    setAmountError(undefined);
    return true;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    clearError();

    if (value !== "") {
      validateAmount(parseFloat(value));
    } else {
      setAmountError(undefined);
    }
  };

  const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCoupon(value);
    clearError();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading payment information...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout isLoading={isLoading}>
      <div className="py-12">
        <Title className="text-center">Payment Methods</Title>
        <p className="mt-4 text-center text-gray-600">Manage your payment methods and make payments.</p>

        <div className="mx-auto max-w-md py-6">
          <PaymentSuccessAnimation
            show={showPaymentSuccess.show}
            amount={showPaymentSuccess.amount}
            onComplete={() => setShowPaymentSuccess({ amount: "", show: false })}
          />
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Your Payment Methods</h2>
            <PaymentMethodsList
              paymentMethods={paymentMethods}
              isRemoving={removePaymentMethod.isPending}
              onRemovePaymentMethod={handleRemovePaymentMethod}
              isSelectable={true}
              selectedPaymentMethodId={selectedPaymentMethodId}
              onPaymentMethodSelect={setSelectedPaymentMethodId}
              isTrialing={isTrialing}
            />
            <Button onClick={handleShowAddPaymentMethod} className="mt-4 w-full">
              Add New Payment Method
            </Button>
          </div>

          {paymentMethods.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Add credits</h2>
              <PaymentForm
                amount={amount}
                onAmountChange={handleAmountChange}
                amountError={amountError}
                coupon={coupon}
                onCouponChange={handleCouponChange}
                onClaimCoupon={handleClaimCoupon}
                discounts={discounts}
                getFinalAmount={getFinalAmount}
                processing={isConfirmingPayment}
                selectedPaymentMethodId={selectedPaymentMethodId}
                onPayment={handlePayment}
                isApplyingCoupon={isApplyingCoupon}
              />

              {/* Show error inline if there's a critical error */}
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
            </div>
          )}
        </div>
      </div>

      <DeletePaymentMethodPopup
        open={showDeleteConfirmation}
        onClose={() => {
          setShowDeleteConfirmation(false);
          setCardToDelete(undefined);
        }}
        onConfirm={confirmRemovePaymentMethod}
        isRemovingPaymentMethod={removePaymentMethod.isPending}
      />

      <AddPaymentMethodPopup
        open={showAddPaymentMethod}
        onClose={() => setShowAddPaymentMethod(false)}
        clientSecret={setupIntent?.clientSecret}
        isDarkMode={isDarkMode}
        onSuccess={handleAddCardSuccess}
      />

      <ThreeDSecurePopup
        isOpen={threeDSecure.isOpen}
        onSuccess={threeDSecure.handle3DSSuccess}
        onError={threeDSecure.handle3DSError}
        clientSecret={threeDSecure.threeDSData?.clientSecret || ""}
        paymentIntentId={threeDSecure.threeDSData?.paymentIntentId}
        title="Payment Authentication"
        description="Your bank requires additional verification for this payment."
        successMessage="Payment authenticated successfully!"
        errorMessage="Please try again or use a different payment method."
      />
    </Layout>
  );
};

export default PayPage;

export const getServerSideProps = withCustomPageAuthRequired({
  getServerSideProps: defineServerSideProps({
    route: "/payment"
  })
});
