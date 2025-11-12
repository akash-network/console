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
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var Sentry = require("@sentry/nextjs");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var Title_1 = require("@src/components/shared/Title");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../components/layout/Layout");
var Error = function (_a) {
    var statusCode = _a.statusCode;
    return (<Layout_1.default>
      <next_seo_1.NextSeo title="Error"/>

      <div className="text-center">
        <h1>{statusCode}</h1>

        <Title_1.Title>Error occured.</Title_1.Title>

        <p>{statusCode ? "An error ".concat(statusCode, " occurred on server") : "An error occurred on client"}</p>

        <div className="pt-4">
          <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }), "inline-flex items-center")} href={urlUtils_1.UrlService.home()}>
            Go to homepage&nbsp;
            <iconoir_react_1.NavArrowRight className="text-sm"/>
          </link_1.default>
        </div>
      </div>
    </Layout_1.default>);
};
Error.getInitialProps = function (context) { return __awaiter(void 0, void 0, void 0, function () {
    var res, err, statusCode;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                res = context.res, err = context.err;
                statusCode = res ? res.statusCode : err ? err.statusCode || 400 : 404;
                // In case this is running in a serverless function, await this in order to give Sentry
                // time to send the error before the lambda exits
                return [4 /*yield*/, Sentry.captureUnderscoreErrorException(context)];
            case 1:
                // In case this is running in a serverless function, await this in order to give Sentry
                // time to send the error before the lambda exits
                _a.sent();
                // This will contain the status code of the response
                // return Error.getInitialProps({ statusCode });
                return [2 /*return*/, { statusCode: statusCode }];
        }
    });
}); };
exports.default = Error;
