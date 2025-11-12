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
exports.PaymentMethodContainer = void 0;
var react_1 = require("react");
var notistack_1 = require("notistack");
var WalletProvider_1 = require("@src/context/WalletProvider");
var use3DSecure_1 = require("@src/hooks/use3DSecure");
var useUser_1 = require("@src/hooks/useUser");
var useManagedWalletQuery_1 = require("@src/queries/useManagedWalletQuery");
var usePaymentQueries_1 = require("@src/queries/usePaymentQueries");
var errorUtils_1 = require("@src/utils/errorUtils");
var DEPENDENCIES = {
    useWallet: WalletProvider_1.useWallet,
    useUser: useUser_1.useUser,
    usePaymentMethodsQuery: usePaymentQueries_1.usePaymentMethodsQuery,
    usePaymentMutations: usePaymentQueries_1.usePaymentMutations,
    useSetupIntentMutation: usePaymentQueries_1.useSetupIntentMutation,
    useCreateManagedWalletMutation: useManagedWalletQuery_1.useCreateManagedWalletMutation,
    use3DSecure: use3DSecure_1.use3DSecure
};
var PaymentMethodContainer = function (_a) {
    var children = _a.children, onComplete = _a.onComplete, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var _c = d.useSetupIntentMutation(), setupIntent = _c.data, createSetupIntent = _c.mutate;
    var _d = d.usePaymentMethodsQuery(), _e = _d.data, paymentMethods = _e === void 0 ? [] : _e, refetchPaymentMethods = _d.refetch;
    var removePaymentMethod = d.usePaymentMutations().removePaymentMethod;
    var _f = d.useWallet(), isWalletLoading = _f.isWalletLoading, hasManagedWallet = _f.hasManagedWallet, managedWalletError = _f.managedWalletError;
    var user = d.useUser().user;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var _g = (0, react_1.useState)(false), showAddForm = _g[0], setShowAddForm = _g[1];
    var _h = (0, react_1.useState)(false), showDeleteConfirmation = _h[0], setShowDeleteConfirmation = _h[1];
    var _j = (0, react_1.useState)(), cardToDelete = _j[0], setCardToDelete = _j[1];
    var _k = (0, react_1.useState)(false), isConnectingWallet = _k[0], setIsConnectingWallet = _k[1];
    var createWallet = d.useCreateManagedWalletMutation().mutateAsync;
    var hasValidatedCard = paymentMethods.length > 0 && paymentMethods.some(function (method) { return method.validated; });
    var hasPaymentMethod = paymentMethods.length > 0;
    var threeDSecure = d.use3DSecure({
        onSuccess: function () { return __awaiter(void 0, void 0, void 0, function () {
            var result, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setIsConnectingWallet(true);
                        return [4 /*yield*/, refetchPaymentMethods()];
                    case 1:
                        _a.sent();
                        if (!(user === null || user === void 0 ? void 0 : user.id)) {
                            console.error("User ID not available");
                            setIsConnectingWallet(false);
                            return [2 /*return*/];
                        }
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, createWallet(user.id)];
                    case 3:
                        result = _a.sent();
                        if ("requires3DS" in result && result.requires3DS) {
                            // Start another 3D Secure flow if needed
                            if (!validateAndStart3DSecure(result)) {
                                setIsConnectingWallet(false);
                                return [2 /*return*/];
                            }
                            setIsConnectingWallet(false);
                            return [2 /*return*/];
                        }
                        setIsConnectingWallet(false);
                        onComplete();
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("Wallet creation failed after 3D Secure:", error_1);
                        setIsConnectingWallet(false);
                        errorMessage = (0, errorUtils_1.extractErrorMessage)(error_1);
                        enqueueSnackbar(errorMessage, { variant: "error", autoHideDuration: 5000 });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        }); },
        onError: function (error) {
            setIsConnectingWallet(false);
            console.error("3D Secure authentication failed:", error);
        },
        showSuccessMessage: false
    });
    var validateAndStart3DSecure = (0, react_1.useCallback)(function (result) {
        var clientSecret = result.clientSecret, paymentIntentId = result.paymentIntentId, paymentMethodId = result.paymentMethodId;
        // Validate required fields
        if (!clientSecret || clientSecret.trim() === "") {
            console.error("3D Secure validation failed: clientSecret is missing or empty");
            enqueueSnackbar("Authentication data is incomplete. Please try again.", { variant: "error" });
            return false;
        }
        if ((!paymentIntentId || paymentIntentId.trim() === "") && (!paymentMethodId || paymentMethodId.trim() === "")) {
            console.error("3D Secure validation failed: both paymentIntentId and paymentMethodId are missing or empty");
            enqueueSnackbar("Payment method information is incomplete. Please try again.", { variant: "error" });
            return false;
        }
        threeDSecure.start3DSecure({
            clientSecret: clientSecret.trim(),
            paymentIntentId: (paymentIntentId === null || paymentIntentId === void 0 ? void 0 : paymentIntentId.trim()) || "",
            paymentMethodId: (paymentMethodId === null || paymentMethodId === void 0 ? void 0 : paymentMethodId.trim()) || ""
        });
        return true;
    }, [threeDSecure, enqueueSnackbar]);
    (0, react_1.useEffect)(function () {
        if (!setupIntent) {
            createSetupIntent();
        }
    }, [setupIntent, createSetupIntent]);
    (0, react_1.useEffect)(function () {
        if (isConnectingWallet && hasManagedWallet && !isWalletLoading) {
            setIsConnectingWallet(false);
            onComplete();
        }
    }, [isConnectingWallet, hasManagedWallet, isWalletLoading, onComplete]);
    (0, react_1.useEffect)(function () {
        if (isConnectingWallet && managedWalletError) {
            setIsConnectingWallet(false);
        }
    }, [isConnectingWallet, managedWalletError]);
    var handleSuccess = function () {
        setShowAddForm(false);
        refetchPaymentMethods();
    };
    var handleRemovePaymentMethod = function (paymentMethodId) {
        setCardToDelete(paymentMethodId);
        setShowDeleteConfirmation(true);
    };
    var confirmRemovePaymentMethod = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_2, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!cardToDelete)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, removePaymentMethod.mutateAsync(cardToDelete)];
                case 2:
                    _a.sent();
                    setShowDeleteConfirmation(false);
                    setCardToDelete(undefined);
                    return [4 /*yield*/, refetchPaymentMethods()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_2 = _a.sent();
                    console.error("Failed to remove payment method:", error_2);
                    errorMessage = (0, errorUtils_1.extractErrorMessage)(error_2);
                    enqueueSnackbar(errorMessage, {
                        variant: "error",
                        autoHideDuration: 5000
                    });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleNext = function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, error_3, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (paymentMethods.length === 0) {
                        return [2 /*return*/];
                    }
                    setIsConnectingWallet(true);
                    if (!(user === null || user === void 0 ? void 0 : user.id)) {
                        console.error("User ID not available");
                        setIsConnectingWallet(false);
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, createWallet(user.id)];
                case 2:
                    result = _a.sent();
                    if ("requires3DS" in result && result.requires3DS) {
                        if (!validateAndStart3DSecure(result)) {
                            setIsConnectingWallet(false);
                            return [2 /*return*/];
                        }
                        setIsConnectingWallet(false);
                        return [2 /*return*/];
                    }
                    setIsConnectingWallet(false);
                    onComplete();
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error("Wallet creation failed:", error_3);
                    setIsConnectingWallet(false);
                    errorMessage = (0, errorUtils_1.extractErrorMessage)(error_3);
                    enqueueSnackbar(errorMessage, {
                        variant: "error",
                        autoHideDuration: 5000
                    });
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var isLoading = isConnectingWallet || isWalletLoading;
    return (<>
      {children({
            setupIntent: setupIntent,
            paymentMethods: paymentMethods,
            showAddForm: showAddForm,
            showDeleteConfirmation: showDeleteConfirmation,
            cardToDelete: cardToDelete,
            isConnectingWallet: isConnectingWallet,
            isLoading: isLoading,
            isRemoving: removePaymentMethod.isPending,
            managedWalletError: managedWalletError,
            onSuccess: handleSuccess,
            onRemovePaymentMethod: handleRemovePaymentMethod,
            onConfirmRemovePaymentMethod: confirmRemovePaymentMethod,
            onNext: handleNext,
            onShowAddForm: setShowAddForm,
            onShowDeleteConfirmation: setShowDeleteConfirmation,
            onSetCardToDelete: setCardToDelete,
            refetchPaymentMethods: refetchPaymentMethods,
            hasValidatedCard: hasValidatedCard,
            hasPaymentMethod: hasPaymentMethod,
            threeDSecure: threeDSecure
        })}
    </>);
};
exports.PaymentMethodContainer = PaymentMethodContainer;
