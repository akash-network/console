import React, { useEffect, useState } from "react";
import { Alert } from "@akashnetwork/ui/components";
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

const PaymentForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pay`
        }
      });

      if (submitError) {
        setError(submitError.message || "An error occurred while processing your payment method.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    }

    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto mt-8 max-w-md">
      <PaymentElement />
      {error && (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="mt-6 w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {processing ? "Processing..." : "Add Payment Method"}
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
      console.log("DEBUG: data", data);
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
        <Title>Add Payment Method</Title>
        <p className="mt-4 text-center text-gray-600">Add a payment method to your account. This will be used for future payments.</p>
        <div className="mx-auto max-w-md p-6">
          <h1 className="mb-6 text-2xl font-bold">Payment Methods</h1>

          {paymentMethods.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-semibold">Your Cards</h2>
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
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold">Add New Card</h2>
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
                <PaymentForm />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PayPage;
