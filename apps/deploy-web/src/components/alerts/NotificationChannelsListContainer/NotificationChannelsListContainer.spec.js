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
var notifications_1 = require("@akashnetwork/react-query-sdk/notifications");
var context_1 = require("@akashnetwork/ui/context");
var react_query_1 = require("@tanstack/react-query");
var NotificationChannelsListContainer_1 = require("@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var queries_1 = require("@src/queries");
var react_2 = require("@testing-library/react");
var notificationChannel_1 = require("@tests/seeders/notificationChannel");
var container_testing_child_capturer_1 = require("@tests/unit/container-testing-child-capturer");
describe("NotificationChannelsListContainer", function () {
    it("renders notification channels list with data", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, mockData, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), mockData = _a.mockData, child = _a.child;
                    expect(child.data).toEqual(mockData.data);
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls delete endpoint and shows success notification when removing a notification channel succeeds", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, mockData, requestFn, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), mockData = _a.mockData, requestFn = _a.requestFn, child = _a.child;
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.onRemove(mockData.data[0].id); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({ method: "delete", url: "/v1/notification-channels/{id}" }), expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } }));
                            expect(react_2.screen.getByTestId("notification-channel-remove-success-notification")).toBeInTheDocument();
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls delete endpoint and shows error notification when removing a notification channel fails", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, mockData, requestFn, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), mockData = _a.mockData, requestFn = _a.requestFn, child = _a.child;
                    requestFn.mockRejectedValue(new Error());
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.onRemove(mockData.data[0].id); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({ method: "delete", url: "/v1/notification-channels/{id}" }), expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } }));
                            expect(react_2.screen.getByTestId("notification-channel-remove-error-notification")).toBeInTheDocument();
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("handles pagination correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, requestFn, child;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, setup()];
                case 1:
                    _a = _b.sent(), requestFn = _a.requestFn, child = _a.child;
                    return [4 /*yield*/, (0, react_2.act)(function () { return child.onPaginationChange({ page: child.pagination.page + 1, limit: child.pagination.limit }); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(requestFn).toHaveBeenCalledWith(expect.objectContaining({ method: "get", url: "/v1/notification-channels" }), expect.objectContaining({
                                parameters: {
                                    query: {
                                        page: 2,
                                        limit: 10
                                    }
                                }
                            }));
                        })];
                case 3:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    function setup() {
        return __awaiter(this, void 0, void 0, function () {
            var mockData, requestFn, services, childCapturer, child;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        mockData = {
                            data: Array.from({ length: 10 }, notificationChannel_1.buildNotificationChannel),
                            pagination: {
                                page: 1,
                                limit: 10,
                                total: 11,
                                totalPages: 2
                            }
                        };
                        requestFn = jest.fn(function () {
                            return Promise.resolve({
                                data: mockData
                            });
                        });
                        services = {
                            notificationsApi: function () {
                                return (0, notifications_1.createAPIClient)({
                                    requestFn: requestFn,
                                    baseUrl: "",
                                    queryClient: queries_1.queryClient
                                });
                            }
                        };
                        childCapturer = (0, container_testing_child_capturer_1.createContainerTestingChildCapturer)();
                        (0, react_2.render)(<context_1.CustomSnackbarProvider>
        <ServicesProvider_1.ServicesProvider services={services}>
          <react_query_1.QueryClientProvider client={queries_1.queryClient}>
            <NotificationChannelsListContainer_1.NotificationChannelsListContainer>{childCapturer.renderChild}</NotificationChannelsListContainer_1.NotificationChannelsListContainer>
          </react_query_1.QueryClientProvider>
        </ServicesProvider_1.ServicesProvider>
      </context_1.CustomSnackbarProvider>);
                        return [4 /*yield*/, childCapturer.awaitChild(function (_a) {
                                var data = _a.data;
                                return !!data.length;
                            })];
                    case 1:
                        child = _a.sent();
                        return [2 /*return*/, { mockData: mockData, requestFn: requestFn, child: child }];
                }
            });
        });
    }
});
