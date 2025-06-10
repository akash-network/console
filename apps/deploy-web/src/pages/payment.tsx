import React, { useEffect, useState } from "react";
import { Alert, Button, Snackbar } from "@akashnetwork/ui/components";
import type { GetServerSideProps } from "next";
import { useTheme } from "next-themes";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { AddPaymentMethodPopup, DeletePaymentMethodPopup, PaymentForm, PaymentMethodsList } from "@src/components/user/payment";
import { PaymentSuccessAnimation } from "@src/components/user/payment/PaymentSuccessAnimation";
import { useUser } from "@src/hooks/useUser";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { usePaymentDiscountsQuery, usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation } from "@src/queries";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const PayPage: React.FunctionComponent = () => {
  const { resolvedTheme } = useTheme();
  const [amount, setAmount] = useState<string>("");
  const [coupon, setCoupon] = useState<string>("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();
  const [amountError, setAmountError] = useState<string>();
  const [showPaymentSuccess, setShowPaymentSuccess] = useState<{ amount: string; show: boolean }>({ amount: "", show: false });
  const [error, setError] = useState<string>();
  const isDarkMode = resolvedTheme === "dark";
  const { enqueueSnackbar } = useSnackbar();
  const user = useUser();
  const { data: paymentMethods = [], isLoading: isLoadingPaymentMethods, refetch: refetchPaymentMethods } = usePaymentMethodsQuery();
  const { data: discounts = [], isLoading: isLoadingDiscounts, refetch: refetchDiscounts } = usePaymentDiscountsQuery();
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = useSetupIntentMutation();
  const {
    confirmPayment: { isPending: isConfirmingPayment, mutateAsync: confirmPayment },
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon },
    removePaymentMethod
  } = usePaymentMutations();
  const isLoading = isLoadingPaymentMethods || isLoadingDiscounts;

  useEffect(() => {
    if (paymentMethods.length > 0 && !selectedPaymentMethodId) {
      setSelectedPaymentMethodId(paymentMethods[0].id);
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

  const handlePayment = async (paymentMethodId: string) => {
    if (!amount) return;

    try {
      await confirmPayment({
        userId: user?.id || "",
        paymentMethodId,
        amount: parseFloat(amount),
        currency: "usd",
        ...(coupon && { coupon })
      });

      // Payment successful
      setShowPaymentSuccess({ amount, show: true });
      setAmount("");
      setCoupon("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      setError(errorMessage);
      enqueueSnackbar(<Snackbar title={errorMessage} iconVariant="error" />, { variant: "error" });
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
      await applyCoupon({ coupon });
      enqueueSnackbar(<Snackbar title="Coupon applied successfully!" iconVariant="success" />, { variant: "success", autoHideDuration: 5_000 });
      refetchDiscounts();
      setAmount("");
      setCoupon("");
    } catch (error: any) {
      let couponError = "Failed to apply coupon. Please check the code and try again.";
      if (error.response?.status === 500) {
        couponError = "Unable to apply coupon. Please try again later.";
      } else if (error.response?.data?.message) {
        couponError = error.response.data.message;
      } else if (error.message) {
        couponError = error.message;
      }
      enqueueSnackbar(<Snackbar title={couponError} iconVariant="error" />, { variant: "error" });
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
      if (selectedPaymentMethodId === cardToDelete) {
        setSelectedPaymentMethodId(undefined);
      }
    } catch (error) {
      setError("Failed to remove payment method");
      console.error(error);
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
    // Only check for $20 minimum if no coupon is applied
    if (!discounts.length && value > 0 && value < 20) {
      setAmountError("Minimum amount is $20");
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
    if (value !== "") {
      validateAmount(parseFloat(value));
    } else {
      setAmountError(undefined);
    }
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

  if (error) {
    return (
      <Layout>
        <div className="mx-auto max-w-md p-6">
          <Alert variant="destructive" className="mb-4">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </Alert>
          <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
            Try Again
          </Button>
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
              selectedPaymentMethodId={selectedPaymentMethodId}
              onPaymentMethodSelect={setSelectedPaymentMethodId}
              onRemovePaymentMethod={handleRemovePaymentMethod}
              isRemovingPaymentMethod={removePaymentMethod.isPending}
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
                onCouponChange={e => setCoupon(e.target.value)}
                onClaimCoupon={handleClaimCoupon}
                discounts={discounts}
                getFinalAmount={getFinalAmount}
                processing={isConfirmingPayment}
                selectedPaymentMethodId={selectedPaymentMethodId}
                onPayment={handlePayment}
                isApplyingCoupon={isApplyingCoupon}
              />
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
    </Layout>
  );
};

export default PayPage;

export const getServerSideProps: GetServerSideProps = withCustomPageAuthRequired({
  getServerSideProps: getServerSidePropsWithServices(async () => {
    return {
      props: {}
    };
  })
});
