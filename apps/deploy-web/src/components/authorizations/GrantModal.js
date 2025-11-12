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
exports.GrantModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var react_intl_1 = require("react-intl");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var date_fns_1 = require("date-fns");
var zod_2 = require("zod");
var LinkTo_1 = require("@src/components/shared/LinkTo");
var denom_config_1 = require("@src/config/denom.config");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useDenom_1 = require("@src/hooks/useDenom");
var useWalletBalance_1 = require("@src/hooks/useWalletBalance");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var urlUtils_1 = require("@src/utils/urlUtils");
var supportedTokens = [
    { id: "akt", label: "AKT" },
    { id: "usdc", label: "USDC" }
];
var formSchema = zod_2.z.object({
    token: zod_2.z.string().min(1, "Token is required."),
    amount: zod_2.z.coerce.number().min(0, "Amount must be greater than 0."),
    expiration: zod_2.z.string().min(1, "Expiration is required."),
    granteeAddress: zod_2.z.string().min(1, "Grantee address is required.")
});
var GrantModal = function (_a) {
    var _b;
    var editingGrant = _a.editingGrant, address = _a.address, onClose = _a.onClose;
    var formRef = (0, react_1.useRef)(null);
    var _c = (0, react_1.useState)(""), error = _c[0], setError = _c[1];
    var signAndBroadcastTx = (0, WalletProvider_1.useWallet)().signAndBroadcastTx;
    var usdcDenom = (0, useDenom_1.useUsdcDenom)();
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            token: editingGrant ? (editingGrant.authorization.spend_limit.denom === usdcDenom ? "usdc" : "akt") : "akt",
            amount: editingGrant ? (0, priceUtils_1.coinToDenom)(editingGrant.authorization.spend_limit) : 0,
            expiration: (0, date_fns_1.format)((0, date_fns_1.addYears)(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
            granteeAddress: (_b = editingGrant === null || editingGrant === void 0 ? void 0 : editingGrant.grantee) !== null && _b !== void 0 ? _b : ""
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, watch = form.watch, clearErrors = form.clearErrors, setValue = form.setValue;
    var _d = watch(), amount = _d.amount, granteeAddress = _d.granteeAddress, expiration = _d.expiration, token = _d.token;
    var selectedToken = supportedTokens.find(function (x) { return x.id === token; });
    var denom = token === "akt" ? denom_config_1.UAKT_DENOM : usdcDenom;
    var denomData = (0, useWalletBalance_1.useDenomData)(denom);
    var onDepositClick = function (event) {
        var _a;
        event.preventDefault();
        (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
    var onSubmit = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
        var spendLimit, usdcDenom, denom, expirationDate, message, response;
        var amount = _b.amount, expiration = _b.expiration, granteeAddress = _b.granteeAddress;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setError("");
                    clearErrors();
                    spendLimit = token === "akt" ? (0, priceUtils_1.aktToUakt)(amount) : (0, mathHelpers_1.denomToUdenom)(amount);
                    usdcDenom = (0, useDenom_1.getUsdcDenom)();
                    denom = token === "akt" ? denom_config_1.UAKT_DENOM : usdcDenom;
                    expirationDate = new Date(expiration);
                    message = TransactionMessageData_1.TransactionMessageData.getGrantMsg(address, granteeAddress, spendLimit, expirationDate, denom);
                    return [4 /*yield*/, signAndBroadcastTx([message])];
                case 1:
                    response = _c.sent();
                    if (response) {
                        analytics_service_1.analyticsService.track("authorize_spend", {
                            category: "deployments",
                            label: "Authorize wallet to spend on deployment deposits"
                        });
                        onClose();
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    var onBalanceClick = function () {
        clearErrors();
        setValue("amount", (denomData === null || denomData === void 0 ? void 0 : denomData.max) || 0);
    };
    return (<components_1.Popup fullWidth open variant="custom" actions={[
            {
                label: "Cancel",
                color: "primary",
                variant: "text",
                side: "left",
                onClick: onClose
            },
            {
                label: "Grant",
                color: "secondary",
                variant: "default",
                side: "right",
                disabled: !amount,
                onClick: onDepositClick
            }
        ]} onClose={onClose} maxWidth="sm" enableCloseOnBackdropClick title="Authorize Spending">
      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <components_1.Alert className="mb-4">
            <p className="text-sm text-muted-foreground">
              <LinkTo_1.LinkTo onClick={function (ev) { return (0, urlUtils_1.handleDocClick)(ev, "https://akash.network/docs/network-features/authorized-spend/"); }}>Authorized Spend</LinkTo_1.LinkTo> allows users
              to authorize spending of a set number of tokens from a source wallet to a destination, funded wallet. The authorized spend is restricted to Akash
              deployment activities and the recipient of the tokens would not have access to those tokens for other operations.
            </p>
          </components_1.Alert>

          <div className="mb-2 mt-2 text-right">
            <LinkTo_1.LinkTo onClick={function () { return onBalanceClick(); }}>
              Balance: {denomData === null || denomData === void 0 ? void 0 : denomData.balance} {denomData === null || denomData === void 0 ? void 0 : denomData.label}
            </LinkTo_1.LinkTo>
          </div>

          <div className="mb-4 flex w-full flex-row items-center">
            <components_1.FormField control={control} name="token" render={function (_a) {
            var field = _a.field;
            return (<div>
                    <components_1.FormLabel htmlFor="grant-address">Token</components_1.FormLabel>
                    <components_1.Select value={field.value || ""} onValueChange={field.onChange}>
                      <components_1.SelectTrigger id="grant-address">
                        <components_1.SelectValue placeholder="Select grant token"/>
                      </components_1.SelectTrigger>
                      <components_1.SelectContent>
                        <components_1.SelectGroup>
                          {supportedTokens.map(function (token) { return (<components_1.SelectItem key={token.id} value={token.id}>
                              {token.label}
                            </components_1.SelectItem>); })}
                        </components_1.SelectGroup>
                      </components_1.SelectContent>
                    </components_1.Select>

                    <components_1.FormMessage />
                  </div>);
        }}/>

            <components_1.FormField control={control} name="amount" render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput {...field} type="number" label="Spending Limit" autoFocus min={0} step={0.000001} max={denomData === null || denomData === void 0 ? void 0 : denomData.max} startIcon={<span className="pl-2 text-xs">{denomData === null || denomData === void 0 ? void 0 : denomData.label}</span>} className="ml-4 flex-grow"/>);
        }}/>
          </div>

          <div className="mb-4 w-full">
            <components_1.FormField control={control} name="granteeAddress" render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} type="text" label="Grantee Address" disabled={!!editingGrant}/>;
        }}/>
          </div>

          <div className="mb-4 w-full">
            <components_1.FormField control={control} name="expiration" render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} type="datetime-local" label="Expiration"/>;
        }}/>
          </div>

          {!!amount && granteeAddress && (<components_1.Alert>
              <p className="text-sm text-muted-foreground">
                This address will be able to spend up to {amount} {selectedToken === null || selectedToken === void 0 ? void 0 : selectedToken.label} on your behalf ending on{" "}
                <react_intl_1.FormattedDate value={expiration} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit"/>.
              </p>
            </components_1.Alert>)}

          {error && <components_1.Alert variant="warning">{error}</components_1.Alert>}
        </form>
      </components_1.Form>
    </components_1.Popup>);
};
exports.GrantModal = GrantModal;
