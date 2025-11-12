"use strict";
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
exports.getServerSideProps = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var next_themes_1 = require("next-themes");
var notistack_1 = require("notistack");
var Layout_1 = require("@src/components/layout/Layout");
var ThreeDSecurePopup_1 = require("@src/components/shared/PaymentMethodForm/ThreeDSecurePopup");
var PaymentMethodsList_1 = require("@src/components/shared/PaymentMethodsList");
var Title_1 = require("@src/components/shared/Title");
var payment_1 = require("@src/components/user/payment");
var PaymentSuccessAnimation_1 = require("@src/components/user/payment/PaymentSuccessAnimation");
var PaymentPollingProvider_1 = require("@src/context/PaymentPollingProvider");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var use3DSecure_1 = require("@src/hooks/use3DSecure");
var useUser_1 = require("@src/hooks/useUser");
var defineServerSideProps_1 = require("@src/lib/nextjs/defineServerSideProps/defineServerSideProps");
var queries_1 = require("@src/queries");
var stripeErrorHandler_1 = require("@src/utils/stripeErrorHandler");
var withCustomPageAuthRequired_1 = require("@src/utils/withCustomPageAuthRequired");
var MINIMUM_PAYMENT_AMOUNT = 20;
var PayPage = function () {
    var _a;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var _b = (0, react_1.useState)(""), amount = _b[0], setAmount = _b[1];
    var _c = (0, react_1.useState)(""), coupon = _c[0], setCoupon = _c[1];
    var _d = (0, react_1.useState)(), selectedPaymentMethodId = _d[0], setSelectedPaymentMethodId = _d[1];
    var _e = (0, react_1.useState)(false), showAddPaymentMethod = _e[0], setShowAddPaymentMethod = _e[1];
    var _f = (0, react_1.useState)(false), showDeleteConfirmation = _f[0], setShowDeleteConfirmation = _f[1];
    var _g = (0, react_1.useState)(), cardToDelete = _g[0], setCardToDelete = _g[1];
    var _h = (0, react_1.useState)(), amountError = _h[0], setAmountError = _h[1];
    var _j = (0, react_1.useState)({ amount: "", show: false }), showPaymentSuccess = _j[0], setShowPaymentSuccess = _j[1];
    var _k = (0, react_1.useState)(), error = _k[0], setError = _k[1];
    var _l = (0, react_1.useState)(), errorAction = _l[0], setErrorAction = _l[1];
    var submittedAmountRef = (0, react_1.useRef)("");
    var isDarkMode = resolvedTheme === "dark";
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var user = (0, useUser_1.useUser)().user;
    var _m = (0, queries_1.usePaymentMethodsQuery)(), _o = _m.data, paymentMethods = _o === void 0 ? [] : _o, isLoadingPaymentMethods = _m.isLoading, refetchPaymentMethods = _m.refetch;
    var _p = (0, queries_1.useSetupIntentMutation)(), setupIntent = _p.data, createSetupIntent = _p.mutate, resetSetupIntent = _p.reset;
    var _q = (0, queries_1.usePaymentMutations)(), _r = _q.confirmPayment, isConfirmingPayment = _r.isPending, confirmPayment = _r.mutateAsync, _s = _q.applyCoupon, isApplyingCoupon = _s.isPending, applyCoupon = _s.mutateAsync, removePaymentMethod = _q.removePaymentMethod;
    var _t = (0, PaymentPollingProvider_1.usePaymentPolling)(), pollForPayment = _t.pollForPayment, isPolling = _t.isPolling;
    var threeDSecure = (0, use3DSecure_1.use3DSecure)({
        onSuccess: function () {
            pollForPayment();
            setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
            setAmount("");
            setCoupon("");
        },
        showSuccessMessage: false
    });
    var settings = (0, SettingsProvider_1.useSettings)().settings;
    var isLoading = isLoadingPaymentMethods;
    var isTrialing = (0, WalletProvider_1.useWallet)().isTrialing;
    (0, react_1.useEffect)(function () {
        if (paymentMethods.length > 0) {
            if (!selectedPaymentMethodId || !paymentMethods.some(function (method) { return method.id === selectedPaymentMethodId; })) {
                setSelectedPaymentMethodId(paymentMethods[0].id);
            }
        }
    }, [paymentMethods, selectedPaymentMethodId]);
    (0, react_1.useEffect)(function () {
        if (amount) {
            validateAmount(parseFloat(amount));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount]);
    var clearError = function () {
        if (error) {
            setError(undefined);
            setErrorAction(undefined);
        }
    };
    var handlePayment = function (paymentMethodId) { return __awaiter(void 0, void 0, void 0, function () {
        var response, error_1, errorInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!amount)
                        return [2 /*return*/];
                    if (!selectedPaymentMethodId || !paymentMethods.some(function (method) { return method.id === selectedPaymentMethodId; }))
                        return [2 /*return*/];
                    // Capture the submitted amount before starting the payment flow
                    submittedAmountRef.current = amount;
                    clearError();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, confirmPayment({
                            userId: (user === null || user === void 0 ? void 0 : user.id) || "",
                            paymentMethodId: paymentMethodId,
                            amount: parseFloat(amount),
                            currency: "usd"
                        })];
                case 2:
                    response = _a.sent();
                    if (response && response.requiresAction && response.clientSecret && response.paymentIntentId) {
                        threeDSecure.start3DSecure({
                            clientSecret: response.clientSecret,
                            paymentIntentId: response.paymentIntentId,
                            paymentMethodId: paymentMethodId
                        });
                    }
                    else if (response.success) {
                        pollForPayment();
                        setShowPaymentSuccess({ amount: submittedAmountRef.current, show: true });
                        setAmount("");
                        setCoupon("");
                    }
                    else {
                        throw new Error("Payment failed");
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("Payment confirmation failed:", error_1);
                    errorInfo = (0, stripeErrorHandler_1.handleStripeError)(error_1);
                    setError(errorInfo.message);
                    setErrorAction(errorInfo.userAction);
                    enqueueSnackbar(<components_1.Snackbar title={errorInfo.message} iconVariant="error"/>, { variant: "error" });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleAddCardSuccess = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setShowAddPaymentMethod(false);
            refetchPaymentMethods();
            return [2 /*return*/];
        });
    }); };
    var handleShowAddPaymentMethod = function () {
        resetSetupIntent();
        createSetupIntent();
        setShowAddPaymentMethod(true);
    };
    var handleClaimCoupon = function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, errorInfo, error_2, errorInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!coupon)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, applyCoupon({ coupon: coupon, userId: (user === null || user === void 0 ? void 0 : user.id) || "" })];
                case 2:
                    response = _a.sent();
                    if (response.error) {
                        errorInfo = (0, stripeErrorHandler_1.handleCouponError)(response);
                        enqueueSnackbar(<components_1.Snackbar title={errorInfo.message} iconVariant="error"/>, { variant: "error" });
                        return [2 /*return*/];
                    }
                    if (response.amountAdded && response.amountAdded > 0) {
                        pollForPayment();
                        setShowPaymentSuccess({ amount: response.amountAdded.toString(), show: true });
                    }
                    enqueueSnackbar(<components_1.Snackbar title="Coupon applied successfully!" iconVariant="success"/>, { variant: "success", autoHideDuration: 5000 });
                    setCoupon("");
                    return [3 /*break*/, 4];
                case 3:
                    error_2 = _a.sent();
                    errorInfo = (0, stripeErrorHandler_1.handleStripeError)(error_2);
                    enqueueSnackbar(<components_1.Snackbar title={errorInfo.message} iconVariant="error"/>, { variant: "error" });
                    console.error("Coupon application error:", error_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleRemovePaymentMethod = function (paymentMethodId) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setCardToDelete(paymentMethodId);
            setShowDeleteConfirmation(true);
            return [2 /*return*/];
        });
    }); };
    var confirmRemovePaymentMethod = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_3, errorInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!cardToDelete)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, removePaymentMethod.mutateAsync(cardToDelete)];
                case 2:
                    _a.sent();
                    setSelectedPaymentMethodId(undefined);
                    enqueueSnackbar(<components_1.Snackbar title="Payment method removed successfully" iconVariant="success"/>, { variant: "success" });
                    return [3 /*break*/, 5];
                case 3:
                    error_3 = _a.sent();
                    console.error("Failed to remove payment method:", error_3);
                    errorInfo = (0, stripeErrorHandler_1.handleStripeError)(error_3);
                    enqueueSnackbar(<components_1.Snackbar title={errorInfo.message} iconVariant="error"/>, { variant: "error" });
                    return [3 /*break*/, 5];
                case 4:
                    setShowDeleteConfirmation(false);
                    setCardToDelete(undefined);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var validateAmount = function (value) {
        if (value <= 0) {
            setAmountError("Amount must be greater than $0");
            return false;
        }
        if (value < MINIMUM_PAYMENT_AMOUNT) {
            setAmountError("Minimum amount is $".concat(MINIMUM_PAYMENT_AMOUNT));
            return false;
        }
        setAmountError(undefined);
        return true;
    };
    var handleAmountChange = function (e) {
        var value = e.target.value;
        setAmount(value);
        clearError();
        if (value !== "") {
            validateAmount(parseFloat(value));
        }
        else {
            setAmountError(undefined);
        }
    };
    var handleCouponChange = function (e) {
        var value = e.target.value;
        setCoupon(value);
        clearError();
    };
    if (isLoading) {
        return (<Layout_1.default>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"/>
            <p className="text-muted-foreground">Loading payment information...</p>
          </div>
        </div>
      </Layout_1.default>);
    }
    return (<Layout_1.default isLoading={isLoading}>
      <div className="py-12">
        <Title_1.Title className="text-center">Payment Methods</Title_1.Title>
        <p className="mt-4 text-center text-gray-600">Manage your payment methods and make payments.</p>

        <div className="mx-auto max-w-md py-6">
          <PaymentSuccessAnimation_1.PaymentSuccessAnimation show={showPaymentSuccess.show} amount={showPaymentSuccess.amount} onComplete={function () { return setShowPaymentSuccess({ amount: "", show: false }); }}/>
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-semibold">Your Payment Methods</h2>
            <PaymentMethodsList_1.PaymentMethodsList paymentMethods={paymentMethods} isRemoving={removePaymentMethod.isPending} onRemovePaymentMethod={handleRemovePaymentMethod} isSelectable={true} selectedPaymentMethodId={selectedPaymentMethodId} onPaymentMethodSelect={setSelectedPaymentMethodId} isTrialing={isTrialing}/>
            <components_1.Button onClick={handleShowAddPaymentMethod} className="mt-4 w-full">
              Add New Payment Method
            </components_1.Button>
          </div>

          {paymentMethods.length > 0 && (<div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Add credits</h2>
              {settings.isBlockchainDown && (<components_1.Alert variant="warning" className="mb-4">
                  <p className="font-medium">
                    We are currently experiencing a temporary blockchain outage, which may cause delays in processing your payments. Once the blockchain is back
                    online, all pending transactions will be processed automatically.
                    <br />
                    If you encounter any issues or have urgent concerns, please don’t hesitate to reach out to us — we’re here to help.
                  </p>
                </components_1.Alert>)}
              <payment_1.PaymentForm amount={amount} onAmountChange={handleAmountChange} amountError={amountError} coupon={coupon} onCouponChange={handleCouponChange} onClaimCoupon={handleClaimCoupon} processing={isConfirmingPayment || isPolling} selectedPaymentMethodId={selectedPaymentMethodId} onPayment={handlePayment} isApplyingCoupon={isApplyingCoupon}/>

              {/* Show error inline if there's a critical error */}
              {error && (<div className="mx-auto mt-6 max-w-md">
                  <components_1.Alert variant="destructive" className="mb-4">
                    <p className="font-medium">Error Loading Payment Information</p>
                    <p className="text-sm">{error}</p>
                    {errorAction && (<p className="mt-2 text-sm text-muted-foreground">
                        <strong>Suggestion:</strong> {errorAction}
                      </p>)}
                    <components_1.Button onClick={clearError} variant="default" size="sm" className="mt-2">
                      <iconoir_react_1.Xmark className="mr-2 h-4 w-4"/>
                      Clear Error
                    </components_1.Button>
                  </components_1.Alert>
                </div>)}
            </div>)}
        </div>
      </div>

      <payment_1.DeletePaymentMethodPopup open={showDeleteConfirmation} onClose={function () {
            setShowDeleteConfirmation(false);
            setCardToDelete(undefined);
        }} onConfirm={confirmRemovePaymentMethod} isRemovingPaymentMethod={removePaymentMethod.isPending}/>

      <payment_1.AddPaymentMethodPopup open={showAddPaymentMethod} onClose={function () { return setShowAddPaymentMethod(false); }} clientSecret={setupIntent === null || setupIntent === void 0 ? void 0 : setupIntent.clientSecret} isDarkMode={isDarkMode} onSuccess={handleAddCardSuccess}/>

      {((_a = threeDSecure.threeDSData) === null || _a === void 0 ? void 0 : _a.clientSecret) && (<ThreeDSecurePopup_1.ThreeDSecurePopup isOpen={threeDSecure.isOpen} onSuccess={threeDSecure.handle3DSSuccess} onError={threeDSecure.handle3DSError} clientSecret={threeDSecure.threeDSData.clientSecret} paymentIntentId={threeDSecure.threeDSData.paymentIntentId} paymentMethodId={threeDSecure.threeDSData.paymentMethodId} title="Payment Authentication" description="Your bank requires additional verification for this payment." successMessage="Payment authenticated successfully!" errorMessage="Please try again or use a different payment method."/>)}
    </Layout_1.default>);
};
exports.default = PayPage;
exports.getServerSideProps = (0, withCustomPageAuthRequired_1.withCustomPageAuthRequired)({
    getServerSideProps: (0, defineServerSideProps_1.defineServerSideProps)({
        route: "/payment"
    })
});
