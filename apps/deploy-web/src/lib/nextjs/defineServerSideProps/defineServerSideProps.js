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
exports.defineServerSideProps = defineServerSideProps;
var http_sdk_1 = require("@akashnetwork/http-sdk");
var nextjs_1 = require("@sentry/nextjs");
var server_di_container_service_1 = require("@src/services/app-di-container/server-di-container.service");
var requestExecutionContext_1 = require("../requestExecutionContext");
var NOT_FOUND = {
    notFound: true
};
function defineServerSideProps(options) {
    var _this = this;
    return (0, nextjs_1.wrapGetServerSidePropsWithSentry)(function (context) { return __awaiter(_this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, requestExecutionContext_1.requestExecutionContext.run((0, requestExecutionContext_1.createRequestExecutionContext)(context.req), function () { return __awaiter(_this, void 0, void 0, function () {
                    var requestServices, session, validatedContext, newContext, result, error_1;
                    var _a, _b, _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                requestServices = "services" in context ? context.services : server_di_container_service_1.services;
                                return [4 /*yield*/, requestServices.getSession(context.req, context.res)];
                            case 1:
                                session = _d.sent();
                                requestServices.userTracker.track(session === null || session === void 0 ? void 0 : session.user);
                                validatedContext = options.schema ? options.schema.safeParse(context) : undefined;
                                if (validatedContext && !validatedContext.success) {
                                    requestServices.logger.warn({ message: "Invalid context for route ".concat(options.route), error: validatedContext.error });
                                    return [2 /*return*/, NOT_FOUND];
                                }
                                newContext = __assign(__assign(__assign({ services: requestServices }, context), validatedContext === null || validatedContext === void 0 ? void 0 : validatedContext.data), { session: session });
                                return [4 /*yield*/, ((_a = options.if) === null || _a === void 0 ? void 0 : _a.call(options, newContext))];
                            case 2:
                                result = _d.sent();
                                if (typeof result === "object" && result)
                                    return [2 /*return*/, result];
                                if (result === false)
                                    return [2 /*return*/, NOT_FOUND];
                                if (!options.handler) return [3 /*break*/, 6];
                                _d.label = 3;
                            case 3:
                                _d.trys.push([3, 5, , 6]);
                                return [4 /*yield*/, options.handler(newContext)];
                            case 4: return [2 /*return*/, _d.sent()];
                            case 5:
                                error_1 = _d.sent();
                                if ((0, http_sdk_1.isHttpError)(error_1) && (((_b = error_1.response) === null || _b === void 0 ? void 0 : _b.status) === 404 || ((_c = error_1.response) === null || _c === void 0 ? void 0 : _c.status) === 400)) {
                                    requestServices.logger.warn({
                                        message: "Error in handler for route ".concat(options.route),
                                        error: error_1
                                    });
                                    return [2 /*return*/, NOT_FOUND];
                                }
                                throw error_1;
                            case 6: return [2 /*return*/, { props: {} }];
                        }
                    });
                }); })];
        });
    }); }, options.route);
}
