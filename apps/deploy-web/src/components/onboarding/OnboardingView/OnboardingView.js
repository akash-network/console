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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingView = void 0;
var react_1 = require("react");
var OnboardingContainer_1 = require("../OnboardingContainer/OnboardingContainer");
var OnboardingStepper_1 = require("../OnboardingStepper/OnboardingStepper");
var EmailVerificationContainer_1 = require("../steps/EmailVerificationContainer/EmailVerificationContainer");
var EmailVerificationStep_1 = require("../steps/EmailVerificationStep/EmailVerificationStep");
var FreeTrialLandingStep_1 = require("../steps/FreeTrialLandingStep/FreeTrialLandingStep");
var PaymentMethodContainer_1 = require("../steps/PaymentMethodContainer/PaymentMethodContainer");
var PaymentMethodStep_1 = require("../steps/PaymentMethodStep/PaymentMethodStep");
var WelcomeStep_1 = require("../steps/WelcomeStep/WelcomeStep");
var DEPENDENCIES = {
    OnboardingStepper: OnboardingStepper_1.OnboardingStepper,
    FreeTrialLandingStep: FreeTrialLandingStep_1.FreeTrialLandingStep,
    EmailVerificationContainer: EmailVerificationContainer_1.EmailVerificationContainer,
    EmailVerificationStep: EmailVerificationStep_1.EmailVerificationStep,
    PaymentMethodContainer: PaymentMethodContainer_1.PaymentMethodContainer,
    PaymentMethodStep: PaymentMethodStep_1.PaymentMethodStep,
    WelcomeStep: WelcomeStep_1.WelcomeStep
};
var OnboardingView = function (_a) {
    var currentStep = _a.currentStep, steps = _a.steps, onStepChange = _a.onStepChange, onStartTrial = _a.onStartTrial, onPaymentMethodComplete = _a.onPaymentMethodComplete, onComplete = _a.onComplete, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var stepsWithComponents = [
        __assign(__assign({}, steps[OnboardingContainer_1.OnboardingStepIndex.FREE_TRIAL]), { component: <d.FreeTrialLandingStep onStartTrial={onStartTrial}/> }),
        __assign(__assign({}, steps[OnboardingContainer_1.OnboardingStepIndex.SIGNUP]), { component: null // No component needed for redirect step
         }),
        __assign(__assign({}, steps[OnboardingContainer_1.OnboardingStepIndex.EMAIL_VERIFICATION]), { component: (<d.EmailVerificationContainer onComplete={function () { return onStepChange(OnboardingContainer_1.OnboardingStepIndex.PAYMENT_METHOD); }}>
          {function (props) { return <d.EmailVerificationStep {...props}/>; }}
        </d.EmailVerificationContainer>) }),
        __assign(__assign({}, steps[OnboardingContainer_1.OnboardingStepIndex.PAYMENT_METHOD]), { component: <d.PaymentMethodContainer onComplete={onPaymentMethodComplete}>{function (props) { return <d.PaymentMethodStep {...props}/>; }}</d.PaymentMethodContainer> }),
        __assign(__assign({}, steps[OnboardingContainer_1.OnboardingStepIndex.WELCOME]), { component: <d.WelcomeStep onComplete={onComplete}/> })
    ];
    return <d.OnboardingStepper steps={stepsWithComponents} currentStep={currentStep}/>;
};
exports.OnboardingView = OnboardingView;
