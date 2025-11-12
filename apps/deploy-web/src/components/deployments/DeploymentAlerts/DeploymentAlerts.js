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
exports.DeploymentAlerts = exports.DeploymentAlertsView = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var lodash_1 = require("lodash");
var isEqual_1 = require("lodash/isEqual");
var zod_2 = require("zod");
var DeploymentAlertsContainer_1 = require("@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer");
var NotificationChannelsGuard_1 = require("@src/components/alerts/NotificationChannelsGuard/NotificationChannelsGuard");
var DeploymentBalanceAlert_1 = require("@src/components/deployments/DeploymentBalanceAlert/DeploymentBalanceAlert");
var DeploymentCloseAlert_1 = require("@src/components/deployments/DeploymentCloseAlert/DeploymentCloseAlert");
var LoadingBlocker_1 = require("@src/components/layout/LoadingBlocker/LoadingBlocker");
var useFlag_1 = require("@src/hooks/useFlag");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var DEPENDENCIES = {
    DeploymentCloseAlert: DeploymentCloseAlert_1.DeploymentCloseAlert,
    DeploymentBalanceAlert: DeploymentBalanceAlert_1.DeploymentBalanceAlert,
    useFlag: useFlag_1.useFlag
};
var schema = zod_2.z.object({
    deploymentBalance: zod_2.z.object({
        notificationChannelId: zod_2.z.string().min(1, "Notification Channel is required"),
        threshold: zod_2.z.number().min(0, "Threshold must be greater than 0"),
        enabled: zod_2.z.boolean()
    }),
    deploymentClosed: zod_2.z.object({
        notificationChannelId: zod_2.z.string().min(1, "Notification Channel is required"),
        enabled: zod_2.z.boolean()
    })
});
var DEFAULT_VALUES = {
    deploymentBalance: {
        notificationChannelId: "",
        threshold: 0,
        enabled: false
    },
    deploymentClosed: {
        notificationChannelId: "",
        enabled: false
    }
};
var DeploymentAlertsView = function (_a) {
    var isLoading = _a.isLoading, data = _a.data, upsert = _a.upsert, maxBalanceThreshold = _a.maxBalanceThreshold, onStateChange = _a.onStateChange, notificationChannels = _a.notificationChannels, disabled = _a.disabled, _b = _a.dependencies, d = _b === void 0 ? DEPENDENCIES : _b;
    var isDeploymentClosedEnabled = d.useFlag("ui_deployment_closed_alert");
    var strictSchema = (0, react_1.useMemo)(function () {
        return schema.extend({
            deploymentBalance: zod_2.z.object({
                threshold: zod_2.z.number().max(maxBalanceThreshold, "Threshold must be less than or equal to the current balance").min(0, "Threshold must be greater than 0")
            })
        });
    }, [maxBalanceThreshold]);
    var assignDefaults = (0, react_1.useCallback)(function (alerts) {
        var _a, _b;
        return (0, lodash_1.merge)({}, DEFAULT_VALUES, {
            deploymentBalance: {
                notificationChannelId: ((_a = notificationChannels[0]) === null || _a === void 0 ? void 0 : _a.id) || "",
                threshold: (0, mathHelpers_1.ceilDecimal)(0.3 * maxBalanceThreshold)
            },
            deploymentClosed: {
                notificationChannelId: ((_b = notificationChannels[0]) === null || _b === void 0 ? void 0 : _b.id) || ""
            }
        }, alerts);
    }, [maxBalanceThreshold, notificationChannels]);
    var providedValues = (0, react_1.useMemo)(function () {
        return assignDefaults(data === null || data === void 0 ? void 0 : data.alerts);
    }, [assignDefaults, data === null || data === void 0 ? void 0 : data.alerts]);
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: providedValues,
        reValidateMode: "onSubmit",
        resolver: (0, zod_1.zodResolver)(strictSchema)
    });
    var _c = (0, react_1.useState)(false), hasChanges = _c[0], setHasChanges = _c[1];
    var values = form.watch();
    (0, react_1.useEffect)(function () {
        if (!onStateChange) {
            return;
        }
        var hasChangesNext = !(0, isEqual_1.default)(providedValues, values);
        if (hasChanges !== hasChangesNext) {
            setHasChanges(hasChangesNext);
            onStateChange({ hasChanges: hasChangesNext });
        }
    }, [providedValues, onStateChange, values, hasChanges]);
    var submit = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var deploymentBalance, deploymentClosed, payload, nextValues;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    deploymentBalance = values.deploymentBalance, deploymentClosed = values.deploymentClosed;
                    payload = {};
                    if (!(0, isEqual_1.default)(providedValues.deploymentBalance, deploymentBalance)) {
                        payload.deploymentBalance = deploymentBalance;
                    }
                    if (!(0, isEqual_1.default)(providedValues.deploymentClosed, deploymentClosed)) {
                        payload.deploymentClosed = deploymentClosed;
                    }
                    return [4 /*yield*/, upsert({ alerts: payload })];
                case 1:
                    nextValues = _a.sent();
                    if (nextValues) {
                        form.reset(assignDefaults(nextValues.alerts));
                    }
                    return [2 /*return*/];
            }
        });
    }); }, [values, providedValues.deploymentBalance, providedValues.deploymentClosed, upsert, form, assignDefaults]);
    return (<react_hook_form_1.FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="my-4 flex items-center text-xl font-bold">
          <h3 className="mr-4">Configure Alerts</h3>
          {!disabled && (<components_1.LoadingButton type="submit" loading={isLoading} disabled={!hasChanges}>
              Save Changes
            </components_1.LoadingButton>)}
        </div>
        <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
          <d.DeploymentBalanceAlert disabled={isLoading || disabled}/>
          {isDeploymentClosedEnabled && <d.DeploymentCloseAlert disabled={isLoading || disabled}/>}
        </div>
      </form>
    </react_hook_form_1.FormProvider>);
};
exports.DeploymentAlertsView = DeploymentAlertsView;
var DeploymentAlerts = function (_a) {
    var deployment = _a.deployment, onStateChange = _a.onStateChange;
    return (<NotificationChannelsGuard_1.NotificationChannelsGuard>
      {function (_a) {
            var notificationChannels = _a.data;
            return (<DeploymentAlertsContainer_1.DeploymentAlertsContainer deployment={deployment}>
          {function (props) { return (<LoadingBlocker_1.LoadingBlocker isLoading={!props.isFetched}>
              <exports.DeploymentAlertsView {...props} onStateChange={onStateChange} notificationChannels={notificationChannels} disabled={deployment.state === "closed"}/>
            </LoadingBlocker_1.LoadingBlocker>); }}
        </DeploymentAlertsContainer_1.DeploymentAlertsContainer>);
        }}
    </NotificationChannelsGuard_1.NotificationChannelsGuard>);
};
exports.DeploymentAlerts = DeploymentAlerts;
