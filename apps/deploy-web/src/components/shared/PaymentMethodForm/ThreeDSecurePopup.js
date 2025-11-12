"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreeDSecurePopup = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var ThreeDSecureModal_1 = require("./ThreeDSecureModal");
var ThreeDSecurePopup = function (_a) {
    var isOpen = _a.isOpen, _onClose = _a.onClose, onSuccess = _a.onSuccess, onError = _a.onError, clientSecret = _a.clientSecret, paymentIntentId = _a.paymentIntentId, paymentMethodId = _a.paymentMethodId, _b = _a.title, title = _b === void 0 ? "Card Authentication" : _b, _c = _a.description, description = _c === void 0 ? "Your bank requires additional verification for this transaction." : _c, _d = _a.successMessage, successMessage = _d === void 0 ? "Your card has been verified successfully." : _d, _e = _a.errorMessage, errorMessage = _e === void 0 ? "Please try again or use a different payment method." : _e;
    return (<components_1.Popup variant="custom" title={title} open={isOpen} enableCloseOnBackdropClick={false} hideCloseButton maxWidth="sm" actions={[]}>
      <ThreeDSecureModal_1.ThreeDSecureModal clientSecret={clientSecret} paymentIntentId={paymentIntentId} paymentMethodId={paymentMethodId} onSuccess={onSuccess} onError={onError} title={title} description={description} successMessage={successMessage} errorMessage={errorMessage} hideTitle={true}/>
    </components_1.Popup>);
};
exports.ThreeDSecurePopup = ThreeDSecurePopup;
