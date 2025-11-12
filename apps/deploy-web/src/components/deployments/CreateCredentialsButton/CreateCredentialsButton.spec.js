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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var CreateCredentialsButton_1 = require("./CreateCredentialsButton");
var react_1 = require("@testing-library/react");
describe(CreateCredentialsButton_1.CreateCredentialsButton.name, function () {
    describe("mtls credentials", function () {
        it("renders create certificate button when credentials are missing", function () {
            setup({
                providerCredentials: {
                    details: {
                        type: "mtls",
                        value: null,
                        isExpired: false,
                        usable: false
                    }
                }
            });
            expect(react_1.screen.getByRole("button", { name: /create certificate/i })).toBeInTheDocument();
            expect(react_1.screen.getByRole("alert")).toHaveTextContent(/You need to create a certificate to view deployment details./);
        });
        it("renders regenerate certificate button when credentials are expired", function () {
            setup({
                providerCredentials: {
                    details: {
                        type: "mtls",
                        value: { cert: "certPem", key: "keyPem" },
                        isExpired: true,
                        usable: false
                    }
                }
            });
            expect(react_1.screen.getByRole("button", { name: /regenerate certificate/i })).toBeInTheDocument();
            expect(react_1.screen.getByRole("alert")).toHaveTextContent(/Your certificate has expired. Please create a new one./);
        });
        it("renders nothing when credentials has type `mtls` and is usable", function () {
            setup({
                providerCredentials: {
                    details: {
                        type: "mtls",
                        value: { cert: "certPem", key: "keyPem" },
                        isExpired: false,
                        usable: true
                    }
                }
            });
            expect(react_1.screen.queryByRole("button", { name: /create certificate/i })).not.toBeInTheDocument();
            expect(react_1.screen.queryByRole("alert")).not.toBeInTheDocument();
        });
        it("shows spinner when generating credentials for `mtls`", function () {
            var generate = jest.fn(function () { return new Promise(function () { }); });
            setup({
                providerCredentials: {
                    generate: generate,
                    details: {
                        type: "mtls",
                        value: null,
                        isExpired: false,
                        usable: false
                    }
                }
            });
            var button = react_1.screen.getByRole("button", { name: /create certificate/i });
            react_1.fireEvent.click(button);
            expect(generate).toHaveBeenCalled();
            expect(react_1.screen.getByRole("button")).toBeDisabled();
            expect(react_1.screen.getByRole("status")).toBeInTheDocument();
        });
    });
    describe("jwt credentials", function () {
        it("renders generate token button when credentials are missing", function () {
            setup({
                providerCredentials: {
                    details: {
                        type: "jwt",
                        value: null,
                        isExpired: false,
                        usable: false
                    }
                }
            });
            expect(react_1.screen.getByRole("button", { name: /generate token/i })).toBeInTheDocument();
            expect(react_1.screen.getByRole("alert")).toHaveTextContent(/You need to generate a token to view deployment details./);
        });
        it("renders regenerate token button when credentials are expired", function () {
            setup({
                providerCredentials: {
                    details: {
                        type: "jwt",
                        value: "some-token",
                        isExpired: true,
                        usable: false
                    }
                }
            });
            expect(react_1.screen.getByRole("button", { name: /regenerate token/i })).toBeInTheDocument();
            expect(react_1.screen.getByRole("alert")).toHaveTextContent(/Your token has expired. Please generate a new one./);
        });
        it("renders nothing when credentials has type `jwt` and is usable", function () {
            setup({
                providerCredentials: {
                    details: {
                        type: "jwt",
                        value: "some-token",
                        isExpired: false,
                        usable: true
                    }
                }
            });
            expect(react_1.screen.queryByRole("button", { name: /generate token/i })).not.toBeInTheDocument();
            expect(react_1.screen.queryByRole("alert")).not.toBeInTheDocument();
        });
        it("shows spinner when generating credentials for `jwt`", function () {
            var generate = jest.fn(function () { return new Promise(function () { }); });
            setup({
                providerCredentials: {
                    generate: generate,
                    details: {
                        type: "jwt",
                        value: null,
                        isExpired: false,
                        usable: false
                    }
                }
            });
            var button = react_1.screen.getByRole("button", { name: /generate token/i });
            react_1.fireEvent.click(button);
            expect(generate).toHaveBeenCalled();
            expect(react_1.screen.getByRole("button")).toBeDisabled();
            expect(react_1.screen.getByRole("status")).toBeInTheDocument();
        });
    });
    function setup(input) {
        var _a = input !== null && input !== void 0 ? input : {}, providerCredentials = _a.providerCredentials, props = __rest(_a, ["providerCredentials"]);
        return (0, react_1.render)(<CreateCredentialsButton_1.CreateCredentialsButton {...props} dependencies={__assign(__assign({}, CreateCredentialsButton_1.DEPENDENCIES), { useProviderCredentials: function () {
                    var _a, _b;
                    return ({
                        generate: (_a = providerCredentials === null || providerCredentials === void 0 ? void 0 : providerCredentials.generate) !== null && _a !== void 0 ? _a : jest.fn(function () { return Promise.resolve(); }),
                        details: (_b = providerCredentials === null || providerCredentials === void 0 ? void 0 : providerCredentials.details) !== null && _b !== void 0 ? _b : {
                            type: "mtls",
                            value: { cert: "certPem", key: "keyPem" },
                            isExpired: true,
                            usable: false
                        }
                    });
                } })}/>);
    }
});
