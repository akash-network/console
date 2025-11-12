"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentMethodStep = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var react_stripe_js_1 = require("@stripe/react-stripe-js");
var iconoir_react_1 = require("iconoir-react");
var next_themes_1 = require("next-themes");
var ThreeDSecurePopup_1 = require("@src/components/shared/PaymentMethodForm/ThreeDSecurePopup");
var Title_1 = require("@src/components/shared/Title");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var PaymentMethodsDisplay_1 = require("../PaymentMethodsDisplay/PaymentMethodsDisplay");
var PaymentVerificationCard_1 = require("../PaymentVerificationCard/PaymentVerificationCard");
var PaymentMethodStep = function (_a) {
    var setupIntent = _a.setupIntent, paymentMethods = _a.paymentMethods, showAddForm = _a.showAddForm, showDeleteConfirmation = _a.showDeleteConfirmation, _cardToDelete = _a.cardToDelete, isLoading = _a.isLoading, isRemoving = _a.isRemoving, managedWalletError = _a.managedWalletError, onSuccess = _a.onSuccess, onRemovePaymentMethod = _a.onRemovePaymentMethod, onConfirmRemovePaymentMethod = _a.onConfirmRemovePaymentMethod, onNext = _a.onNext, onShowDeleteConfirmation = _a.onShowDeleteConfirmation, onSetCardToDelete = _a.onSetCardToDelete, hasPaymentMethod = _a.hasPaymentMethod, threeDSecure = _a.threeDSecure;
    var stripeService = (0, ServicesProvider_1.useServices)().stripeService;
    var stripePromise = (0, react_1.useMemo)(function () { return stripeService.getStripe(); }, [stripeService]);
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var isDarkMode = resolvedTheme === "dark";
    if (threeDSecure.isOpen && threeDSecure.threeDSData) {
        return (<ThreeDSecurePopup_1.ThreeDSecurePopup isOpen={threeDSecure.isOpen} onSuccess={threeDSecure.handle3DSSuccess} onError={threeDSecure.handle3DSError} clientSecret={threeDSecure.threeDSData.clientSecret} paymentIntentId={threeDSecure.threeDSData.paymentIntentId} paymentMethodId={threeDSecure.threeDSData.paymentMethodId} title="Card Authentication" description="Your bank requires additional verification for this transaction." successMessage="Your card has been verified. Proceeding to start your trial..." errorMessage="Please try again or use a different payment method."/>);
    }
    if (paymentMethods.length === 0 || showAddForm) {
        return (<div className="space-y-6 text-center">
        {(setupIntent === null || setupIntent === void 0 ? void 0 : setupIntent.clientSecret) && (<react_error_boundary_1.ErrorBoundary fallback={<div>Failed to load payment form</div>}>
            {stripePromise ? (<react_stripe_js_1.Elements key={setupIntent.clientSecret} stripe={stripePromise} options={{
                        clientSecret: setupIntent.clientSecret,
                        appearance: {
                            theme: isDarkMode ? "night" : "stripe",
                            variables: {
                                colorPrimary: "#ff424c",
                                colorSuccess: "#ff424c"
                            }
                        }
                    }}>
                <PaymentVerificationCard_1.PaymentVerificationCard setupIntent={setupIntent} onSuccess={onSuccess}/>
              </react_stripe_js_1.Elements>) : (<div className="p-4 text-center text-muted-foreground">
                Payment processing is not available at this time. Please try again later or contact support if the issue persists.
              </div>)}
          </react_error_boundary_1.ErrorBoundary>)}
      </div>);
    }
    // Render existing payment methods
    return (<div className="space-y-6 text-center">
      <Title_1.Title>Add Payment Method</Title_1.Title>

      <PaymentMethodsDisplay_1.PaymentMethodsDisplay paymentMethods={paymentMethods} onRemovePaymentMethod={onRemovePaymentMethod} onStartTrial={onNext} isLoading={isLoading} isRemoving={isRemoving} managedWalletError={managedWalletError} hasPaymentMethod={hasPaymentMethod}/>

      {paymentMethods.length === 0 && !showAddForm && (<components_1.Alert className="mx-auto max-w-md text-left" variant="warning">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-card p-3">
              <iconoir_react_1.CreditCard className="h-4 w-4" aria-hidden="true"/>
            </div>
            <div>
              <components_1.AlertTitle>Payment Method Required</components_1.AlertTitle>
              <components_1.AlertDescription>
                You must add a payment method to continue to the next step. Your card will be validated during the trial start process.
              </components_1.AlertDescription>
            </div>
          </div>
        </components_1.Alert>)}

      <components_1.Popup open={showDeleteConfirmation} onClose={function () {
            onShowDeleteConfirmation(false);
            onSetCardToDelete(undefined);
        }} title="Remove Payment Method" variant="custom" actions={[
            {
                label: "Cancel",
                variant: "ghost",
                onClick: function () {
                    onShowDeleteConfirmation(false);
                    onSetCardToDelete(undefined);
                },
                side: "left"
            },
            {
                label: "Remove",
                onClick: onConfirmRemovePaymentMethod,
                variant: "default",
                disabled: isRemoving,
                side: "right"
            }
        ]}>
        <p>Are you sure you want to remove this payment method?</p>
      </components_1.Popup>
    </div>);
};
exports.PaymentMethodStep = PaymentMethodStep;
