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
var zod_1 = require("zod");
var defineApiHandler_1 = require("@src/lib/nextjs/defineApiHandler/defineApiHandler");
var github_service_1 = require("@src/services/auth/github.service");
exports.default = (0, defineApiHandler_1.defineApiHandler)({
    route: "/api/github/authenticate",
    schema: zod_1.z.object({
        body: zod_1.z.object({
            code: zod_1.z.string()
        })
    }),
    handler: function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var _c, NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI, gitHubAuth, accessToken;
            var body = _b.body, res = _b.res, services = _b.services;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _c = services.config, NEXT_PUBLIC_GITHUB_CLIENT_ID = _c.NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET = _c.GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI = _c.NEXT_PUBLIC_REDIRECT_URI;
                        gitHubAuth = new github_service_1.default(NEXT_PUBLIC_GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, NEXT_PUBLIC_REDIRECT_URI, services.externalApiHttpClient);
                        return [4 /*yield*/, gitHubAuth.exchangeAuthorizationCodeForToken(body.code)];
                    case 1:
                        accessToken = _d.sent();
                        res.status(200).json({ accessToken: accessToken });
                        return [2 /*return*/];
                }
            });
        });
    }
});
