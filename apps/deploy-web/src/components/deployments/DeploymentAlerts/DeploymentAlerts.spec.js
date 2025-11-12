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
var react_hook_form_1 = require("react-hook-form");
var faker_1 = require("@faker-js/faker");
var DeploymentAlerts_1 = require("@src/components/deployments/DeploymentAlerts/DeploymentAlerts");
var react_1 = require("@testing-library/react");
var deploymentAlert_1 = require("@tests/seeders/deploymentAlert");
var notificationChannel_1 = require("@tests/seeders/notificationChannel");
describe("DeploymentAlerts", function () {
    it("should handle form submission with updated alert settings", function () { return __awaiter(void 0, void 0, void 0, function () {
        var componentProps, saveButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    componentProps = setup().componentProps;
                    react_1.fireEvent.click(react_1.screen.getByLabelText("Enabled", { selector: '[name="deploymentBalance.enabled"]' }));
                    react_1.fireEvent.click(react_1.screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));
                    react_1.fireEvent.change(react_1.screen.getByRole("combobox", { name: /escrow balance notification channel/i }), {
                        target: { value: componentProps.notificationChannels[0].id }
                    });
                    react_1.fireEvent.change(react_1.screen.getByRole("combobox", { name: /deployment close notification channel/i }), {
                        target: { value: componentProps.notificationChannels[1].id }
                    });
                    react_1.fireEvent.change(react_1.screen.getByRole("spinbutton", { name: /threshold/i }), { target: { value: "100" } });
                    saveButton = react_1.screen.getByRole("button", { name: /save changes/i });
                    return [4 /*yield*/, (0, react_1.act)(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                react_1.fireEvent.click(saveButton);
                                return [2 /*return*/];
                            });
                        }); })];
                case 1:
                    _a.sent();
                    expect(componentProps.upsert).toHaveBeenCalledWith({
                        alerts: {
                            deploymentBalance: expect.objectContaining({
                                enabled: false,
                                notificationChannelId: componentProps.notificationChannels[0].id,
                                threshold: 100
                            }),
                            deploymentClosed: expect.objectContaining({
                                enabled: false,
                                notificationChannelId: componentProps.notificationChannels[1].id
                            })
                        }
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        var channel1Id = faker_1.faker.string.uuid();
        var channel2Id = faker_1.faker.string.uuid();
        var DEPENDENCIES = {
            useFlag: function () { return true; },
            DeploymentCloseAlert: function (_a) {
                var disabled = _a.disabled;
                var register = (0, react_hook_form_1.useFormContext)().register;
                return (<div>
            <input type="checkbox" {...register("deploymentClosed.enabled")} aria-label="Enabled" disabled={disabled}/>
            <select {...register("deploymentClosed.notificationChannelId")} aria-label="Deployment Close Notification Channel" disabled={disabled}>
              <option value={channel1Id}>Channel 1</option>
              <option value={channel2Id}>Channel 2</option>
            </select>
          </div>);
            },
            DeploymentBalanceAlert: function (_a) {
                var disabled = _a.disabled;
                var register = (0, react_hook_form_1.useFormContext)().register;
                return (<div>
            <input type="checkbox" {...register("deploymentBalance.enabled")} aria-label="Enabled" disabled={disabled}/>
            <select {...register("deploymentBalance.notificationChannelId")} aria-label="Escrow Balance Notification Channel" disabled={disabled}>
              <option value={channel1Id}>Channel 1</option>
              <option value={channel2Id}>Channel 2</option>
            </select>
            <input type="number" {...register("deploymentBalance.threshold", { valueAsNumber: true })} aria-label="Threshold" disabled={disabled}/>
          </div>);
            }
        };
        var componentProps = {
            maxBalanceThreshold: 1000,
            onStateChange: jest.fn(),
            notificationChannels: [(0, notificationChannel_1.buildNotificationChannel)({ id: channel1Id }), (0, notificationChannel_1.buildNotificationChannel)({ id: channel2Id })],
            upsert: jest.fn(),
            data: (0, deploymentAlert_1.buildDeploymentAlert)({
                alerts: {
                    deploymentBalance: {
                        id: faker_1.faker.string.uuid(),
                        status: "NORMAL",
                        notificationChannelId: channel1Id,
                        threshold: 100,
                        enabled: true
                    },
                    deploymentClosed: {
                        id: faker_1.faker.string.uuid(),
                        status: "NORMAL",
                        notificationChannelId: channel2Id,
                        enabled: true
                    }
                }
            }),
            isFetched: true,
            isLoading: false,
            isError: false
        };
        (0, react_1.render)(<DeploymentAlerts_1.DeploymentAlertsView {...componentProps} dependencies={DEPENDENCIES}/>);
        return { componentProps: componentProps };
    }
});
