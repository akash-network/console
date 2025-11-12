"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentForm = void 0;
var react_1 = require("react");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var PaymentForm = function (_a) {
    var amount = _a.amount, onAmountChange = _a.onAmountChange, amountError = _a.amountError, coupon = _a.coupon, onCouponChange = _a.onCouponChange, onClaimCoupon = _a.onClaimCoupon, processing = _a.processing, selectedPaymentMethodId = _a.selectedPaymentMethodId, onPayment = _a.onPayment, isApplyingCoupon = _a.isApplyingCoupon;
    return (<div className="space-y-4">
      <div>
        <div className="mt-1">
          <components_1.Input error={!!amountError} type="number" name="amount" id="amount" min="0" step="0.01" value={amount} onChange={onAmountChange} placeholder="0.00" label="Amount (USD)"/>
          {amountError && <p className="mt-2 text-sm text-destructive">{amountError}</p>}
        </div>
      </div>

      <div>
        <div className="mt-1 flex w-full items-end gap-2">
          <components_1.Input type="text" name="coupon" id="coupon" className="flex-grow" value={coupon} onChange={onCouponChange} placeholder="Enter coupon code" label="Coupon Code"/>
          <components_1.LoadingButton loading={isApplyingCoupon} onClick={onClaimCoupon} disabled={!coupon || processing || isApplyingCoupon}>
            Claim coupon
          </components_1.LoadingButton>
        </div>
      </div>

      <components_1.LoadingButton loading={processing} className="w-full" onClick={function () { return selectedPaymentMethodId && onPayment(selectedPaymentMethodId); }} disabled={!amount || parseFloat(amount) <= 0 || processing || !selectedPaymentMethodId || !!amountError}>
        {processing ? ("Processing...") : (<>
            Pay <react_intl_1.FormattedNumber value={parseFloat(amount) || 0} style="currency" currency="USD"/>
          </>)}
      </components_1.LoadingButton>
      {!selectedPaymentMethodId && <p className="text-center text-sm text-muted-foreground">Please select a payment method above</p>}
    </div>);
};
exports.PaymentForm = PaymentForm;
