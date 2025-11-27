import type { ReactNode } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FormattedNumber } from "react-intl";
import { Alert, Button, Snackbar, Spinner, Switch } from "@akashnetwork/ui/components";
import { EditPencil, Plus, Xmark } from "iconoir-react";
import { useTheme } from "next-themes";
import { useSnackbar } from "notistack";

import { BillingContainer } from "@src/components/billing-usage/BillingContainer/BillingContainer";
import { BillingView } from "@src/components/billing-usage/BillingView/BillingView";
import Layout from "@src/components/layout/Layout";
import { ThreeDSecurePopup } from "@src/components/shared/PaymentMethodForm/ThreeDSecurePopup";
import { PaymentMethodsList } from "@src/components/shared/PaymentMethodsList";
import { Title } from "@src/components/shared/Title";
import {
  AddPaymentMethodPopup,
  AutoReloadSettingsPopup,
  DEFAULT_RELOAD_AMOUNT,
  DEFAULT_THRESHOLD,
  DeletePaymentMethodPopup,
  PaymentForm
} from "@src/components/user/payment";
import { PaymentPopup } from "@src/components/user/payment/PaymentPopup";
import { PaymentSuccessAnimation } from "@src/components/user/payment/PaymentSuccessAnimation";
import { usePaymentPolling } from "@src/context/PaymentPollingProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useWallet } from "@src/context/WalletProvider";
import { use3DSecure } from "@src/hooks/use3DSecure";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { usePaymentMethodsQuery, usePaymentMutations, useSetupIntentMutation, useWalletSettingsMutations, useWalletSettingsQuery } from "@src/queries";
import { handleCouponError, handleStripeError } from "@src/utils/stripeErrorHandler";
import { withCustomPageAuthRequired } from "@src/utils/withCustomPageAuthRequired";

const MINIMUM_PAYMENT_AMOUNT = 20;

type HalfBoxProps = {
  title: string;
  children: ReactNode;
  icon: ReactNode;
  buttonVariant?: any;
  buttonDisabled?: boolean;
  onClick: () => void;
};
const HalfBox: React.FC<HalfBoxProps> = ({ title, children, icon, buttonVariant = "default", buttonDisabled, onClick }: HalfBoxProps) => {
  return (
    <div className="col-span-6 flex justify-between rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
      <div>
        <div className="font-bold">{title}</div>
        {children}
      </div>
      <div className="self-end">
        <Button variant={buttonVariant} size="icon" className="h-8 w-8 text-xs" onClick={onClick} disabled={!!buttonDisabled}>
          {icon}
        </Button>
      </div>
    </div>
  );
};

type WideBoxProps = {
  title?: string;
  children: ReactNode;
};
const WideBox: React.FC<WideBoxProps> = ({ title, children }: WideBoxProps) => {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
      {title && <h3 className="px-4 pb-3 pt-4 text-xl font-semibold sm:text-2xl">{title}</h3>}
      {children}
    </div>
  );
};

const PayPage: React.FunctionComponent = () => {
  const { resolvedTheme } = useTheme();
  const [amount, setAmount] = useState<string>("");
  const [coupon, setCoupon] = useState<string>("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | undefined>();
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showAutoReloadSettings, setShowAutoReloadSettings] = useState(false);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
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
  const { data: setupIntent, mutate: createSetupIntent, reset: resetSetupIntent } = useSetupIntentMutation();
  const {
    confirmPayment: { isPending: isConfirmingPayment, mutateAsync: confirmPayment },
    applyCoupon: { isPending: isApplyingCoupon, mutateAsync: applyCoupon },
    removePaymentMethod
  } = usePaymentMutations();
  const { pollForPayment, isPolling } = usePaymentPolling();
  const threeDSecure = use3DSecure({
    onSuccess: () => {
      pollForPayment();
      setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
      setAmount("");
      setCoupon("");
    },
    showSuccessMessage: false
  });
  const { settings } = useSettings();
  const isAutoCreditReloadEnabled = useFlag("auto_credit_reload");
  const { balance: walletBalance, isLoading: isWalletBalanceLoading } = useWalletBalance();
  const { data: walletSettings } = useWalletSettingsQuery();
  const { updateWalletSettings, createWalletSettings } = useWalletSettingsMutations();

  const isLoading = isLoadingPaymentMethods;
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
        pollForPayment();
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
        pollForPayment();
        setShowPaymentSuccess({ amount: response.amountAdded.toString(), show: true });
      }

      enqueueSnackbar(<Snackbar title="Coupon applied successfully!" iconVariant="success" />, { variant: "success", autoHideDuration: 5_000 });
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

  const handleReloadChange = useCallback(
    async (autoReloadEnabled: boolean) => {
      const settings = {
        autoReloadEnabled,
        autoReloadThreshold: walletSettings?.autoReloadThreshold || DEFAULT_THRESHOLD,
        autoReloadAmount: walletSettings?.autoReloadAmount || DEFAULT_RELOAD_AMOUNT
      };

      if (walletSettings) {
        await updateWalletSettings.mutateAsync(settings);
      } else {
        await createWalletSettings.mutateAsync(settings);
      }

      enqueueSnackbar(<Snackbar title={`Auto Reload ${autoReloadEnabled ? "enabled" : "disabled"}`} iconVariant="success" />, {
        variant: "success",
        autoHideDuration: 3000
      });
    },
    [createWalletSettings, enqueueSnackbar, updateWalletSettings, walletSettings]
  );

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
      {isAutoCreditReloadEnabled ? (
        <div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <HalfBox
              title="Credits Remaining"
              icon={<Plus />}
              buttonDisabled={isWalletBalanceLoading || !selectedPaymentMethodId}
              onClick={() => setShowPaymentPopup(true)}
            >
              {walletBalance && !isWalletBalanceLoading ? (
                <div className="mt-4 text-3xl font-bold">
                  <FormattedNumber
                    value={walletBalance.totalDeploymentGrantsUSD}
                    // eslint-disable-next-line react/style-prop-object
                    style="currency"
                    currency="USD"
                  />
                </div>
              ) : (
                <Spinner size="medium" className="mt-4" />
              )}
            </HalfBox>

            <HalfBox
              title="Auto Reload"
              icon={<EditPencil />}
              buttonVariant="secondary"
              buttonDisabled={paymentMethods.length === 0}
              onClick={() => setShowAutoReloadSettings(true)}
            >
              <div>
                <div className="pt-4">
                  <Switch checked={walletSettings?.autoReloadEnabled} onCheckedChange={handleReloadChange} disabled={paymentMethods.length === 0} />
                </div>
                <div className="pt-2 text-sm">
                  Reload ${walletSettings?.autoReloadAmount || DEFAULT_RELOAD_AMOUNT} when &lt; ${walletSettings?.autoReloadThreshold || DEFAULT_THRESHOLD}
                </div>
              </div>
            </HalfBox>
          </div>

          <WideBox title="Payment Methods">
            <div className="px-4 pb-4">
              <PaymentMethodsList
                paymentMethods={paymentMethods}
                isRemoving={removePaymentMethod.isPending}
                onRemovePaymentMethod={handleRemovePaymentMethod}
                isSelectable={true}
                selectedPaymentMethodId={selectedPaymentMethodId}
                onPaymentMethodSelect={setSelectedPaymentMethodId}
                isTrialing={isTrialing}
                displayOnCard={false}
              />
            </div>
            <div className="flex justify-between bg-secondary px-4">
              <div className="self-center text-gray-500">At most, 3 cards can be used at once.</div>
              <Button onClick={handleShowAddPaymentMethod} className="mb-4 mt-4">
                Add New Payment Method
              </Button>
            </div>
          </WideBox>

          <WideBox>
            <div className="px-4 py-4">
              <BillingContainer>{props => <BillingView {...props} />}</BillingContainer>
            </div>
          </WideBox>

          <PaymentSuccessAnimation
            show={showPaymentSuccess.show}
            amount={showPaymentSuccess.amount}
            onComplete={() => setShowPaymentSuccess({ amount: "", show: false })}
          />
        </div>
      ) : (
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
                {settings.isBlockchainDown && (
                  <Alert variant="warning" className="mb-4">
                    <p className="font-medium">
                      We are currently experiencing a temporary blockchain outage, which may cause delays in processing your payments. Once the blockchain is
                      back online, all pending transactions will be processed automatically.
                      <br />
                      If you encounter any issues or have urgent concerns, please don’t hesitate to reach out to us — we’re here to help.
                    </p>
                  </Alert>
                )}
                <PaymentForm
                  amount={amount}
                  onAmountChange={handleAmountChange}
                  amountError={amountError}
                  coupon={coupon}
                  onCouponChange={handleCouponChange}
                  onClaimCoupon={handleClaimCoupon}
                  processing={isConfirmingPayment || isPolling}
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
      )}

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

      {showPaymentPopup && (
        <PaymentPopup
          open={showPaymentPopup}
          onClose={() => setShowPaymentPopup(false)}
          selectedPaymentMethodId={selectedPaymentMethodId}
          setShowPaymentSuccess={setShowPaymentSuccess}
        />
      )}

      {showAutoReloadSettings && <AutoReloadSettingsPopup open={showAutoReloadSettings} onClose={() => setShowAutoReloadSettings(false)} />}

      {threeDSecure.threeDSData?.clientSecret && (
        <ThreeDSecurePopup
          isOpen={threeDSecure.isOpen}
          onSuccess={threeDSecure.handle3DSSuccess}
          onError={threeDSecure.handle3DSError}
          clientSecret={threeDSecure.threeDSData.clientSecret}
          paymentIntentId={threeDSecure.threeDSData.paymentIntentId}
          paymentMethodId={threeDSecure.threeDSData.paymentMethodId}
          title="Payment Authentication"
          description="Your bank requires additional verification for this payment."
          successMessage="Payment authenticated successfully!"
          errorMessage="Please try again or use a different payment method."
        />
      )}
    </Layout>
  );
};

export default PayPage;

export const getServerSideProps = withCustomPageAuthRequired({
  getServerSideProps: defineServerSideProps({
    route: "/payment"
  })
});
