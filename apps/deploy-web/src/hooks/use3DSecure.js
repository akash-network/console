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
exports.use3DSecure = void 0;
var react_1 = require("react");
var notistack_1 = require("notistack");
var queries_1 = require("@src/queries");
var use3DSecure = function (options) {
    if (options === void 0) { options = {}; }
    var onSuccess = options.onSuccess, onError = options.onError, _a = options.showSuccessMessage, showSuccessMessage = _a === void 0 ? true : _a, _b = options.showErrorMessage, showErrorMessage = _b === void 0 ? true : _b;
    var _c = (0, react_1.useState)(false), isOpen = _c[0], setIsOpen = _c[1];
    var _d = (0, react_1.useState)(null), threeDSData = _d[0], setThreeDSData = _d[1];
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var validatePaymentMethodAfter3DS = (0, queries_1.usePaymentMutations)().validatePaymentMethodAfter3DS;
    var start3DSecure = (0, react_1.useCallback)(function (data) {
        setThreeDSData(data);
        setIsOpen(true);
    }, []);
    var close3DSecure = (0, react_1.useCallback)(function () {
        setIsOpen(false);
        setThreeDSData(null);
    }, []);
    var handle3DSSuccess = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var errorMessage, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!threeDSData) {
                        errorMessage = "Authentication data is missing. Please try again.";
                        console.error("3D Secure data is missing");
                        if (showErrorMessage) {
                            enqueueSnackbar(errorMessage, { variant: "error" });
                        }
                        onError === null || onError === void 0 ? void 0 : onError(errorMessage);
                        close3DSecure();
                        return [2 /*return*/];
                    }
                    console.log("3D Secure authentication successful, processing...");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    console.log("Marking payment method as validated...", {
                        paymentMethodId: threeDSData.paymentMethodId,
                        paymentIntentId: threeDSData.paymentIntentId
                    });
                    return [4 /*yield*/, validatePaymentMethodAfter3DS.mutateAsync({
                            paymentMethodId: threeDSData.paymentMethodId,
                            paymentIntentId: threeDSData.paymentIntentId
                        })];
                case 2:
                    _a.sent();
                    console.log("Payment method validation successful");
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("Failed to validate payment method after 3D Secure:", error_1);
                    return [3 /*break*/, 4];
                case 4:
                    // Always call onSuccess and show success message since 3D Secure authentication succeeded
                    if (showSuccessMessage) {
                        enqueueSnackbar("Payment completed successfully!", { variant: "success" });
                    }
                    console.log("Calling onSuccess callback...");
                    onSuccess === null || onSuccess === void 0 ? void 0 : onSuccess();
                    close3DSecure();
                    return [2 /*return*/];
            }
        });
    }); }, [threeDSData, validatePaymentMethodAfter3DS, onSuccess, onError, showSuccessMessage, showErrorMessage, enqueueSnackbar, close3DSecure]);
    var handle3DSError = (0, react_1.useCallback)(function (error) {
        console.error("3D Secure authentication failed:", error);
        // Provide more specific error messages
        var errorMessage = error;
        if (error.includes("declined") || error.includes("insufficient_funds")) {
            errorMessage = "Your payment method was declined. Please try a different card or contact your bank.";
        }
        else if (error.includes("timeout")) {
            errorMessage = "Authentication timed out. Please try again.";
        }
        else if (error.includes("network")) {
            errorMessage = "Network error occurred. Please check your connection and try again.";
        }
        if (showErrorMessage) {
            enqueueSnackbar(errorMessage, { variant: "error" });
        }
        onError === null || onError === void 0 ? void 0 : onError(errorMessage);
        close3DSecure();
    }, [onError, showErrorMessage, enqueueSnackbar, close3DSecure]);
    return {
        isOpen: isOpen,
        threeDSData: threeDSData,
        isLoading: validatePaymentMethodAfter3DS.isPending,
        start3DSecure: start3DSecure,
        close3DSecure: close3DSecure,
        handle3DSSuccess: handle3DSSuccess,
        handle3DSError: handle3DSError
    };
};
exports.use3DSecure = use3DSecure;
