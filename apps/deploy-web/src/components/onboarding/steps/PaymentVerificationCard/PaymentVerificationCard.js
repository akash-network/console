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
exports.PaymentVerificationCard = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var shared_1 = require("@src/components/shared");
var Title_1 = require("@src/components/shared/Title");
var useUser_1 = require("@src/hooks/useUser");
var usePaymentQueries_1 = require("@src/queries/usePaymentQueries");
var PaymentVerificationCard = function (_a) {
    var setupIntent = _a.setupIntent, onSuccess = _a.onSuccess;
    var user = (0, useUser_1.useUser)().user;
    var refetchPaymentMethods = (0, usePaymentQueries_1.usePaymentMethodsQuery)({
        enabled: !!(user === null || user === void 0 ? void 0 : user.stripeCustomerId)
    }).refetch;
    var handleCardAdded = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(user === null || user === void 0 ? void 0 : user.stripeCustomerId)) return [3 /*break*/, 2];
                    return [4 /*yield*/, refetchPaymentMethods()];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    onSuccess();
                    return [2 /*return*/];
            }
        });
    }); };
    if (!setupIntent) {
        return (<div className="space-y-6 text-center">
        <Title_1.Title>Add Payment Method</Title_1.Title>
        <components_1.Card className="mx-auto max-w-md text-left">
          <components_1.CardContent className="p-6 text-center text-muted-foreground">
            <p>Loading payment form...</p>
          </components_1.CardContent>
        </components_1.Card>
      </div>);
    }
    return (<div className="space-y-6 text-center">
      <Title_1.Title>Add Payment Method</Title_1.Title>
      <components_1.Card className="mx-auto max-w-md text-left">
        <components_1.CardHeader className="mb-2">
          <div className="mb-4 flex flex-row items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <iconoir_react_1.CreditCard className="h-8 w-8 text-primary"/>
            </div>
            <components_1.CardTitle>Add Payment Method</components_1.CardTitle>
          </div>
          <components_1.CardDescription className="space-y-2">
            <div>We need to verify your identity to provide you with the best service.</div>
            <div className="text-sm text-muted-foreground">Your payment method will be used for identity verification during the trial start process.</div>
          </components_1.CardDescription>
        </components_1.CardHeader>
        <components_1.CardContent className="space-y-4">
          <shared_1.PaymentMethodForm onSuccess={handleCardAdded} buttonText="Add Payment Method" processingText="Processing..."/>
        </components_1.CardContent>
      </components_1.Card>
    </div>);
};
exports.PaymentVerificationCard = PaymentVerificationCard;
