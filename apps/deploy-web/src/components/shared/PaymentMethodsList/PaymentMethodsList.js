"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodsList = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var PaymentMethodCard_1 = require("../PaymentMethodCard/PaymentMethodCard");
var PaymentMethodsList = function (_a) {
    var paymentMethods = _a.paymentMethods, isRemoving = _a.isRemoving, onRemovePaymentMethod = _a.onRemovePaymentMethod, _b = _a.isSelectable, isSelectable = _b === void 0 ? false : _b, selectedPaymentMethodId = _a.selectedPaymentMethodId, onPaymentMethodSelect = _a.onPaymentMethodSelect, _c = _a.showValidationBadge, showValidationBadge = _c === void 0 ? true : _c, _d = _a.isTrialing, isTrialing = _d === void 0 ? false : _d;
    if (paymentMethods.length === 0) {
        return <p className="text-gray-500">No payment methods added yet.</p>;
    }
    if (isSelectable) {
        // Selection mode - used in payment page
        return (<div className="space-y-3">
        <components_1.Card className="rounded-lg border shadow-sm">
          <components_1.CardContent className="flex flex-col gap-4 pt-4">
            <components_1.RadioGroup value={selectedPaymentMethodId} onValueChange={onPaymentMethodSelect} className="space-y-2">
              {paymentMethods.map(function (method) { return (<PaymentMethodCard_1.PaymentMethodCard key={method.id} method={method} isRemoving={isRemoving} onRemove={onRemovePaymentMethod} isSelectable={true} isSelected={selectedPaymentMethodId === method.id} onSelect={onPaymentMethodSelect} isTrialing={isTrialing}/>); })}
            </components_1.RadioGroup>
          </components_1.CardContent>
        </components_1.Card>
      </div>);
    }
    // Display mode - used in onboarding
    return (<div className="space-y-4">
      {paymentMethods.map(function (method) { return (<PaymentMethodCard_1.PaymentMethodCard key={method.id} method={method} isRemoving={isRemoving} onRemove={onRemovePaymentMethod} showValidationBadge={showValidationBadge}/>); })}
    </div>);
};
exports.PaymentMethodsList = PaymentMethodsList;
