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
var jest_mock_extended_1 = require("jest-mock-extended");
var defineApiHandler_1 = require("@src/lib/nextjs/defineApiHandler/defineApiHandler");
var ____path_1 = require("@src/pages/api/proxy/[...path]");
var server_di_container_service_1 = require("@src/services/app-di-container/server-di-container.service");
describe("proxy API handler", function () {
    it("forwards cf_clearance and unleash-session-id cookies to backend", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, req, handlerPromise;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = setup({
                        url: "/api/proxy/v1/wallets?userId=2d888ad9-9359-4699-938f-3d66a8a8881a",
                        headers: {
                            cookie: "cf_clearance=test123; other-cookie=ignored; unleash-session-id=session456; another-cookie=also-ignored"
                        }
                    }), req = _a.req, handlerPromise = _a.handlerPromise;
                    return [4 /*yield*/, handlerPromise];
                case 1:
                    _b.sent();
                    expect(req.headers.cookie).toBe("cf_clearance=test123; unleash-session-id=session456");
                    return [2 /*return*/];
            }
        });
    }); });
    function setup(input) {
        var mockLogger = (0, jest_mock_extended_1.mock)();
        var mockGetSession = jest.fn();
        var mockUserTracker = (0, jest_mock_extended_1.mock)();
        var mockApiUrlService = (0, jest_mock_extended_1.mock)();
        var mockConfig = (0, jest_mock_extended_1.mock)();
        var mockProxy = {
            once: jest.fn().mockReturnThis(),
            web: jest.fn()
        };
        var mockHttpProxy = {
            createProxyServer: jest.fn().mockReturnValue(mockProxy)
        };
        mockProxy.once.mockImplementation(function (event, callback) {
            if (event === "proxyRes") {
                setTimeout(function () { return callback(); }, 0);
            }
            return mockProxy;
        });
        mockGetSession.mockResolvedValue(input.session || null);
        mockApiUrlService.getBaseApiUrlFor.mockReturnValue("http://api.example.com");
        mockConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID = "mainnet";
        var req = (0, jest_mock_extended_1.mock)({
            method: "GET",
            url: input.url,
            headers: input.headers,
            socket: __assign({ remoteAddress: "127.0.0.1" }, input.socket)
        });
        var res = (0, jest_mock_extended_1.mock)();
        req[defineApiHandler_1.REQ_SERVICES_KEY] = __assign(__assign({}, server_di_container_service_1.services), { logger: mockLogger, getSession: mockGetSession, httpProxy: mockHttpProxy, apiUrlService: mockApiUrlService, config: mockConfig, userTracker: mockUserTracker });
        var handlerPromise = (0, ____path_1.default)(req, res);
        return {
            req: req,
            res: res,
            mockLogger: mockLogger,
            mockProxy: mockProxy,
            handlerPromise: handlerPromise
        };
    }
});
