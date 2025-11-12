"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jest_mock_extended_1 = require("jest-mock-extended");
var auth_config_1 = require("@src/config/auth.config");
var interceptors_1 = require("./interceptors");
describe("Auth Axios Interceptors", function () {
    describe("withAnonymousUserToken", function () {
        it("adds authorization header when token exists in localStorage", function () {
            var token = "test-anonymous-token";
            localStorage.setItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY, token);
            var config = (0, jest_mock_extended_1.mockDeep)();
            (0, interceptors_1.withAnonymousUserToken)(config);
            expect(config.headers.set).toHaveBeenCalledWith("authorization", "Bearer ".concat(token));
            localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
            config = (0, jest_mock_extended_1.mockDeep)();
            (0, interceptors_1.withAnonymousUserToken)(config);
            expect(config.headers.set).not.toHaveBeenCalled();
        });
    });
    describe("withUserToken", function () {
        it("adds authorization header when token exists in localStorage", function () {
            var token = "test-user-token";
            localStorage.setItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY, token);
            var config = (0, jest_mock_extended_1.mockDeep)();
            (0, interceptors_1.withUserToken)(config);
            expect(config.headers.set).toHaveBeenCalledWith("authorization", "Bearer ".concat(token));
        });
        it("should set baseURL to proxy when token does not exist", function () {
            localStorage.removeItem(auth_config_1.ANONYMOUS_USER_TOKEN_KEY);
            var config = {
                baseURL: "/",
                headers: (0, jest_mock_extended_1.mock)()
            };
            (0, interceptors_1.withUserToken)(config);
            expect(config.baseURL).toBe("/api/proxy");
            expect(config.headers.set).not.toHaveBeenCalled();
        });
    });
});
