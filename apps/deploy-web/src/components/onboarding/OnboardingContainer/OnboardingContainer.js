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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingContainer = exports.OnboardingStepIndex = void 0;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var notistack_1 = require("notistack");
var CertificateProvider_1 = require("@src/context/CertificateProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useUser_1 = require("@src/hooks/useUser");
var usePaymentQueries_1 = require("@src/queries/usePaymentQueries");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var keys_1 = require("@src/services/storage/keys");
var route_steps_type_1 = require("@src/types/route-steps.type");
var deploymentData_1 = require("@src/utils/deploymentData");
var v1beta3_1 = require("@src/utils/deploymentData/v1beta3");
var deploymentUtils_1 = require("@src/utils/deploymentUtils");
var templates_1 = require("@src/utils/templates");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var OnboardingStepIndex;
(function (OnboardingStepIndex) {
    OnboardingStepIndex[OnboardingStepIndex["FREE_TRIAL"] = 0] = "FREE_TRIAL";
    OnboardingStepIndex[OnboardingStepIndex["SIGNUP"] = 1] = "SIGNUP";
    OnboardingStepIndex[OnboardingStepIndex["EMAIL_VERIFICATION"] = 2] = "EMAIL_VERIFICATION";
    OnboardingStepIndex[OnboardingStepIndex["PAYMENT_METHOD"] = 3] = "PAYMENT_METHOD";
    OnboardingStepIndex[OnboardingStepIndex["WELCOME"] = 4] = "WELCOME";
})(OnboardingStepIndex || (exports.OnboardingStepIndex = OnboardingStepIndex = {}));
var DEPENDENCIES = {
    useUser: useUser_1.useUser,
    usePaymentMethodsQuery: usePaymentQueries_1.usePaymentMethodsQuery,
    useServices: ServicesProvider_1.useServices,
    useRouter: navigation_1.useRouter,
    useWallet: WalletProvider_1.useWallet,
    useTemplates: useTemplateQuery_1.useTemplates,
    useCertificate: CertificateProvider_1.useCertificate,
    useSnackbar: notistack_1.useSnackbar,
    localStorage: typeof window !== "undefined" ? window.localStorage : null,
    deploymentData: deploymentData_1.deploymentData,
    validateDeploymentData: deploymentUtils_1.validateDeploymentData,
    appendAuditorRequirement: v1beta3_1.appendAuditorRequirement,
    helloWorldTemplate: templates_1.helloWorldTemplate,
    TransactionMessageData: TransactionMessageData_1.TransactionMessageData,
    UrlService: urlUtils_1.UrlService
};
var OnboardingContainer = function (_a) {
    var children = _a.children, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var _c = (0, react_1.useState)(OnboardingStepIndex.FREE_TRIAL), currentStep = _c[0], setCurrentStep = _c[1];
    var _d = (0, react_1.useState)(new Set()), completedSteps = _d[0], setCompletedSteps = _d[1];
    var router = d.useRouter();
    var user = d.useUser().user;
    var _e = d.usePaymentMethodsQuery({ enabled: !!(user === null || user === void 0 ? void 0 : user.stripeCustomerId) }).data, paymentMethods = _e === void 0 ? [] : _e;
    var _f = d.useServices(), analyticsService = _f.analyticsService, urlService = _f.urlService, authService = _f.authService, chainApiHttpClient = _f.chainApiHttpClient, deploymentLocalStorage = _f.deploymentLocalStorage, appConfig = _f.appConfig, errorHandler = _f.errorHandler, windowLocation = _f.windowLocation, windowHistory = _f.windowHistory;
    var _g = d.useWallet(), hasManagedWallet = _g.hasManagedWallet, isWalletLoading = _g.isWalletLoading, connectManagedWallet = _g.connectManagedWallet, address = _g.address, signAndBroadcastTx = _g.signAndBroadcastTx;
    var templates = d.useTemplates().templates;
    var _h = d.useCertificate(), genNewCertificateIfLocalIsInvalid = _h.genNewCertificateIfLocalIsInvalid, updateSelectedCertificate = _h.updateSelectedCertificate;
    var enqueueSnackbar = d.useSnackbar().enqueueSnackbar;
    (0, react_1.useEffect)(function () {
        var _a;
        var savedStep = (_a = d.localStorage) === null || _a === void 0 ? void 0 : _a.getItem(keys_1.ONBOARDING_STEP_KEY);
        if (!isWalletLoading && hasManagedWallet && !savedStep) {
            router.replace("/");
        }
    }, [isWalletLoading, hasManagedWallet, router, d.localStorage]);
    (0, react_1.useEffect)(function () {
        var _a, _b;
        var savedStep = (_a = d.localStorage) === null || _a === void 0 ? void 0 : _a.getItem(keys_1.ONBOARDING_STEP_KEY);
        if (savedStep) {
            var step = parseInt(savedStep, 10);
            if (step >= 0 && step < Object.keys(OnboardingStepIndex).length / 2) {
                setCurrentStep(step);
            }
        }
        var urlParams = new URLSearchParams(windowLocation.search);
        var fromSignup = urlParams.get("fromSignup");
        if (fromSignup === "true") {
            analyticsService.track("onboarding_account_created", {
                category: "onboarding"
            });
            setCompletedSteps(function (prev) { return new Set(__spreadArray(__spreadArray([], prev, true), [OnboardingStepIndex.SIGNUP], false)); });
            setCurrentStep(OnboardingStepIndex.EMAIL_VERIFICATION);
            (_b = d.localStorage) === null || _b === void 0 ? void 0 : _b.setItem(keys_1.ONBOARDING_STEP_KEY, OnboardingStepIndex.EMAIL_VERIFICATION.toString());
            var newUrl = new URL(windowLocation.href);
            newUrl.searchParams.delete("fromSignup");
            windowHistory.replaceState({}, "", newUrl.toString());
        }
    }, [analyticsService, d.localStorage]);
    var handleStepChange = (0, react_1.useCallback)(function (step) {
        var _a;
        if (step === OnboardingStepIndex.PAYMENT_METHOD && currentStep === OnboardingStepIndex.EMAIL_VERIFICATION) {
            if (!(user === null || user === void 0 ? void 0 : user.emailVerified)) {
                return;
            }
        }
        if (step === OnboardingStepIndex.WELCOME && currentStep === OnboardingStepIndex.PAYMENT_METHOD) {
            if (paymentMethods.length === 0) {
                return;
            }
        }
        var stepNames = ["free_trial", "signup", "email_verification", "payment_method", "welcome"];
        analyticsService.track("onboarding_step_started", {
            category: "onboarding",
            step: stepNames[step],
            step_index: step
        });
        setCurrentStep(step);
        (_a = d.localStorage) === null || _a === void 0 ? void 0 : _a.setItem(keys_1.ONBOARDING_STEP_KEY, step.toString());
    }, [currentStep, user === null || user === void 0 ? void 0 : user.emailVerified, paymentMethods.length, analyticsService, d.localStorage]);
    var handleStepComplete = (0, react_1.useCallback)(function (step) {
        var stepNames = ["free_trial", "signup", "email_verification", "payment_method", "welcome"];
        analyticsService.track("onboarding_step_completed", {
            category: "onboarding",
            step: stepNames[step],
            step_index: step
        });
        setCompletedSteps(function (prev) { return new Set(__spreadArray(__spreadArray([], prev, true), [step], false)); });
    }, [analyticsService]);
    var handleStartTrial = (0, react_1.useCallback)(function () {
        analyticsService.track("onboarding_free_trial_started", {
            category: "onboarding"
        });
        handleStepComplete(OnboardingStepIndex.FREE_TRIAL);
        if (user === null || user === void 0 ? void 0 : user.userId) {
            if (user.emailVerified) {
                setCompletedSteps(function (prev) { return new Set(__spreadArray(__spreadArray([], prev, true), [OnboardingStepIndex.SIGNUP, OnboardingStepIndex.EMAIL_VERIFICATION], false)); });
                handleStepChange(OnboardingStepIndex.PAYMENT_METHOD);
            }
            else {
                setCompletedSteps(function (prev) { return new Set(__spreadArray(__spreadArray([], prev, true), [OnboardingStepIndex.SIGNUP], false)); });
                handleStepChange(OnboardingStepIndex.EMAIL_VERIFICATION);
            }
        }
        else {
            authService.signup({ returnTo: "".concat(windowLocation.origin).concat(urlService.onboarding(true)) });
        }
    }, [analyticsService, handleStepComplete, urlService, user, handleStepChange, authService]);
    var handlePaymentMethodComplete = (0, react_1.useCallback)(function () {
        if (paymentMethods.length > 0) {
            analyticsService.track("onboarding_payment_method_added", {
                category: "onboarding"
            });
            handleStepComplete(OnboardingStepIndex.PAYMENT_METHOD);
            handleStepChange(OnboardingStepIndex.WELCOME);
        }
    }, [paymentMethods.length, analyticsService, handleStepComplete, handleStepChange]);
    var handleComplete = (0, react_1.useCallback)(function (templateName) { return __awaiter(void 0, void 0, void 0, function () {
        var templateMap, templateConfig_1, error, sdl, template, error, deposit, dd, messages, newCert, response, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 7, , 8]);
                    templateMap = {
                        "hello-akash": {
                            sdl: d.helloWorldTemplate.content,
                            name: "Hello Akash"
                        },
                        comfyui: {
                            id: "akash-network-awesome-akash-comfyui",
                            sdl: "",
                            name: "ComfyUI"
                        },
                        "llama-3.1-8b": {
                            id: "akash-network-awesome-akash-Llama-3.1-8B",
                            sdl: "",
                            name: "Llama 3.1 8B"
                        }
                    };
                    templateConfig_1 = templateMap[templateName];
                    if (!templateConfig_1) {
                        error = new Error("Template ".concat(templateName, " not found"));
                        errorHandler.reportError({
                            error: error,
                            severity: "warning",
                            tags: { component: "onboarding", template: templateName }
                        });
                        enqueueSnackbar("Template \"".concat(templateName, "\" is no longer supported, please choose another one"), { variant: "error" });
                        return [2 /*return*/];
                    }
                    sdl = templateConfig_1.sdl;
                    if (templateConfig_1.id) {
                        template = templates.find(function (t) { return t.id === templateConfig_1.id; });
                        if (!template || !template.deploy) {
                            error = new Error("Template ".concat(templateName, " SDL not found"));
                            errorHandler.reportError({
                                error: error,
                                severity: "warning",
                                tags: { component: "onboarding", template: templateName, templateId: templateConfig_1.id }
                            });
                            enqueueSnackbar("Template \"".concat(templateConfig_1.name, "\" is no longer supported, please choose another one"), { variant: "error" });
                            return [2 /*return*/];
                        }
                        sdl = template.deploy;
                    }
                    sdl = d.appendAuditorRequirement(sdl);
                    deposit = appConfig.NEXT_PUBLIC_DEFAULT_INITIAL_DEPOSIT;
                    return [4 /*yield*/, d.deploymentData.NewDeploymentData(chainApiHttpClient, sdl, null, address, deposit)];
                case 1:
                    dd = _b.sent();
                    d.validateDeploymentData(dd, null);
                    if (!dd) {
                        throw new Error("Failed to create deployment data");
                    }
                    messages = [];
                    return [4 /*yield*/, genNewCertificateIfLocalIsInvalid()];
                case 2:
                    newCert = _b.sent();
                    if (newCert) {
                        messages.push(d.TransactionMessageData.getCreateCertificateMsg(address, newCert.cert, newCert.publicKey));
                    }
                    messages.push(d.TransactionMessageData.getCreateDeploymentMsg(dd));
                    return [4 /*yield*/, signAndBroadcastTx(messages)];
                case 3:
                    response = _b.sent();
                    if (!response) return [3 /*break*/, 6];
                    if (!newCert) return [3 /*break*/, 5];
                    return [4 /*yield*/, updateSelectedCertificate(newCert)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5:
                    deploymentLocalStorage.update(address, dd.deploymentId.dseq, {
                        manifest: sdl,
                        manifestVersion: dd.hash,
                        name: templateConfig_1.name
                    });
                    analyticsService.track("create_deployment", {
                        category: "onboarding",
                        template: templateName,
                        dseq: dd.deploymentId.dseq
                    });
                    (_a = d.localStorage) === null || _a === void 0 ? void 0 : _a.removeItem(keys_1.ONBOARDING_STEP_KEY);
                    connectManagedWallet();
                    router.push(d.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.createLeases, dseq: dd.deploymentId.dseq }));
                    _b.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    error_1 = _b.sent();
                    enqueueSnackbar("Failed to deploy template. Please try again.", { variant: "error" });
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [
        d,
        router,
        connectManagedWallet,
        templates,
        chainApiHttpClient,
        address,
        appConfig,
        genNewCertificateIfLocalIsInvalid,
        signAndBroadcastTx,
        updateSelectedCertificate,
        deploymentLocalStorage,
        analyticsService,
        enqueueSnackbar,
        errorHandler
    ]);
    var steps = [
        {
            id: "free-trial",
            title: "Free Trial",
            description: "Learn about benefits",
            component: null,
            isCompleted: completedSteps.has(OnboardingStepIndex.FREE_TRIAL)
        },
        {
            id: "signup",
            title: "Create Account",
            description: "Sign up with Auth0",
            component: null,
            isCompleted: completedSteps.has(OnboardingStepIndex.SIGNUP)
        },
        {
            id: "email-verification",
            title: "Verify Email",
            description: "Confirm your email",
            component: null,
            isCompleted: completedSteps.has(OnboardingStepIndex.EMAIL_VERIFICATION),
            isDisabled: !(user === null || user === void 0 ? void 0 : user.emailVerified),
            hidePreviousButton: true
        },
        {
            id: "payment-method",
            title: "Payment Method",
            description: "Add payment info",
            component: null,
            isCompleted: completedSteps.has(OnboardingStepIndex.PAYMENT_METHOD),
            isDisabled: paymentMethods.length === 0
        },
        {
            id: "welcome",
            title: "Welcome",
            description: "Get started",
            component: null,
            isCompleted: completedSteps.has(OnboardingStepIndex.WELCOME)
        }
    ];
    return (<>
      {children({
            currentStep: currentStep,
            steps: steps,
            onStepChange: handleStepChange,
            onStepComplete: handleStepComplete,
            onStartTrial: handleStartTrial,
            onPaymentMethodComplete: handlePaymentMethodComplete,
            onComplete: handleComplete
        })}
    </>);
};
exports.OnboardingContainer = OnboardingContainer;
