import React, { useEffect, useState } from "react";
import { Alert, Popup } from "@akashnetwork/ui/components";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useTheme } from "next-themes";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { browserEnvConfig } from "@src/config/browser-env.config";
import { useUser } from "@src/hooks/useUser";
import { stripeService } from "@src/services/http/http-browser.service";

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
      <button type="submit" className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        Add Card
      </button>
    </form>
  );
};

const PayPage: React.FunctionComponent = () => {
  const user = useUser();
  const { resolvedTheme } = useTheme();
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
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Your Cards</h2>
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {paymentMethods.map(method => (
                  <div key={method.id} className="rounded-lg border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium capitalize">{method.card.brand}</span>
                        <span className="ml-2">•••• {method.card.last4}</span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Expires {method.card.exp_month}/{method.card.exp_year}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No payment methods added yet.</p>
            )}
            <button onClick={() => setShowAddPaymentMethod(true)} className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Add New Card
            </button>
          </div>

          {paymentMethods.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Make a Payment</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Amount (USD)
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="amount"
                      id="amount"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="coupon" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coupon Code (Optional)
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="coupon"
                      id="coupon"
                      value={coupon}
                      onChange={e => setCoupon(e.target.value)}
                      className="focus:border-primary-500 focus:ring-primary-500 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="Enter coupon code"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handlePayment(paymentMethods[0].id)}
                  disabled={!amount || processing}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? "Processing..." : `Pay $${amount || "0.00"}`}
                </button>
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
