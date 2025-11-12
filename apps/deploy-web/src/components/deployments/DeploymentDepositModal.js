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
exports.DeploymentDepositModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var navigation_1 = require("next/navigation");
var zod_2 = require("zod");
var denom_config_1 = require("@src/config/denom.config");
var PricingProvider_1 = require("@src/context/PricingProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useAddFundsVerifiedLoginRequiredEventHandler_1 = require("@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var urlUtils_1 = require("@src/utils/urlUtils");
var LeaseSpecDetail_1 = require("../shared/LeaseSpecDetail");
var LinkTo_1 = require("../shared/LinkTo");
var formSchema = zod_2.z.object({
    amount: zod_2.z.coerce
        .number({
        invalid_type_error: "Amount must be a number."
    })
        .min(0.000001, { message: "Amount is required." })
});
var DeploymentDepositModal = function (_a) {
    var handleCancel = _a.handleCancel, onDeploymentDeposit = _a.onDeploymentDeposit, disableMin = _a.disableMin, denom = _a.denom, _b = _a.title, title = _b === void 0 ? "Deployment Deposit" : _b, _c = _a.infoText, infoText = _c === void 0 ? null : _c, _d = _a.services, services = _d === void 0 ? [] : _d;
    var formRef = (0, react_1.useRef)(null);
    var _e = (0, react_1.useState)(""), error = _e[0], setError = _e[1];
    var isManaged = (0, WalletProvider_1.useWallet)().isManaged;
    var walletBalance = (0, useWalletBalance_1.useWalletBalance)().balance;
    var pricing = (0, PricingProvider_1.usePricing)();
    var depositData = (0, useWalletBalance_1.useDenomData)(denom);
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            amount: 0
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, watch = form.watch, setValue = form.setValue, clearErrors = form.clearErrors;
    var amount = watch().amount;
    var whenLoggedInAndVerified = (0, useAddFundsVerifiedLoginRequiredEventHandler_1.useAddFundsVerifiedLoginRequiredEventHandler)();
    var router = (0, navigation_1.useRouter)();
    var closePopupAndGoToCheckoutIfPossible = function (event) {
        analytics_service_1.analyticsService.track("buy_credits_btn_clk", "Amplitude");
        handleCancel();
        whenLoggedInAndVerified(goToCheckout)(event);
    };
    var goToCheckout = function () {
        router.push(urlUtils_1.UrlService.payment());
    };
    (0, react_1.useEffect)(function () {
        if (depositData && amount === 0 && !disableMin) {
            setValue("amount", (depositData === null || depositData === void 0 ? void 0 : depositData.min) || 0);
        }
    }, [depositData, amount, disableMin, setValue]);
    var onClose = function () {
        analytics_service_1.analyticsService.track("close_deposit_modal", "Amplitude");
        handleCancel();
    };
    var onBalanceClick = function () {
        clearErrors();
        setValue("amount", (depositData === null || depositData === void 0 ? void 0 : depositData.max) || 0);
    };
    var onDepositClick = function (event) {
        var _a;
        event.preventDefault();
        (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
    var onSubmit = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var amountInDenom, deposit;
        var amount = _b.amount;
        return __generator(this, function (_c) {
            setError("");
            clearErrors();
            amountInDenom = (isManaged && denom === denom_config_1.UAKT_DENOM ? pricing.usdToAkt(amount) : amount) || 0;
            deposit = (0, mathHelpers_1.denomToUdenom)(amountInDenom);
            if (!disableMin && amount < ((depositData === null || depositData === void 0 ? void 0 : depositData.min) || 0)) {
                setError("Deposit amount must be greater or equal than ".concat(depositData === null || depositData === void 0 ? void 0 : depositData.min, "."));
                return [2 /*return*/];
            }
            if (depositData && amount > (depositData === null || depositData === void 0 ? void 0 : depositData.balance)) {
                setError("You can't deposit more than you currently have in your balance. Current balance is: ".concat(depositData === null || depositData === void 0 ? void 0 : depositData.balance, " ").concat(depositData === null || depositData === void 0 ? void 0 : depositData.label, "."));
                return [2 /*return*/];
            }
            onDeploymentDeposit(deposit);
            return [2 /*return*/];
        });
    }); };
    return (<components_1.Popup fullWidth open variant="custom" actions={__spreadArray(__spreadArray([
            {
                label: "Cancel",
                color: "primary",
                variant: "ghost",
                side: "left",
                onClick: onClose
            }
        ], (isManaged
            ? [
                {
                    label: "Buy credits",
                    color: "primary",
                    variant: "ghost",
                    side: "right",
                    onClick: closePopupAndGoToCheckoutIfPossible,
                    "data-testid": "deposit-modal-buy-credits-button"
                }
            ]
            : []), true), [
            {
                label: "Continue",
                color: "secondary",
                variant: "default",
                side: "right",
                disabled: !amount || !walletBalance,
                onClick: onDepositClick,
                "data-testid": "deposit-modal-continue-button"
            }
        ], false)} onClose={onClose} enableCloseOnBackdropClick title={title}>
      {services.length > 0 && (<div className="mb-3 max-h-[300px] overflow-auto">
          {services.map(function (service) {
                var _a, _b, _c, _d, _e, _f, _g;
                return (<components_1.Alert key={service.title} className="mb-1">
                <div className="mb-2 break-all text-sm">
                  <span className="font-bold">{service.title}</span>:{service.image}
                </div>
                <div className="flex items-center space-x-4 whitespace-nowrap">
                  <LeaseSpecDetail_1.LeaseSpecDetail type="cpu" className="flex-shrink-0" value={(_a = service.profile) === null || _a === void 0 ? void 0 : _a.cpu}/>
                  {!!((_b = service.profile) === null || _b === void 0 ? void 0 : _b.gpu) && <LeaseSpecDetail_1.LeaseSpecDetail type="gpu" className="flex-shrink-0" value={(_c = service.profile) === null || _c === void 0 ? void 0 : _c.gpu}/>}
                  <LeaseSpecDetail_1.LeaseSpecDetail type="ram" className="flex-shrink-0" value={"".concat((_d = service.profile) === null || _d === void 0 ? void 0 : _d.ram, " ").concat((_e = service.profile) === null || _e === void 0 ? void 0 : _e.ramUnit)}/>
                  <LeaseSpecDetail_1.LeaseSpecDetail type="storage" className="flex-shrink-0" value={"".concat((_f = service.profile) === null || _f === void 0 ? void 0 : _f.storage[0].size, " ").concat((_g = service.profile) === null || _g === void 0 ? void 0 : _g.storage[0].unit)}/>
                </div>
              </components_1.Alert>);
            })}
        </div>)}

      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          {infoText}

          <div className="w-full">
            <components_1.FormField control={control} name="amount" render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput {...field} type="number" label={<div className="mb-1 flex items-center justify-between">
                        <span>Amount</span>
                        <LinkTo_1.LinkTo onClick={function () { return onBalanceClick(); }} className="text-xs">
                          Balance: {depositData === null || depositData === void 0 ? void 0 : depositData.balance} {depositData === null || depositData === void 0 ? void 0 : depositData.label}
                        </LinkTo_1.LinkTo>
                      </div>} autoFocus min={!disableMin ? depositData === null || depositData === void 0 ? void 0 : depositData.min : 0} step={0.000001} max={depositData === null || depositData === void 0 ? void 0 : depositData.max} startIcon={<div className="pl-2 text-xs">{depositData === null || depositData === void 0 ? void 0 : depositData.label}</div>}/>);
        }}/>
          </div>

          {error && (<components_1.Alert variant="destructive" className="mt-4 text-sm">
              {error}
            </components_1.Alert>)}
        </form>
      </components_1.Form>
    </components_1.Popup>);
};
exports.DeploymentDepositModal = DeploymentDepositModal;
