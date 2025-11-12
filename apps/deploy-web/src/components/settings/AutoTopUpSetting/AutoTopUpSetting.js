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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoTopUpSetting = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var addYears_1 = require("date-fns/addYears");
var format_1 = require("date-fns/format");
var zod_2 = require("zod");
var priceUtils_1 = require("@src/utils/priceUtils");
var positiveNumberSchema = zod_2.z.coerce.number().min(0, {
    message: "Amount must be greater or equal to 0."
});
var formSchema = zod_2.z
    .object({
    uaktFeeLimit: positiveNumberSchema,
    usdcFeeLimit: positiveNumberSchema,
    uaktDeploymentLimit: positiveNumberSchema,
    usdcDeploymentLimit: positiveNumberSchema,
    expiration: zod_2.z.string().min(1, "Expiration is required.")
})
    .refine(function (data) {
    if (data.usdcDeploymentLimit > 0) {
        return data.usdcFeeLimit > 0;
    }
    return true;
}, {
    message: "Must be greater than 0 if `USDC Deployments Limit` is greater than 0",
    path: ["usdcFeeLimit"]
})
    .refine(function (data) {
    if (data.usdcFeeLimit > 0) {
        return data.usdcDeploymentLimit > 0;
    }
    return true;
}, {
    message: "Must be greater than 0 if `USDC Fees Limit` is greater than 0",
    path: ["usdcDeploymentLimit"]
})
    .refine(function (data) {
    if (data.uaktDeploymentLimit > 0) {
        return data.uaktFeeLimit > 0;
    }
    return true;
}, {
    message: "Must be greater than 0 if `AKT Deployments Limit` is greater than 0",
    path: ["uaktFeeLimit"]
})
    .refine(function (data) {
    if (data.uaktFeeLimit > 0) {
        return data.uaktDeploymentLimit > 0;
    }
    return true;
}, {
    message: "Must be greater than 0 if `AKT Fees Limit` is greater than 0",
    path: ["uaktDeploymentLimit"]
});
var fields = ["uaktFeeLimit", "usdcFeeLimit", "uaktDeploymentLimit", "usdcDeploymentLimit"];
var AutoTopUpSetting = function (_a) {
    var onSubmit = _a.onSubmit, expiration = _a.expiration, props = __rest(_a, ["onSubmit", "expiration"]);
    var hasAny = (0, react_1.useMemo)(function () { return fields.some(function (field) { return props[field]; }); }, [props]);
    var defaultLimitValues = (0, react_1.useMemo)(function () {
        return fields.reduce(function (acc, field) {
            acc[field] = (0, priceUtils_1.uaktToAKT)(props[field] || 0);
            return acc;
        }, {});
    }, [props]);
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: __assign(__assign({}, defaultLimitValues), { expiration: (0, format_1.default)(expiration || (0, addYears_1.default)(new Date(), 1), "yyyy-MM-dd'T'HH:mm") }),
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, setValue = form.setValue, reset = form.reset;
    (0, react_1.useEffect)(function () {
        setValue("uaktFeeLimit", (0, priceUtils_1.uaktToAKT)(props.uaktFeeLimit || 0));
    }, [props.uaktFeeLimit]);
    (0, react_1.useEffect)(function () {
        setValue("usdcFeeLimit", (0, priceUtils_1.uaktToAKT)(props.usdcFeeLimit || 0));
    }, [props.usdcFeeLimit]);
    (0, react_1.useEffect)(function () {
        setValue("uaktDeploymentLimit", (0, priceUtils_1.uaktToAKT)(props.uaktDeploymentLimit || 0));
    }, [props.uaktDeploymentLimit]);
    (0, react_1.useEffect)(function () {
        setValue("usdcDeploymentLimit", (0, priceUtils_1.uaktToAKT)(props.usdcDeploymentLimit || 0));
    }, [props.usdcDeploymentLimit]);
    (0, react_1.useEffect)(function () {
        if (expiration) {
            setValue("expiration", (0, format_1.default)(expiration || (0, addYears_1.default)(new Date(), 1), "yyyy-MM-dd'T'HH:mm"));
        }
    }, [expiration]);
    var execSubmitterRoleAction = (0, react_1.useCallback)(function (next, event) { return __awaiter(void 0, void 0, void 0, function () {
        var nativeEvent, role;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    nativeEvent = event === null || event === void 0 ? void 0 : event.nativeEvent;
                    role = (_a = nativeEvent === null || nativeEvent === void 0 ? void 0 : nativeEvent.submitter) === null || _a === void 0 ? void 0 : _a.getAttribute("data-role");
                    return [4 /*yield*/, onSubmit(role, convertToUakt(next))];
                case 1:
                    _b.sent();
                    reset(next);
                    return [2 /*return*/];
            }
        });
    }); }, [onSubmit, reset]);
    return (<div>
      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(execSubmitterRoleAction)} noValidate>
          <h5 className="space-y-1.5">Deployments billed in AKT</h5>
          <div className="flex">
            <div className="flex-1">
              <components_1.FormField control={control} name="uaktDeploymentLimit" render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return <components_1.FormInput {...field} dirty={fieldState.isDirty} type="number" label="Deployments Limit" min={0} step={0.000001}/>;
        }}/>
            </div>

            <div className="ml-3 flex-1">
              <components_1.FormField control={control} name="uaktFeeLimit" render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return <components_1.FormInput {...field} dirty={fieldState.isDirty} type="number" label="Fees Limit, AKT" min={0} step={0.000001}/>;
        }}/>
            </div>
          </div>

          <h5 className="space-y-1.5 pt-4">Deployments billed in USDC</h5>
          <div className="flex">
            <div className="flex-1">
              <components_1.FormField control={control} name="usdcDeploymentLimit" render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return <components_1.FormInput {...field} dirty={fieldState.isDirty} type="number" label="Deployments Limit" min={0} step={0.000001}/>;
        }}/>
            </div>

            <div className="ml-3 flex-1">
              <components_1.FormField control={control} name="usdcFeeLimit" render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return <components_1.FormInput {...field} dirty={fieldState.isDirty} type="number" label="Fees Limit, AKT" min={0} step={0.000001}/>;
        }}/>
            </div>
          </div>

          <div className="my-4 w-full">
            <react_hook_form_1.Controller control={control} name="expiration" render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return <components_1.FormInput {...field} dirty={fieldState.isDirty} type="datetime-local" label="Expiration"/>;
        }}/>
          </div>

          <components_1.Button variant="default" size="sm" className="mr-2" data-role="update" disabled={!form.formState.isDirty}>
            {hasAny ? "Update" : "Enable"}
          </components_1.Button>

          {hasAny && (<components_1.Button variant="default" size="sm" data-role="revoke-all">
              Disable
            </components_1.Button>)}
        </form>
      </components_1.Form>
    </div>);
};
exports.AutoTopUpSetting = AutoTopUpSetting;
function convertToUakt(_a) {
    var values = __rest(_a, []);
    return fields.reduce(function (acc, field) {
        acc[field] = (0, priceUtils_1.aktToUakt)(values[field]);
        return acc;
    }, values);
}
