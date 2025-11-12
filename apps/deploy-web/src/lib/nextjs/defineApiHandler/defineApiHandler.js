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
exports.REQ_SERVICES_KEY = void 0;
exports.defineApiHandler = defineApiHandler;
var nextjs_1 = require("@sentry/nextjs");
var server_di_container_service_1 = require("@src/services/app-di-container/server-di-container.service");
var requestExecutionContext_1 = require("../requestExecutionContext");
/** @internal use for testing only */
exports.REQ_SERVICES_KEY = Symbol("REQ_SERVICES_KEY");
function defineApiHandler(options) {
    var _this = this;
    return (0, nextjs_1.wrapApiHandlerWithSentry)((function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var requestServices, session, context, validatedContext;
        var _this = this;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    requestServices = req[exports.REQ_SERVICES_KEY] || server_di_container_service_1.services;
                    return [4 /*yield*/, requestServices.getSession(req, res)];
                case 1:
                    session = _c.sent();
                    requestServices.userTracker.track(session === null || session === void 0 ? void 0 : session.user);
                    context = {
                        req: req,
                        res: res,
                        services: requestServices,
                        query: req.query,
                        body: req.body,
                        session: session
                    };
                    if (options.schema) {
                        validatedContext = options.schema.safeParse(context);
                        if (!validatedContext.success) {
                            requestServices.logger.warn({ error: validatedContext.error, event: "INVALID_API_REQUEST" });
                            res.status(400);
                            res.json({
                                errors: validatedContext.error.errors.map(function (error) { return ({
                                    message: error.message,
                                    path: error.path
                                }); })
                            });
                            return [2 /*return*/];
                        }
                        context.query = (_a = validatedContext.data.query) !== null && _a !== void 0 ? _a : context.query;
                        context.body = (_b = validatedContext.data.body) !== null && _b !== void 0 ? _b : context.body;
                    }
                    return [4 /*yield*/, requestExecutionContext_1.requestExecutionContext.run((0, requestExecutionContext_1.createRequestExecutionContext)(req), function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, options.handler(context)];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        }); }); })];
                case 2: return [2 /*return*/, _c.sent()];
            }
        });
    }); }), options.route);
}
