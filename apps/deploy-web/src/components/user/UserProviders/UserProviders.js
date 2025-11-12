"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProviders = void 0;
var react_1 = require("react");
var client_1 = require("@auth0/nextjs-auth0/client");
var UserInitLoader_1 = require("@src/components/user/UserInitLoader");
var AnonymousUserProvider_1 = require("@src/context/AnonymousUserProvider/AnonymousUserProvider");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useUser_1 = require("@src/hooks/useUser");
/**
 * UserProviders is a client only component because it uses the UserProvider
 * which is a client only component.
 */
var UserProviders = function (_a) {
    var children = _a.children;
    var _b = (0, ServicesProvider_1.useServices)(), internalApiHttpClient = _b.internalApiHttpClient, appConfig = _b.appConfig;
    return appConfig.NEXT_PUBLIC_BILLING_ENABLED ? (<client_1.UserProvider fetcher={function (url) { return internalApiHttpClient.get(url).then(function (response) { return response.data; }); }}>
      <UserInitLoader_1.UserInitLoader>
        <AnonymousUserProvider_1.AnonymousUserProvider>
          <UserTracker>{children}</UserTracker>
        </AnonymousUserProvider_1.AnonymousUserProvider>
      </UserInitLoader_1.UserInitLoader>
    </client_1.UserProvider>) : (<client_1.UserProvider>
      <UserTracker>{children}</UserTracker>
    </client_1.UserProvider>);
};
exports.UserProviders = UserProviders;
var UserTracker = function (_a) {
    var children = _a.children;
    var user = (0, useUser_1.useUser)().user;
    var _b = (0, ServicesProvider_1.useServices)(), analyticsService = _b.analyticsService, userTracker = _b.userTracker;
    (0, react_1.useEffect)(function () {
        userTracker.track(user);
        if (user === null || user === void 0 ? void 0 : user.id) {
            analyticsService.identify({
                id: user.id,
                anonymous: !user.userId,
                emailVerified: !!user.emailVerified
            });
        }
    }, [user, analyticsService, userTracker]);
    return <>{children}</>;
};
