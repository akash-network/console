import React from "react";
import { FormattedNumber } from "react-intl";
import type { Discount } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, LoadingButton, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

interface PaymentFormProps {
  amount: string;
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  amountError?: string;
  coupon: string;
  onCouponChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClaimCoupon: () => void;
  discounts: Discount[];
  getFinalAmount: (amount: string) => number;
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
  discounts,
  getFinalAmount,
  processing,
  selectedPaymentMethodId,
  onPayment,
  isApplyingCoupon
}) => {
  return (
    <div className="space-y-4">
      <div>
        <div className="mt-1">
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
      </div>

      {discounts.length > 0 && (
        <Card>
          <CardHeader className={cn({ "border-b": !!amount })}>
            <CardTitle>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Coupon Applied</span>
                <div className="flex gap-2">
                  {discounts.map(discount => (
                    <Badge key={discount.id} className="text-xs">
                      {discount.type === "promotion_code" ? discount.code : discount.name}
                      {" - "}
                      <span className="ml-1">
                        {discount.percent_off ? (
                          `${discount.percent_off}%`
                        ) : discount.amount_off ? (
                          <FormattedNumber value={discount.amount_off / 100} style="currency" currency="USD" />
                        ) : (
                          ""
                        )}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          {!!amount && (
            <CardContent>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>${Number(amount).toFixed(2)}</span>
                </div>
                {discounts.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="text-success">-${(Number(amount) - getFinalAmount(amount)).toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex items-center justify-between font-medium">
                  <span className="text-muted-foreground">Final Amount:</span>
                  <span>${getFinalAmount(amount).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div>
        <div className="mt-1 flex w-full items-end gap-2">
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
          <LoadingButton loading={isApplyingCoupon} onClick={onClaimCoupon} disabled={!coupon || processing}>
            Claim coupon
          </LoadingButton>
        </div>
      </div>

      <LoadingButton
        loading={processing}
        className="w-full"
        onClick={() => selectedPaymentMethodId && onPayment(selectedPaymentMethodId)}
        disabled={!amount || processing || !selectedPaymentMethodId || !!amountError}
      >
        {processing ? (
          "Processing..."
        ) : (
          <>
            Pay <FormattedNumber value={getFinalAmount(amount)} style="currency" currency="USD" />
          </>
        )}
      </LoadingButton>
      {!selectedPaymentMethodId && <p className="text-center text-sm text-muted-foreground">Please select a payment method above</p>}
    </div>
  );
};
