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
var nextjs_auth0_1 = require("@auth0/nextjs-auth0");
var zod_1 = require("zod");
var UserTemplate_1 = require("@src/components/templates/UserTemplate");
var defineServerSideProps_1 = require("@src/lib/nextjs/defineServerSideProps/defineServerSideProps");
var TemplatePage = function (_a) {
    var id = _a.id, template = _a.template;
    return <UserTemplate_1.UserTemplate id={id} template={template}/>;
};
exports.default = TemplatePage;
exports.getServerSideProps = (0, defineServerSideProps_1.defineServerSideProps)({
    route: "/template/[id]",
    schema: zod_1.z.object({
        params: zod_1.z.object({
            id: zod_1.z.string()
        })
    }),
    handler: function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var session, config, response;
            var params = _b.params, services = _b.services, req = _b.req, res = _b.res;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, (0, nextjs_auth0_1.getSession)(req, res)];
                    case 1:
                        session = _c.sent();
                        config = {};
                        if (session) {
                            config = {
                                headers: {
                                    Authorization: session ? "Bearer ".concat(session.accessToken) : ""
                                }
                            };
                        }
                        return [4 /*yield*/, services.consoleApiHttpClient.get("".concat(services.apiUrlService.getBaseApiUrlFor(services.config.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID), "/user/template/").concat(params.id), config)];
                    case 2:
                        response = _c.sent();
                        return [2 /*return*/, {
                                props: {
                                    id: params.id,
                                    template: response.data
                                }
                            }];
                }
            });
        });
    }
});
