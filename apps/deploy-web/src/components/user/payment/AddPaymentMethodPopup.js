"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPaymentMethodPopup = void 0;
var react_1 = require("react");
var react_error_boundary_1 = require("react-error-boundary");
var components_1 = require("@akashnetwork/ui/components");
var react_stripe_js_1 = require("@stripe/react-stripe-js");
var shared_1 = require("@src/components/shared");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var AddPaymentMethodPopup = function (_a) {
    var open = _a.open, onClose = _a.onClose, clientSecret = _a.clientSecret, isDarkMode = _a.isDarkMode, onSuccess = _a.onSuccess;
    var stripeService = (0, ServicesProvider_1.useServices)().stripeService;
    var stripePromise = (0, react_1.useMemo)(function () { return stripeService.getStripe(); }, [stripeService]);
    return (<components_1.Popup open={open} onClose={onClose} title="Add New Payment Method" variant="custom" actions={[]}>
      {clientSecret && (<react_error_boundary_1.ErrorBoundary fallback={<div>Failed to load payment form</div>}>
          {stripePromise ? (<react_stripe_js_1.Elements key={clientSecret} stripe={stripePromise} options={{
                    clientSecret: clientSecret,
                    appearance: {
                        theme: isDarkMode ? "night" : "stripe",
                        variables: {
                            colorPrimary: "#ff424c",
                            colorSuccess: "#ff424c"
                        }
                    }
                }}>
              <shared_1.PaymentMethodForm onSuccess={onSuccess} buttonText="Add Card" processingText="Processing..."/>
            </react_stripe_js_1.Elements>) : (<div className="p-4 text-center text-muted-foreground">
              Payment processing is not available at this time. Please try again later or contact support if the issue persists.
            </div>)}
        </react_error_boundary_1.ErrorBoundary>)}
    </components_1.Popup>);
};
exports.AddPaymentMethodPopup = AddPaymentMethodPopup;
