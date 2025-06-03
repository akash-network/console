import React, { useEffect, useState } from "react";
import { Alert, Button, Card, CardContent, Input, Popup, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { GetServerSideProps } from "next";
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
  const [cardholderName, setCardholderName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const { error: setupError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
              name: cardholderName
            }
          }
        },
        redirect: "if_required"
      });

      if (setupError) {
        setError(setupError.message || "An error occurred while processing your payment method.");
        return;
      }

      if (setupIntent?.status === "succeeded") {
        onSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="cardholderName" className="block text-sm font-medium text-muted-foreground">
          Cardholder Name
        </label>
        <Input
          id="cardholderName"
          type="text"
          value={cardholderName}
          onChange={e => setCardholderName(e.target.value)}
          placeholder="Name on card"
          required
          className="mt-1"
        />
      </div>
      <PaymentElement />
      {error && (
        <Alert className="mt-4" variant="destructive">
          {error}
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={isProcessing}>
        {isProcessing ? "Processing..." : "Add Card"}
      </Button>
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
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string>();
  const [amount, setAmount] = useState<number>(0);
  const [coupon, setCoupon] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [couponError, setCouponError] = useState<string>();
  const [couponSuccess, setCouponSuccess] = useState<string>();
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>();
  const [isRemovingPaymentMethod, setIsRemovingPaymentMethod] = useState(false);
  const [discounts, setDiscounts] = useState<
    Array<{
      type: "coupon" | "promotion_code";
      id: string;
      name?: string;
      code?: string;
      percent_off?: number;
      amount_off?: number;
      currency?: string;
      valid: boolean;
    }>
  >([]);

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
      // Pre-select the first card if none is selected
      if (data.length > 0 && !selectedPaymentMethodId) {
        setSelectedPaymentMethodId(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
    }
  };

  const fetchDiscounts = async () => {
    try {
      const response = await stripeService.getCustomerDiscounts();
      setDiscounts(response.discounts);
    } catch (error) {
      console.error("Failed to fetch discounts:", error);
    }
  };

  useEffect(() => {
    if (user?.userId || user?.id) {
      Promise.all([setupIntent(), fetchPaymentMethods(), fetchDiscounts()]).finally(() => {
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
        amount: amount,
        currency: "usd",
        ...(coupon && { coupon })
      });

      if (paymentError) {
        setError(paymentError.message || "An error occurred while processing your payment.");
        return;
      }

      // Payment successful
      setAmount(0);
      setCoupon("");
      await fetchPaymentMethods(); // Refresh payment methods list
    } catch (err) {
      setError("An unexpected error occurred.");
    }

    setProcessing(false);
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
      setCoupon("");
    } catch (error: any) {
      if (error.response?.status === 500) {
        setCouponError("Unable to apply coupon. Please try again later.");
      } else if (error.response?.data?.message) {
        setCouponError(error.response.data.message);
      } else if (error.message) {
        setCouponError(error.message);
      } else {
        setCouponError("Failed to apply coupon. Please check the code and try again.");
      }
      console.error("Coupon application error:", error);
    }
  };

  const handleRemovePaymentMethod = async (paymentMethodId: string) => {
    setCardToDelete(paymentMethodId);
    setShowDeleteConfirmation(true);
  };

  const confirmRemovePaymentMethod = async () => {
    if (!cardToDelete) return;

    setIsRemovingPaymentMethod(true);
    try {
      await stripeService.removePaymentMethod(cardToDelete);
      await fetchPaymentMethods();
      if (selectedPaymentMethodId === cardToDelete) {
        setSelectedPaymentMethodId(undefined);
      }
    } catch (error) {
      setError("Failed to remove payment method");
      console.error(error);
    } finally {
      setIsRemovingPaymentMethod(false);
      setShowDeleteConfirmation(false);
      setCardToDelete(undefined);
    }
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

  const getFinalAmount = (amount: number) => {
    const numAmount = amount || 0;
    const discount = calculateDiscountAmount(numAmount);
    return Math.max(0, numAmount - discount);
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
        <Title className="text-center">Payment Methods</Title>
        <p className="mt-4 text-center text-gray-600">Manage your payment methods and make payments.</p>
        <div className="mx-auto max-w-md p-6">
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Your Cards</h2>
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                <Card className="rounded-lg border shadow-sm">
                  <CardContent className="flex flex-col gap-4 pt-4">
                    <RadioGroup value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId} className="space-y-2">
                      {paymentMethods.map(method => (
                        <div
                          key={method.id}
                          className={`flex cursor-pointer items-center justify-between rounded-md border p-4 transition-colors ${
                            selectedPaymentMethodId === method.id ? "border-primary bg-primary/5" : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedPaymentMethodId(method.id)}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={method.id} id={method.id} />
                            <div>
                              <span className="font-medium capitalize">{method.card.brand}</span>
                              <span className="ml-2">•••• {method.card.last4}</span>
                              <div className="text-sm text-muted-foreground">
                                Expires {method.card.exp_month}/{method.card.exp_year}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              handleRemovePaymentMethod(method.id);
                            }}
                            disabled={isRemovingPaymentMethod}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </RadioGroup>
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
              <h2 className="mb-3 text-lg font-semibold">Add credits</h2>
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
                      onChange={e => setAmount(parseFloat(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {discounts.length > 0 && (
                  <div className="rounded-lg border p-4">
                    <h3 className="mb-2 font-medium">Active Discounts</h3>
                    <div className="space-y-2">
                      {discounts.map(discount => (
                        <div key={discount.id} className="flex items-center justify-between text-sm">
                          <span>{discount.type === "promotion_code" ? discount.code : discount.name}</span>
                          <span className="font-medium">
                            {discount.percent_off
                              ? `${discount.percent_off}% OFF`
                              : discount.amount_off
                                ? `$${(discount.amount_off / 100).toFixed(2)} OFF`
                                : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                    {!!amount && (
                      <div className="mt-3 border-t pt-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Original Amount:</span>
                          <span>${amount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between font-medium">
                          <span>Final Amount:</span>
                          <span>${getFinalAmount(amount).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="coupon" className="block text-sm font-medium text-muted-foreground">
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

                <Button
                  className="w-full"
                  onClick={() => selectedPaymentMethodId && handlePayment(selectedPaymentMethodId)}
                  disabled={!amount || processing || !selectedPaymentMethodId}
                >
                  {processing ? "Processing..." : `Pay $${getFinalAmount(amount).toFixed(2)}`}
                </Button>
                {!selectedPaymentMethodId && <p className="text-center text-sm text-muted-foreground">Please select a payment method above</p>}
              </div>
            </div>
          )}
        </div>
      </div>

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
            onClick: () => {
              setShowDeleteConfirmation(false);
              setCardToDelete(undefined);
            },
            side: "left"
          },
          {
            label: "Remove",
            onClick: confirmRemovePaymentMethod,
            variant: "destructive",
            disabled: isRemovingPaymentMethod,
            side: "right"
          }
        ]}
      >
        <p>Are you sure you want to remove this payment method? This action cannot be undone.</p>
      </Popup>

      <Popup open={showAddPaymentMethod} onClose={() => setShowAddPaymentMethod(false)} title="Add New Card" variant="custom" actions={[]}>
        {clientSecret && (
          <Elements
            stripe={getStripe()}
            options={{
              clientSecret,
              appearance: {
                theme: isDarkMode ? "night" : "stripe",
                variables: {
                  colorPrimary: "#ff424c"
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
