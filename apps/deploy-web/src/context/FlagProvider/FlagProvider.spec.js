"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var FlagProvider_1 = require("./FlagProvider");
var react_2 = require("@testing-library/react");
var mocks_1 = require("@tests/unit/mocks");
describe(FlagProvider_1.UserAwareFlagProvider.name, function () {
    it("passes userId from useUser to the custom FlagProvider", function () {
        var testUser = { id: "my-user-id" };
        var customFlagProvider = function (_a) {
            var config = _a.config, children = _a.children;
            return (<div data-testid="flag-provider">
        {config.context.userId}
        {children}
      </div>);
        };
        var customUseUser = function () { return ({
            user: testUser,
            isLoading: false
        }); };
        var getByTestId = (0, react_2.render)(<FlagProvider_1.UserAwareFlagProvider components={{ FlagProvider: customFlagProvider, useUser: customUseUser, WaitForFeatureFlags: mocks_1.ComponentMock }}>
        <div data-testid="child"/>
      </FlagProvider_1.UserAwareFlagProvider>).getByTestId;
        expect(getByTestId("flag-provider").textContent).toContain("my-user-id");
        expect(getByTestId("child")).toBeInTheDocument();
    });
});
