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
var components_1 = require("@akashnetwork/ui/components");
var context_1 = require("@akashnetwork/ui/context");
var NotificationChannelsListView_1 = require("./NotificationChannelsListView");
var react_2 = require("@testing-library/react");
var notificationChannel_1 = require("@tests/seeders/notificationChannel");
describe("NotificationChannelsListView", function () {
    it("renders loading spinner when isLoading is true", function () {
        setup({ isLoading: true });
        expect(react_2.screen.getByRole("status")).toBeInTheDocument();
    });
    it("renders error message when isError is true", function () {
        setup({ isError: true });
        expect(react_2.screen.getByText("Error loading notification channels")).toBeInTheDocument();
    });
    it("renders empty state message when no data is provided", function () {
        setup({ data: [] });
        expect(react_2.screen.getByText("No notification channels found")).toBeInTheDocument();
    });
    it("renders table with notification channels data", function () {
        var mockNotificationChannel = (0, notificationChannel_1.buildNotificationChannel)();
        setup({ data: [mockNotificationChannel] });
        expect(react_2.screen.getByText("Name")).toBeInTheDocument();
        expect(react_2.screen.getByText("Type")).toBeInTheDocument();
        expect(react_2.screen.getByText("Addresses")).toBeInTheDocument();
        expect(react_2.screen.getByText(mockNotificationChannel.name)).toBeInTheDocument();
        expect(react_2.screen.getByText("email")).toBeInTheDocument();
        expect(react_2.screen.getByText(mockNotificationChannel.config.addresses[0])).toBeInTheDocument();
    });
    it("shows confirmation popup when remove button is clicked", function () { return __awaiter(void 0, void 0, void 0, function () {
        var mockNotificationChannel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mockNotificationChannel = (0, notificationChannel_1.buildNotificationChannel)();
                    setup({ data: [mockNotificationChannel] });
                    react_2.fireEvent.click(react_2.screen.getByTestId("remove-notification-channel-button"));
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.getByTestId("remove-notification-channel-confirmation-popup")).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    expect(react_2.screen.getByText("Are you sure you want to remove this notification channel?")).toBeInTheDocument();
                    expect(react_2.screen.getByText("This action cannot be undone.")).toBeInTheDocument();
                    expect(react_2.screen.getByText("Cancel")).toBeInTheDocument();
                    expect(react_2.screen.getByText("Confirm")).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it("calls onRemove when confirmed", function () { return __awaiter(void 0, void 0, void 0, function () {
        var onRemove, mockNotificationChannel;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onRemove = jest.fn();
                    mockNotificationChannel = (0, notificationChannel_1.buildNotificationChannel)();
                    setup({ data: [mockNotificationChannel], onRemove: onRemove });
                    react_2.fireEvent.click(react_2.screen.getByTestId("remove-notification-channel-button"));
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(react_2.screen.getByTestId("remove-notification-channel-confirmation-popup")).toBeInTheDocument();
                        })];
                case 1:
                    _a.sent();
                    (0, react_2.act)(function () {
                        react_2.fireEvent.click(react_2.screen.getByTestId("remove-notification-channel-confirmation-popup-confirm-button"));
                    });
                    return [4 /*yield*/, (0, react_2.waitFor)(function () {
                            expect(onRemove).toHaveBeenCalledWith(mockNotificationChannel.id);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("does not render pagination when total is not greater than minimum page size", function () {
        setup();
        expect(react_2.screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
    it("renders pagination when total is greater than minimum page size", function () {
        var pagination = {
            page: 1,
            limit: 10,
            total: 11,
            totalPages: 2
        };
        var mockData = Array.from({ length: 11 }, notificationChannel_1.buildNotificationChannel);
        setup({ data: mockData, pagination: pagination });
        expect(react_2.screen.getByRole("navigation")).toBeInTheDocument();
    });
    function setup(props) {
        if (props === void 0) { props = {}; }
        var defaultProps = __assign({ pagination: {
                page: 1,
                limit: 10,
                total: 10,
                totalPages: 1
            }, data: Array.from({ length: 10 }, notificationChannel_1.buildNotificationChannel), isLoading: false, onRemove: jest.fn(), removingIds: new Set(), onPaginationChange: jest.fn(), isError: false }, props);
        (0, react_2.render)(<context_1.PopupProvider>
        <components_1.TooltipProvider>
          <NotificationChannelsListView_1.NotificationChannelsListView {...defaultProps}/>
        </components_1.TooltipProvider>
      </context_1.PopupProvider>);
        return defaultProps;
    }
});
