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
exports.getServerSideProps = void 0;
var zod_1 = require("zod");
var EditNotificationChannelPage_1 = require("@src/components/alerts/EditNotificationChannelPage");
var defineServerSideProps_1 = require("@src/lib/nextjs/defineServerSideProps/defineServerSideProps");
var pageGuards_1 = require("@src/lib/nextjs/pageGuards/pageGuards");
exports.default = EditNotificationChannelPage_1.EditNotificationChannelPage;
var NOT_FOUND = {
    notFound: true
};
exports.getServerSideProps = (0, defineServerSideProps_1.defineServerSideProps)({
    route: "/alerts/notification-channels/[id]",
    schema: zod_1.z.object({
        params: zod_1.z.object({
            id: zod_1.z.string().uuid()
        })
    }),
    if: function (ctx) { return __awaiter(void 0, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, pageGuards_1.isAuthenticated)(ctx)];
            case 1:
                _a = (_b.sent());
                if (!_a) return [3 /*break*/, 3];
                return [4 /*yield*/, (0, pageGuards_1.isFeatureEnabled)("alerts", ctx)];
            case 2:
                _a = (_b.sent());
                _b.label = 3;
            case 3: return [2 /*return*/, _a];
        }
    }); }); },
    handler: function (context) { return __awaiter(void 0, void 0, void 0, function () {
        var session, notificationChannel;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, context.services.getSession(context.req, context.res)];
                case 1:
                    session = (_c.sent());
                    return [4 /*yield*/, context.services.notificationsApi.v1.getNotificationChannel({
                            parameters: {
                                path: {
                                    id: context.params.id
                                },
                                header: {
                                    Authorization: "Bearer ".concat(session.accessToken)
                                }
                            }
                        })];
                case 2:
                    notificationChannel = _c.sent();
                    if (!((_a = notificationChannel.data) === null || _a === void 0 ? void 0 : _a.data)) {
                        return [2 /*return*/, NOT_FOUND];
                    }
                    return [2 /*return*/, {
                            props: {
                                notificationChannel: (_b = notificationChannel.data) === null || _b === void 0 ? void 0 : _b.data
                            }
                        }];
            }
        });
    }); }
});
