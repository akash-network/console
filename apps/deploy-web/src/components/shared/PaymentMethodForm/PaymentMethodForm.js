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
exports.PaymentMethodForm = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var react_stripe_js_1 = require("@stripe/react-stripe-js");
var PaymentMethodForm = function (_a) {
    var onSuccess = _a.onSuccess, _b = _a.buttonText, buttonText = _b === void 0 ? "Add Card" : _b, _c = _a.processingText, processingText = _c === void 0 ? "Processing..." : _c, _d = _a.className, className = _d === void 0 ? "" : _d;
    var stripe = (0, react_stripe_js_1.useStripe)();
    var elements = (0, react_stripe_js_1.useElements)();
    var _e = (0, react_1.useState)(null), error = _e[0], setError = _e[1];
    var _f = (0, react_1.useState)(false), isProcessing = _f[0], setIsProcessing = _f[1];
    var handleSubmit = function (e) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, setupError, setupIntent, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    e.preventDefault();
                    if (!stripe || !elements) {
                        return [2 /*return*/];
                    }
                    setError(null);
                    setIsProcessing(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, stripe.confirmSetup({
                            elements: elements,
                            redirect: "if_required"
                        })];
                case 2:
                    _a = _b.sent(), setupError = _a.error, setupIntent = _a.setupIntent;
                    if (setupError) {
                        setError(setupError.message || "An error occurred while processing your payment method.");
                        return [2 /*return*/];
                    }
                    if ((setupIntent === null || setupIntent === void 0 ? void 0 : setupIntent.status) === "succeeded") {
                        onSuccess();
                    }
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _b.sent();
                    setError("An unexpected error occurred.");
                    return [3 /*break*/, 5];
                case 4:
                    setIsProcessing(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<form className={"space-y-6 ".concat(className)} onSubmit={handleSubmit}>
      {/* Billing Address Section */}
      <div className="space-y-4">
        <h3 className="text-left text-sm font-semibold text-muted-foreground">Billing Address</h3>
        <react_stripe_js_1.AddressElement options={{
            mode: "billing"
        }}/>
      </div>

      {/* Payment Element */}
      <div className="space-y-2">
        <h3 className="text-left text-sm font-semibold text-muted-foreground">Card Information</h3>
        <react_stripe_js_1.PaymentElement />
      </div>

      {error && (<components_1.Alert className="mt-4" variant="destructive">
          {error}
        </components_1.Alert>)}

      <components_1.Button type="submit" className="w-full" disabled={isProcessing}>
        {isProcessing ? processingText : buttonText}
      </components_1.Button>
    </form>);
};
exports.PaymentMethodForm = PaymentMethodForm;
