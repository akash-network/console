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
require("@testing-library/jest-dom");
var react_1 = require("react");
var test_utils_1 = require("react-dom/test-utils");
var EmailVerificationContainer_1 = require("./EmailVerificationContainer");
var react_2 = require("@testing-library/react");
describe("EmailVerificationContainer", function () {
    it("should render children with initial state", function () {
        var child = setup().child;
        expect(child).toHaveBeenCalledWith(expect.objectContaining({
            isEmailVerified: false,
            isResending: false,
            isChecking: false,
            onResendEmail: expect.any(Function),
            onCheckVerification: expect.any(Function),
            onContinue: expect.any(Function)
        }));
    });
    it("should handle resend email success", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockSendVerificationEmail, mockEnqueueSnackbar, onResendEmail;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockSendVerificationEmail = _a.mockSendVerificationEmail, mockEnqueueSnackbar = _a.mockEnqueueSnackbar;
                    mockSendVerificationEmail.mockResolvedValue(undefined);
                    onResendEmail = child.mock.calls[0][0].onResendEmail;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onResendEmail()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockSendVerificationEmail).toHaveBeenCalledWith("test-user");
                    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({
                        props: expect.objectContaining({
                            title: "Verification email sent",
                            subTitle: "Please check your email and click the verification link",
                            iconVariant: "success"
                        })
                    }), { variant: "success" });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle resend email error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockSendVerificationEmail, mockEnqueueSnackbar, onResendEmail;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockSendVerificationEmail = _a.mockSendVerificationEmail, mockEnqueueSnackbar = _a.mockEnqueueSnackbar;
                    mockSendVerificationEmail.mockRejectedValue(new Error("Failed"));
                    onResendEmail = child.mock.calls[0][0].onResendEmail;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onResendEmail()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockSendVerificationEmail).toHaveBeenCalledWith("test-user");
                    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({
                        props: expect.objectContaining({
                            title: "Failed to send verification email",
                            subTitle: "Please try again later or contact support",
                            iconVariant: "error"
                        })
                    }), { variant: "error" });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle check verification success", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockCheckSession, mockEnqueueSnackbar, onCheckVerification;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockCheckSession = _a.mockCheckSession, mockEnqueueSnackbar = _a.mockEnqueueSnackbar;
                    mockCheckSession.mockResolvedValue(undefined);
                    onCheckVerification = child.mock.calls[0][0].onCheckVerification;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onCheckVerification()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCheckSession).toHaveBeenCalled();
                    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({
                        props: expect.objectContaining({
                            title: "Verification status updated",
                            subTitle: "Your email verification status has been refreshed",
                            iconVariant: "success"
                        })
                    }), { variant: "success" });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle check verification error", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockCheckSession, mockEnqueueSnackbar, onCheckVerification;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockCheckSession = _a.mockCheckSession, mockEnqueueSnackbar = _a.mockEnqueueSnackbar;
                    mockCheckSession.mockRejectedValue(new Error("Failed"));
                    onCheckVerification = child.mock.calls[0][0].onCheckVerification;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onCheckVerification()];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockCheckSession).toHaveBeenCalled();
                    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({
                        props: expect.objectContaining({
                            title: "Failed to check verification",
                            subTitle: "Please try again or refresh the page",
                            iconVariant: "error"
                        })
                    }), { variant: "error" });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should call onComplete when email is verified", function () {
        var mockOnComplete = jest.fn();
        var child = setup({
            user: { id: "test-user", emailVerified: true },
            onComplete: mockOnComplete
        }).child;
        var onContinue = child.mock.calls[0][0].onContinue;
        onContinue();
        expect(mockOnComplete).toHaveBeenCalled();
    });
    it("should not call onComplete when email is not verified", function () {
        var mockOnComplete = jest.fn();
        var child = setup({
            user: { id: "test-user", emailVerified: false },
            onComplete: mockOnComplete
        }).child;
        var onContinue = child.mock.calls[0][0].onContinue;
        onContinue();
        expect(mockOnComplete).not.toHaveBeenCalled();
    });
    function setup(input) {
        if (input === void 0) { input = {}; }
        jest.clearAllMocks();
        var mockSendVerificationEmail = jest.fn();
        var mockCheckSession = jest.fn();
        var mockEnqueueSnackbar = jest.fn();
        var mockAnalyticsService = {
            track: jest.fn()
        };
        var mockUseCustomUser = jest.fn().mockReturnValue({
            user: input.user || { id: "test-user", emailVerified: false },
            checkSession: mockCheckSession
        });
        var mockUseSnackbar = jest.fn().mockReturnValue({
            enqueueSnackbar: mockEnqueueSnackbar
        });
        var mockUseServices = jest.fn().mockReturnValue({
            analyticsService: mockAnalyticsService,
            auth: {
                sendVerificationEmail: mockSendVerificationEmail
            }
        });
        var mockSnackbar = function (_a) {
            var title = _a.title, subTitle = _a.subTitle, iconVariant = _a.iconVariant;
            return (<div data-testid="snackbar" data-title={title} data-subtitle={subTitle} data-icon-variant={iconVariant}/>);
        };
        var dependencies = {
            useCustomUser: mockUseCustomUser,
            useSnackbar: mockUseSnackbar,
            useServices: mockUseServices,
            Snackbar: mockSnackbar
        };
        var mockChildren = jest.fn().mockReturnValue(<div>Test</div>);
        var mockOnComplete = input.onComplete || jest.fn();
        (0, react_2.render)(<EmailVerificationContainer_1.EmailVerificationContainer onComplete={mockOnComplete} dependencies={dependencies}>
        {mockChildren}
      </EmailVerificationContainer_1.EmailVerificationContainer>);
        return {
            child: mockChildren,
            mockSendVerificationEmail: mockSendVerificationEmail,
            mockCheckSession: mockCheckSession,
            mockEnqueueSnackbar: mockEnqueueSnackbar,
            mockAnalyticsService: mockAnalyticsService
        };
    }
});
