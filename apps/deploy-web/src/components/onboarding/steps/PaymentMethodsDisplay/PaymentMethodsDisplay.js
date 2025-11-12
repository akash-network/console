"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodsDisplay = void 0;
var react_1 = require("react");
var PaymentMethodsList_1 = require("@src/components/shared/PaymentMethodsList");
var EmptyPaymentMethods_1 = require("./EmptyPaymentMethods");
var ErrorAlert_1 = require("./ErrorAlert");
var TermsAndConditions_1 = require("./TermsAndConditions");
var TrialStartButton_1 = require("./TrialStartButton");
var PaymentMethodsDisplay = function (_a) {
    var paymentMethods = _a.paymentMethods, onRemovePaymentMethod = _a.onRemovePaymentMethod, onStartTrial = _a.onStartTrial, isLoading = _a.isLoading, isRemoving = _a.isRemoving, managedWalletError = _a.managedWalletError, hasPaymentMethod = _a.hasPaymentMethod;
    return (<div className="space-y-6">
      <div className="mx-auto max-w-md">
        <h3 className="mb-4 text-center text-lg font-semibold">Your Payment Methods</h3>

        {paymentMethods.length === 0 ? (<EmptyPaymentMethods_1.EmptyPaymentMethods />) : (<PaymentMethodsList_1.PaymentMethodsList paymentMethods={paymentMethods} isRemoving={isRemoving} onRemovePaymentMethod={onRemovePaymentMethod}/>)}
      </div>

      <ErrorAlert_1.ErrorAlert error={managedWalletError}/>

      <TrialStartButton_1.TrialStartButton isLoading={isLoading} disabled={!hasPaymentMethod || isLoading} onClick={onStartTrial}/>

      <TermsAndConditions_1.TermsAndConditions />
    </div>);
};
exports.PaymentMethodsDisplay = PaymentMethodsDisplay;
