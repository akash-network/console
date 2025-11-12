"use strict";
"use client";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThreeDSecureModal = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var react_stripe_js_1 = require("@stripe/react-stripe-js");
var iconoir_react_1 = require("iconoir-react");
var next_themes_1 = require("next-themes");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var SUCCESS_DELAY = 1500;
var SUCCESSFUL_STATUSES = ["succeeded", "requires_capture", "processing"];
var ThreeDSecureForm = function (_a) {
    var clientSecret = _a.clientSecret, _paymentIntentId = _a.paymentIntentId, paymentMethodId = _a.paymentMethodId, onSuccess = _a.onSuccess, onError = _a.onError, _b = _a.title, _title = _b === void 0 ? "Card Authentication" : _b, _c = _a.description, description = _c === void 0 ? "Your bank requires additional verification for this transaction." : _c, _d = _a.successMessage, successMessage = _d === void 0 ? "Your card has been verified successfully." : _d, _e = _a.errorMessage, errorMessage = _e === void 0 ? "Please try again or use a different payment method." : _e, _f = _a.hideTitle, hideTitle = _f === void 0 ? false : _f;
    var stripe = (0, react_stripe_js_1.useStripe)();
    var elements = (0, react_stripe_js_1.useElements)();
    var _g = (0, react_1.useState)("processing"), status = _g[0], setStatus = _g[1];
    var _h = (0, react_1.useState)(""), errorMsg = _h[0], setErrorMsg = _h[1];
    var authenticationInProgress = (0, react_1.useRef)(false);
    var handleAuthenticationFailure = (0, react_1.useCallback)(function (message) {
        setStatus("failed");
        setErrorMsg(message);
        onError(message);
    }, [onError]);
    var handleAuthenticationSuccess = (0, react_1.useCallback)(function (paymentIntentStatus) {
        console.log("3D Secure authentication successful, status:", paymentIntentStatus);
        setStatus("succeeded");
        setTimeout(function () {
            onSuccess();
        }, SUCCESS_DELAY);
    }, [onSuccess]);
    var processAuthenticationResult = (0, react_1.useCallback)(function (result) {
        var error = result.error, paymentIntent = result.paymentIntent;
        if (error) {
            console.error("3D Secure authentication error:", error);
            var errorMessage_1 = error.message || "Authentication failed";
            handleAuthenticationFailure(errorMessage_1);
            return;
        }
        if (!paymentIntent) {
            console.error("3D Secure authentication failed - no payment intent");
            handleAuthenticationFailure("Authentication failed. Please try again.");
            return;
        }
        if (SUCCESSFUL_STATUSES.includes(paymentIntent.status)) {
            handleAuthenticationSuccess(paymentIntent.status);
        }
        else if (paymentIntent.status === "requires_payment_method") {
            console.error("3D Secure authentication failed - payment method declined");
            var errorMessage_2 = "Your payment method was declined. Please try a different card.";
            handleAuthenticationFailure(errorMessage_2);
        }
        else {
            console.error("3D Secure authentication failed, unexpected status:", paymentIntent.status);
            var errorText = "Authentication failed. Status: ".concat(paymentIntent.status || "unknown");
            handleAuthenticationFailure(errorText);
        }
    }, [handleAuthenticationFailure, handleAuthenticationSuccess]);
    var performAuthentication = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, err_1, errorText;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!stripe || authenticationInProgress.current) {
                        if (authenticationInProgress.current) {
                            console.log("Authentication already in progress, skipping...");
                        }
                        return [2 /*return*/];
                    }
                    authenticationInProgress.current = true;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, stripe.confirmCardPayment(clientSecret, {
                            payment_method: paymentMethodId
                        })];
                case 2:
                    result = _a.sent();
                    console.log("3D Secure authentication result:", result);
                    processAuthenticationResult(result);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error("3D Secure authentication exception:", err_1);
                    errorText = err_1 instanceof Error ? err_1.message : "Authentication failed due to an unexpected error";
                    handleAuthenticationFailure(errorText);
                    return [3 /*break*/, 5];
                case 4:
                    authenticationInProgress.current = false;
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [stripe, clientSecret, paymentMethodId, processAuthenticationResult, handleAuthenticationFailure]);
    (0, react_1.useEffect)(function () {
        if (!stripe || !elements || status !== "processing") {
            return;
        }
        performAuthentication();
        return function () {
            authenticationInProgress.current = false;
        };
    }, [stripe, elements, status, performAuthentication, handleAuthenticationFailure]);
    if (status === "succeeded") {
        return (<div className="py-8 text-center">
        <div className="mb-4 flex justify-center">
          <iconoir_react_1.CheckCircle className="h-16 w-16 text-green-500"/>
        </div>
        <h3 className="mb-2 text-lg font-semibold">Authentication Successful!</h3>
        <p className="text-muted-foreground">{successMessage}</p>
      </div>);
    }
    if (status === "failed") {
        return (<div className="space-y-4 py-8 text-center">
        <div className="mb-4 flex justify-center">
          <iconoir_react_1.WarningTriangle className="h-16 w-16 text-red-500"/>
        </div>
        <h3 className="mb-2 text-lg font-semibold">Authentication Failed</h3>
        <p className="text-muted-foreground">{errorMsg}</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>);
    }
    return (<div className="py-8 text-center">
      {!hideTitle && (<div className="mb-6">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <iconoir_react_1.Shield className="h-8 w-8 text-primary"/>
            </div>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Secure Authentication</h3>
          <p className="text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">Please complete the authentication process to continue.</p>
        </div>)}
      <div className="mb-4 flex justify-center">
        <components_1.Spinner className="h-16 w-16 text-primary"/>
      </div>
      <h3 className="mb-2 text-lg font-semibold">Processing Authentication</h3>
      <p className="text-muted-foreground">Please wait while we verify your card with your bank...</p>
    </div>);
};
var ThreeDSecureModal = function (_a) {
    var clientSecret = _a.clientSecret, paymentIntentId = _a.paymentIntentId, paymentMethodId = _a.paymentMethodId, onSuccess = _a.onSuccess, onError = _a.onError, _b = _a.title, title = _b === void 0 ? "Card Authentication" : _b, _c = _a.description, description = _c === void 0 ? "Your bank requires additional verification for this transaction." : _c, _d = _a.successMessage, successMessage = _d === void 0 ? "Your card has been verified successfully." : _d, _e = _a.errorMessage, errorMessage = _e === void 0 ? "Please try again or use a different payment method." : _e, _f = _a.hideTitle, hideTitle = _f === void 0 ? false : _f;
    var stripeService = (0, ServicesProvider_1.useServices)().stripeService;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var isDarkMode = resolvedTheme === "dark";
    var stripePromise = stripeService.getStripe();
    if (!stripePromise) {
        return (<div className="py-8 text-center">
        <p className="text-muted-foreground">Payment processing is not available at this time. Please try again later.</p>
      </div>);
    }
    if (!clientSecret || clientSecret.trim() === "") {
        return (<div className="py-8 text-center">
        <p className="text-muted-foreground">Authentication data is missing. Please try again.</p>
      </div>);
    }
    return (<react_stripe_js_1.Elements key={clientSecret} stripe={stripePromise} options={{
            clientSecret: clientSecret,
            appearance: {
                theme: isDarkMode ? "night" : "stripe",
                variables: {
                    colorPrimary: "#ff424c",
                    colorSuccess: "#ff424c"
                }
            }
        }}>
      <ThreeDSecureForm clientSecret={clientSecret} paymentIntentId={paymentIntentId} paymentMethodId={paymentMethodId} onSuccess={onSuccess} onError={onError} title={title} description={description} successMessage={successMessage} errorMessage={errorMessage} hideTitle={hideTitle}/>
    </react_stripe_js_1.Elements>);
};
exports.ThreeDSecureModal = ThreeDSecureModal;
