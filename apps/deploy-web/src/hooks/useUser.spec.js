"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var context_1 = require("@akashnetwork/ui/context");
var client_1 = require("@auth0/nextjs-auth0/client");
var jest_mock_extended_1 = require("jest-mock-extended");
var AnonymousUserProvider_1 = require("@src/context/AnonymousUserProvider/AnonymousUserProvider");
var useUser_1 = require("./useUser");
var user_1 = require("@tests/seeders/user");
var query_client_1 = require("@tests/unit/query-client");
describe("useIsRegisteredUser", function () {
    it("can visit when user has userId", function () {
        var result = setup({
            customUser: (0, user_1.buildUser)({ userId: "12345" })
        }).result;
        expect(result.current).toEqual({
            isLoading: false,
            canVisit: true
        });
    });
    it("cannot visit when userId is falsy", function () {
        var result = setup({
            customUser: (0, user_1.buildUser)({ userId: "" })
        }).result;
        expect(result.current).toEqual({
            isLoading: false,
            canVisit: false
        });
    });
    function setup(_a) {
        var _b = _a === void 0 ? {} : _a, customUser = _b.customUser, anonymousUser = _b.anonymousUser;
        (0, jest_mock_extended_1.mock)(function () { return ({
            user: customUser || (0, user_1.buildUser)(),
            isLoading: false,
            error: undefined,
            checkSession: (0, jest_mock_extended_1.mock)()
        }); });
        (0, jest_mock_extended_1.mock)(function () { return ({
            user: anonymousUser || (0, user_1.buildAnonymousUser)(),
            isLoading: false
        }); });
        jest.clearAllMocks();
        jest.restoreAllMocks();
        var mockUserHttpService = (0, jest_mock_extended_1.mock)({
            getOrCreateAnonymousUser: jest.fn().mockResolvedValue(anonymousUser)
        });
        return (0, query_client_1.setupQuery)(function () { return (0, useUser_1.useIsRegisteredUser)(); }, {
            services: {
                user: function () { return mockUserHttpService; }
            },
            wrapper: function (_a) {
                var children = _a.children;
                return (<context_1.CustomSnackbarProvider>
          <client_1.UserProvider user={customUser}>
            <AnonymousUserProvider_1.AnonymousUserProvider>{children}</AnonymousUserProvider_1.AnonymousUserProvider>
          </client_1.UserProvider>
        </context_1.CustomSnackbarProvider>);
            }
        });
    }
});
