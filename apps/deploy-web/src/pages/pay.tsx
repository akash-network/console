import React, { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, Input, Popup } from "@akashnetwork/ui/components";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useUser } from "@src/hooks/useUser";
import { getServerSidePropsWithServices } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { stripeService } from "@src/services/http/http-browser.service";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

let stripePromise: Promise<Stripe | null>;

function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) stripePromise = loadStripe(browserEnvConfig.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

  return stripePromise;
}

const AddPaymentMethodForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    setError(null);
    try {
      const { error: setupError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pay`
        }
      });
      if (setupError) {
        setError(setupError.message || "An error occurred while processing your payment method.");
        return;
      }
      onSuccess();
    } catch (err) {
      setError("An unexpected error occurred.");
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      )}
      <Button type="submit" className="w-full">
        Add Card
      </Button>
    </form>
  );
};

const PayPage: React.FunctionComponent = () => {
  const user = useUser();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState<string>();
  const [paymentMethods, setPaymentMethods] = useState<
    Array<{
      id: string;
      card: {
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
      };
      created: number;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [coupon, setCoupon] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [couponError, setCouponError] = useState<string>();
  const [couponSuccess, setCouponSuccess] = useState<string>();
  const [setupSuccess, setSetupSuccess] = useState<string>();

  const setupIntent = async () => {
    try {
      const { clientSecret } = await stripeService.createSetupIntent();
      setClientSecret(clientSecret);
    } catch (error) {
      setError("Failed to create setup intent");
      console.error(error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data } = await stripeService.getPaymentMethods();
      setPaymentMethods(data);
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    }
  };

  useEffect(() => {
    if (user?.userId || user?.id) {
      Promise.all([setupIntent(), fetchPaymentMethods()]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [user?.userId, user?.id]);

  useEffect(() => {
    const handlePaymentMethodsUpdated = (event: CustomEvent) => {
      setPaymentMethods(event.detail);
    };

    window.addEventListener("paymentMethodsUpdated", handlePaymentMethodsUpdated as EventListener);
    return () => {
      window.removeEventListener("paymentMethodsUpdated", handlePaymentMethodsUpdated as EventListener);
    };
  }, []);

  // Handle setup intent redirect
  useEffect(() => {
    const { setup_intent, redirect_status } = router.query;

    if (setup_intent && redirect_status === "succeeded") {
      setSetupSuccess("Payment method added successfully!");
      fetchPaymentMethods();

      // Clean up the URL
      router.replace("/pay", undefined, { shallow: true });
    }
  }, [router.query]);

  const handlePayment = async (paymentMethodId: string) => {
    if (!amount) return;

    setProcessing(true);
    setError(undefined);

    try {
      const { error: paymentError } = await stripeService.confirmPayment({
        paymentMethodId,
        amount: parseFloat(amount),
        currency: "usd",
        ...(coupon && { coupon })
      });

      if (paymentError) {
        setError(paymentError.message || "An error occurred while processing your payment.");
        return;
      }

      // Payment successful
      setAmount("");
      setCoupon("");
      await fetchPaymentMethods(); // Refresh payment methods list
    } catch (err) {
      setError("An unexpected error occurred.");
    }

    setProcessing(false);
  };

  const handleAddCard = async () => {
    if (clientSecret) {
      const stripe = await getStripe();
      if (stripe) {
        const elements = stripe.elements({ clientSecret });
        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");
      }
    }
  };

  const handleAddCardSuccess = async () => {
    setShowAddPaymentMethod(false);
    await fetchPaymentMethods();
  };

  const handleClaimCoupon = async () => {
    if (!coupon) return;

    setCouponError(undefined);
    setCouponSuccess(undefined);

    try {
      await stripeService.applyCoupon(coupon);
      setCouponSuccess("Coupon applied successfully!");
      setCoupon(""); // Clear the input after successful application
    } catch (error: any) {
      setCouponError(error.message || "Failed to apply coupon");
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  const isDarkMode = resolvedTheme === "dark";

  return (
    <Layout>
      <div className="py-12">
        <Title>Payment Methods</Title>
        <p className="mt-4 text-center text-gray-600">Manage your payment methods and make payments.</p>
        <div className="mx-auto max-w-md p-6">
          {setupSuccess && (
            <Alert className="mb-4" variant="success">
              {setupSuccess}
            </Alert>
          )}
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Your Cards</h2>
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                <Card className="rounded-lg border shadow-sm">
                  <CardContent className="flex flex-col gap-4 pt-4">
                    {paymentMethods.map(method => (
                      <div key={method.id} className="flex items-center justify-between rounded-md border p-4">
                        <div>
                          <span className="font-medium capitalize">{method.card.brand}</span>
                          <span className="ml-2">•••• {method.card.last4}</span>
                        </div>
                        <div className="text-sm">
                          Expires {method.card.exp_month}/{method.card.exp_year}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-gray-500">No payment methods added yet.</p>
            )}
            <Button onClick={() => setShowAddPaymentMethod(true)} className="mt-4 w-full">
              Add New Card
            </Button>
          </div>

          {paymentMethods.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Make a Payment</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-muted-foreground">
                    Amount (USD)
                  </label>
                  <div className="mt-1">
                    <Input
                      type="number"
                      name="amount"
                      id="amount"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="coupon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coupon Code
                  </label>
                  <div className="mt-1 flex w-full items-center gap-2">
                    <Input
                      type="text"
                      name="coupon"
                      id="coupon"
                      className="flex-grow"
                      value={coupon}
                      onChange={e => setCoupon(e.target.value)}
                      placeholder="Enter coupon code"
                    />
                    <Button onClick={handleClaimCoupon} disabled={!coupon || processing}>
                      Claim coupon
                    </Button>
                  </div>
                  {couponError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{couponError}</p>}
                  {couponSuccess && <p className="mt-1 text-sm text-green-600 dark:text-green-400">{couponSuccess}</p>}
                </div>

                <Button onClick={() => handlePayment(paymentMethods[0].id)} disabled={!amount || processing}>
                  {processing ? "Processing..." : `Pay $${amount || "0.00"}`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Popup
        open={showAddPaymentMethod}
        onClose={() => setShowAddPaymentMethod(false)}
        title="Add New Card"
        variant="custom"
        actions={[
          {
            label: "Cancel",
            side: "left",
            variant: "ghost",
            onClick: () => setShowAddPaymentMethod(false)
          },
          {
            label: "Add Card",
            side: "right",
            variant: "default",
            color: "primary",
            onClick: handleAddCard
          }
        ]}
      >
        {clientSecret && (
          <Elements
            stripe={getStripe()}
            options={{
              clientSecret,
              appearance: {
                theme: isDarkMode ? "night" : "stripe",
                variables: {
                  colorPrimary: "rgb(var(--color-primary-600) / <alpha-value>)",
                  colorBackground: "rgb(var(--color-gray-50) / <alpha-value>)",
                  colorText: "rgb(var(--color-gray-900) / <alpha-value>)",
                  colorDanger: "rgb(var(--color-red-500) / <alpha-value>)",
                  spacingUnit: "4px",
                  borderRadius: "var(--radius)"
                }
              }
            }}
          >
            <AddPaymentMethodForm onSuccess={handleAddCardSuccess} />
          </Elements>
        )}
      </Popup>
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
