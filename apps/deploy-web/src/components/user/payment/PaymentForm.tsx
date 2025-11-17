import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, LoadingButton } from "@akashnetwork/ui/components";

interface PaymentFormProps {
  amount: string;
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  amountError?: string;
  coupon: string;
  onCouponChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClaimCoupon: () => void;
  processing: boolean;
  isApplyingCoupon: boolean;
  selectedPaymentMethodId?: string;
  onPayment: (paymentMethodId: string) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  onAmountChange,
  amountError,
  coupon,
  onCouponChange,
  onClaimCoupon,
  processing,
  selectedPaymentMethodId,
  onPayment,
  isApplyingCoupon
}) => {
  const disabled = true || !amount || parseFloat(amount) <= 0 || processing || !selectedPaymentMethodId || !!amountError;
  const disabledCoupon = true || !coupon || processing || isApplyingCoupon;

  return (
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
            loading={processing}
            className="w-full"
            onClick={() => selectedPaymentMethodId && onPayment(selectedPaymentMethodId)}
            disabled={disabled}
          >
            {processing ? (
              "Processing..."
            ) : (
              <>
                Pay <FormattedNumber value={parseFloat(amount) || 0} style="currency" currency="USD" />
              </>
            )}
          </LoadingButton>
          {!selectedPaymentMethodId && <p className="text-center text-sm text-muted-foreground">Please select a payment method above</p>}
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
  );
};
