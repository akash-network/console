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
var jest_js_1 = require("next/jest.js");
var createJestConfig = (0, jest_js_1.default)({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: "./"
});
var common = {
    moduleNameMapper: {
        "^@src(.*)$": "<rootDir>/src/$1",
        "^@tests(.*)$": "<rootDir>/tests/$1"
    },
    transform: {
        "\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json" }]
    }
};
var styleMockPath = "<rootDir>/../../node_modules/next/dist/build/jest/__mocks__/styleMock.js";
var getConfig = createJestConfig(__assign(__assign({}, common), { testEnvironment: "jsdom", testMatch: ["<rootDir>/src/**/*.spec.{tsx,ts}"], testPathIgnorePatterns: ["/lib/nextjs/"], moduleNameMapper: __assign(__assign({}, common.moduleNameMapper), { "@interchain-ui\\/react\\/styles$": styleMockPath, "@interchain-ui\\/react\\/globalStyles$": styleMockPath, "^next-navigation-guard$": "<rootDir>/../../node_modules/next-navigation-guard/dist/index.js" }), setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"] }));
exports.default = (function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _b = {
                    rootDir: ".",
                    collectCoverageFrom: ["<rootDir>/src/**/*.{js,ts,tsx}"]
                };
                _a = [{ coveragePathIgnorePatterns: ["/lib/nextjs/", "/tests/"], displayName: "unit" }];
                return [4 /*yield*/, getConfig()];
            case 1: return [2 /*return*/, (_b.projects = [
                    __assign.apply(void 0, _a.concat([(_c.sent())])),
                    __assign(__assign({ coveragePathIgnorePatterns: ["/lib/nextjs/setup-node-tests\\.ts$", "/tests/", "\\.spec\\.tsx?$"], displayName: "unit-node", testEnvironment: "node", testMatch: ["<rootDir>/src/lib/nextjs/**/*.spec.{tsx,ts}"] }, common), { moduleNameMapper: __assign({}, common.moduleNameMapper), setupFilesAfterEnv: ["<rootDir>/src/lib/nextjs/setup-node-tests.ts"] })
                ],
                    _b)];
        }
    });
}); });
