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
exports.EmailVerificationContainer = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var notistack_1 = require("notistack");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var DEPENDENCIES = {
    useCustomUser: useCustomUser_1.useCustomUser,
    useSnackbar: notistack_1.useSnackbar,
    useServices: ServicesProvider_1.useServices,
    Snackbar: components_1.Snackbar
};
var EmailVerificationContainer = function (_a) {
    var children = _a.children, onComplete = _a.onComplete, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var _c = d.useCustomUser(), user = _c.user, checkSession = _c.checkSession;
    var enqueueSnackbar = d.useSnackbar().enqueueSnackbar;
    var _d = (0, react_1.useState)(false), isResending = _d[0], setIsResending = _d[1];
    var _e = (0, react_1.useState)(false), isChecking = _e[0], setIsChecking = _e[1];
    var _f = d.useServices(), analyticsService = _f.analyticsService, auth = _f.auth;
    var isEmailVerified = !!(user === null || user === void 0 ? void 0 : user.emailVerified);
    var handleResendEmail = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(user === null || user === void 0 ? void 0 : user.id))
                        return [2 /*return*/];
                    setIsResending(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, auth.sendVerificationEmail(user.id)];
                case 2:
                    _a.sent();
                    enqueueSnackbar(<d.Snackbar title="Verification email sent" subTitle="Please check your email and click the verification link" iconVariant="success"/>, {
                        variant: "success"
                    });
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    enqueueSnackbar(<d.Snackbar title="Failed to send verification email" subTitle="Please try again later or contact support" iconVariant="error"/>, {
                        variant: "error"
                    });
                    return [3 /*break*/, 5];
                case 4:
                    setIsResending(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [user === null || user === void 0 ? void 0 : user.id, auth, enqueueSnackbar, d.Snackbar]);
    var handleCheckVerification = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsChecking(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, checkSession()];
                case 2:
                    _a.sent();
                    enqueueSnackbar(<d.Snackbar title="Verification status updated" subTitle="Your email verification status has been refreshed" iconVariant="success"/>, {
                        variant: "success"
                    });
                    return [3 /*break*/, 5];
                case 3:
                    error_2 = _a.sent();
                    enqueueSnackbar(<d.Snackbar title="Failed to check verification" subTitle="Please try again or refresh the page" iconVariant="error"/>, {
                        variant: "error"
                    });
                    return [3 /*break*/, 5];
                case 4:
                    setIsChecking(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); }, [checkSession, enqueueSnackbar, d.Snackbar]);
    var handleContinue = (0, react_1.useCallback)(function () {
        if (isEmailVerified) {
            analyticsService.track("onboarding_email_verified", {
                category: "onboarding"
            });
            onComplete();
        }
    }, [isEmailVerified, analyticsService, onComplete]);
    return (<>
      {children({
            isEmailVerified: isEmailVerified,
            isResending: isResending,
            isChecking: isChecking,
            onResendEmail: handleResendEmail,
            onCheckVerification: handleCheckVerification,
            onContinue: handleContinue
        })}
    </>);
};
exports.EmailVerificationContainer = EmailVerificationContainer;
