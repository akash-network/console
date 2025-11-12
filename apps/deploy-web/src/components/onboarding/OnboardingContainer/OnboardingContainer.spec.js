"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var jest_mock_extended_1 = require("jest-mock-extended");
var urlUtils_1 = require("@src/utils/urlUtils");
var OnboardingContainer_1 = require("./OnboardingContainer");
var react_2 = require("@testing-library/react");
describe("OnboardingContainer", function () {
    it("should initialize with default state", function () {
        var child = setup().child;
        expect(child.mock.calls[0][0]).toEqual({
            currentStep: OnboardingContainer_1.OnboardingStepIndex.FREE_TRIAL,
            steps: expect.arrayContaining([
                expect.objectContaining({ id: "free-trial", title: "Free Trial" }),
                expect.objectContaining({ id: "signup", title: "Create Account" }),
                expect.objectContaining({ id: "email-verification", title: "Verify Email" }),
                expect.objectContaining({ id: "payment-method", title: "Payment Method" }),
                expect.objectContaining({ id: "welcome", title: "Welcome" })
            ]),
            onStepChange: expect.any(Function),
            onStepComplete: expect.any(Function),
            onStartTrial: expect.any(Function),
            onPaymentMethodComplete: expect.any(Function),
            onComplete: expect.any(Function)
        });
    });
    it("should track analytics when step changes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockAnalyticsService, onStepChange;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockAnalyticsService = _a.mockAnalyticsService;
                    onStepChange = child.mock.calls[0][0].onStepChange;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onStepChange(OnboardingContainer_1.OnboardingStepIndex.EMAIL_VERIFICATION);
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_step_started", {
                        category: "onboarding",
                        step: "email_verification",
                        step_index: OnboardingContainer_1.OnboardingStepIndex.EMAIL_VERIFICATION
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should track analytics when step completes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockAnalyticsService, onStepComplete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockAnalyticsService = _a.mockAnalyticsService;
                    onStepComplete = child.mock.calls[0][0].onStepComplete;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onStepComplete(OnboardingContainer_1.OnboardingStepIndex.FREE_TRIAL);
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_step_completed", {
                        category: "onboarding",
                        step: "free_trial",
                        step_index: OnboardingContainer_1.OnboardingStepIndex.FREE_TRIAL
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should track analytics and redirect when starting trial", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockAnalyticsService, mockUrlService, authService, onStartTrial;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockAnalyticsService = _a.mockAnalyticsService, mockUrlService = _a.mockUrlService, authService = _a.authService;
                    mockUrlService.onboarding.mockReturnValue("/onboarding");
                    mockUrlService.signup.mockReturnValue("/signup");
                    onStartTrial = child.mock.calls[0][0].onStartTrial;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onStartTrial();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_free_trial_started", {
                        category: "onboarding"
                    });
                    expect(mockUrlService.onboarding).toHaveBeenCalledWith(true);
                    expect(authService.signup).toHaveBeenCalledWith({ returnTo: expect.stringContaining("/onboarding") });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should track analytics when payment method is completed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockAnalyticsService, onPaymentMethodComplete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        paymentMethods: [{ id: "1", type: "card" }]
                    }), child = _a.child, mockAnalyticsService = _a.mockAnalyticsService;
                    onPaymentMethodComplete = child.mock.calls[0][0].onPaymentMethodComplete;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                onPaymentMethodComplete();
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_payment_method_added", {
                        category: "onboarding"
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should redirect to deployment and connect managed wallet when onboarding is completed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockRouter, mockConnectManagedWallet, onComplete;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup(), child = _a.child, mockRouter = _a.mockRouter, mockConnectManagedWallet = _a.mockConnectManagedWallet;
                    onComplete = child.mock.calls[0][0].onComplete;
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, onComplete("hello-akash")];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    _b.sent();
                    expect(mockRouter.push).toHaveBeenCalled();
                    expect(mockConnectManagedWallet).toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("should redirect to home when user has managed wallet and no saved step", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockRouter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockRouter = setup({
                        wallet: { hasManagedWallet: true, isWalletLoading: false }
                    }).mockRouter;
                    // Wait for the useEffect to run
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 0); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    // Wait for the useEffect to run
                    _a.sent();
                    expect(mockRouter.replace).toHaveBeenCalledWith("/");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should not redirect when user has managed wallet but has saved step", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockRouter;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockRouter = setup({
                        wallet: { hasManagedWallet: true, isWalletLoading: false },
                        savedStep: "2"
                    }).mockRouter;
                    // Wait for the useEffect to run
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 0); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    // Wait for the useEffect to run
                    _a.sent();
                    expect(mockRouter.replace).not.toHaveBeenCalled();
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle fromSignup URL parameter", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, child, mockAnalyticsService;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        windowLocation: {
                            search: "?fromSignup=true",
                            href: "http://localhost/onboarding?fromSignup=true",
                            origin: "http://localhost"
                        },
                        windowHistory: {
                            replaceState: jest.fn()
                        }
                    }), child = _a.child, mockAnalyticsService = _a.mockAnalyticsService;
                    // Wait for the useEffect to run
                    return [4 /*yield*/, (0, test_utils_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 0); })];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 1:
                    // Wait for the useEffect to run
                    _b.sent();
                    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_account_created", {
                        category: "onboarding"
                    });
                    // The component should be on the EMAIL_VERIFICATION step after handling fromSignup
                    expect(child.mock.calls[child.mock.calls.length - 1][0].currentStep).toBe(OnboardingContainer_1.OnboardingStepIndex.EMAIL_VERIFICATION);
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        var _a, _b;
        if (input === void 0) { input = {}; }
        jest.clearAllMocks();
        // Mock localStorage using jest-mock-extended
        var mockLocalStorage = (0, jest_mock_extended_1.mock)({
            getItem: jest.fn().mockReturnValue(input.savedStep || null)
        });
        // Store original window objects
        var windowLocation = window.location;
        var windowHistory = window.history;
        // Mock window.location and history based on input
        if (input.windowLocation) {
            windowLocation = __assign(__assign({}, windowLocation), input.windowLocation);
        }
        else if (!window.location.search) {
            // Set default values if window.location is not already mocked
            windowLocation = __assign(__assign({}, windowLocation), { href: "http://localhost/onboarding", origin: "http://localhost", search: "" });
        }
        if (input.windowHistory) {
            windowHistory = __assign(__assign({}, windowHistory), input.windowHistory);
        }
        var mockAnalyticsService = (0, jest_mock_extended_1.mock)();
        var mockRouter = (0, jest_mock_extended_1.mock)();
        var authService = (0, jest_mock_extended_1.mock)();
        var mockConnectManagedWallet = jest.fn();
        var mockSignAndBroadcastTx = jest.fn().mockResolvedValue({ transactionHash: "mock-hash" });
        var mockGenNewCertificateIfLocalIsInvalid = jest.fn().mockResolvedValue(null);
        var mockUpdateSelectedCertificate = jest.fn().mockResolvedValue(undefined);
        var mockUrlService = __assign(__assign({}, urlUtils_1.UrlService), { onboarding: jest.fn(function () { return "/onboarding"; }), signup: jest.fn(function () { return "/signup"; }), newDeployment: jest.fn(function () { return "/deployments/new"; }) });
        var mockChainApiHttpClient = {
            get: jest.fn()
        };
        var mockDeploymentLocalStorage = {
            update: jest.fn()
        };
        var mockAppConfig = {
            NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT: "5000000"
        };
        var mockUseUser = jest.fn().mockReturnValue(input.user || { emailVerified: false });
        var mockUsePaymentMethodsQuery = jest.fn().mockReturnValue({ data: input.paymentMethods || [] });
        var mockUseServices = jest.fn().mockReturnValue({
            analyticsService: mockAnalyticsService,
            urlService: mockUrlService,
            authService: authService,
            chainApiHttpClient: mockChainApiHttpClient,
            deploymentLocalStorage: mockDeploymentLocalStorage,
            appConfig: mockAppConfig,
            windowLocation: windowLocation,
            windowHistory: windowHistory
        });
        var mockUseRouter = jest.fn().mockReturnValue(mockRouter);
        var mockUseWallet = jest.fn().mockReturnValue({
            hasManagedWallet: ((_a = input.wallet) === null || _a === void 0 ? void 0 : _a.hasManagedWallet) || false,
            isWalletLoading: ((_b = input.wallet) === null || _b === void 0 ? void 0 : _b.isWalletLoading) || false,
            connectManagedWallet: mockConnectManagedWallet,
            address: "akash1test",
            signAndBroadcastTx: mockSignAndBroadcastTx
        });
        var mockUseTemplates = jest.fn().mockReturnValue({ templates: [] });
        var mockUseCertificate = jest.fn().mockReturnValue({
            genNewCertificateIfLocalIsInvalid: mockGenNewCertificateIfLocalIsInvalid,
            updateSelectedCertificate: mockUpdateSelectedCertificate
        });
        var mockUseSnackbar = jest.fn().mockReturnValue({
            enqueueSnackbar: jest.fn()
        });
        var mockNewDeploymentData = jest.fn().mockResolvedValue({
            deploymentId: { dseq: "123" },
            hash: "mock-hash"
        });
        var mockDeploymentData = {
            NewDeploymentData: mockNewDeploymentData,
            getManifest: jest.fn(),
            getManifestVersion: jest.fn(),
            appendTrialAttribute: jest.fn(),
            appendAuditorRequirement: jest.fn(function (sdl) { return sdl; }),
            ENDPOINT_NAME_VALIDATION_REGEX: /^[a-z]+[-_\da-z]+$/,
            TRIAL_ATTRIBUTE: "console/trials",
            TRIAL_REGISTERED_ATTRIBUTE: "console/trials-registered",
            AUDITOR: "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63",
            MANAGED_WALLET_ALLOWED_AUDITORS: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"]
        };
        var mockValidateDeploymentData = jest.fn();
        var mockAppendAuditorRequirement = jest.fn(function (sdl) { return sdl; });
        var mockHelloWorldTemplate = {
            title: "Hello World",
            name: "Hello World",
            code: "hello-world",
            category: "General",
            description: "Simple next.js web application showing hello world.",
            githubUrl: "https://github.com/akash-network/hello-akash-world",
            valuesToChange: [],
            content: "mock-sdl-content"
        };
        var mockTransactionMessageData = {
            prototype: {},
            getRevokeCertificateMsg: jest.fn(),
            getCreateCertificateMsg: jest.fn(),
            getCreateLeaseMsg: jest.fn(),
            getCreateDeploymentMsg: jest.fn(),
            getUpdateDeploymentMsg: jest.fn(),
            getDepositDeploymentMsg: jest.fn(),
            getCloseDeploymentMsg: jest.fn(),
            getSendTokensMsg: jest.fn(),
            getGrantMsg: jest.fn(),
            getRevokeDepositMsg: jest.fn(),
            getGrantBasicAllowanceMsg: jest.fn(),
            getRevokeAllowanceMsg: jest.fn(),
            getUpdateProviderMsg: jest.fn()
        };
        // Create dependencies object
        var dependencies = {
            useUser: mockUseUser,
            usePaymentMethodsQuery: mockUsePaymentMethodsQuery,
            useServices: mockUseServices,
            useRouter: mockUseRouter,
            useWallet: mockUseWallet,
            useTemplates: mockUseTemplates,
            useCertificate: mockUseCertificate,
            useSnackbar: mockUseSnackbar,
            localStorage: mockLocalStorage,
            deploymentData: mockDeploymentData,
            validateDeploymentData: mockValidateDeploymentData,
            appendAuditorRequirement: mockAppendAuditorRequirement,
            helloWorldTemplate: mockHelloWorldTemplate,
            TransactionMessageData: mockTransactionMessageData,
            UrlService: urlUtils_1.UrlService
        };
        var mockChildren = jest.fn().mockReturnValue(<div>Test</div>);
        (0, react_2.render)(<OnboardingContainer_1.OnboardingContainer dependencies={dependencies}>{mockChildren}</OnboardingContainer_1.OnboardingContainer>);
        return {
            child: mockChildren,
            mockAnalyticsService: mockAnalyticsService,
            mockRouter: mockRouter,
            mockUrlService: mockUrlService,
            authService: authService,
            mockUseUser: mockUseUser,
            mockUsePaymentMethodsQuery: mockUsePaymentMethodsQuery,
            mockUseServices: mockUseServices,
            mockUseRouter: mockUseRouter,
            mockConnectManagedWallet: mockConnectManagedWallet,
            mockLocalStorage: mockLocalStorage,
            mockSignAndBroadcastTx: mockSignAndBroadcastTx,
            mockGenNewCertificateIfLocalIsInvalid: mockGenNewCertificateIfLocalIsInvalid,
            mockUpdateSelectedCertificate: mockUpdateSelectedCertificate,
            mockChainApiHttpClient: mockChainApiHttpClient,
            mockDeploymentLocalStorage: mockDeploymentLocalStorage,
            mockNewDeploymentData: mockNewDeploymentData,
            mockValidateDeploymentData: mockValidateDeploymentData,
            mockAppendAuditorRequirement: mockAppendAuditorRequirement,
            mockTransactionMessageData: mockTransactionMessageData
        };
    }
});
