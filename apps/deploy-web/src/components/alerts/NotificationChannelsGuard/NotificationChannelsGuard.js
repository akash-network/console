"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationChannelsGuard = exports.NotificationChannelsGuardView = exports.COMPONENTS = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var link_1 = require("next/link");
var AccountEmailChannelCreator_1 = require("@src/components/alerts/AccountEmailChannelCreator/AccountEmailChannelCreator");
var NotificationChannelsListContainer_1 = require("@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer");
var LoadingBlocker_1 = require("@src/components/layout/LoadingBlocker/LoadingBlocker");
var urlUtils_1 = require("@src/utils/urlUtils");
exports.COMPONENTS = {
    AccountEmailChannelCreator: AccountEmailChannelCreator_1.AccountEmailChannelCreator
};
var NotificationChannelsGuardView = function (_a) {
    var data = _a.data, isFetched = _a.isFetched, children = _a.children, _b = _a.components, c = _b === void 0 ? exports.COMPONENTS : _b;
    return (<LoadingBlocker_1.LoadingBlocker isLoading={!isFetched} testId="loading-blocker">
      {isFetched && data.length ? (children) : (<div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="mb-4">To start using alerting you need to add at least one notification channel</div>
          <div className="flex gap-4">
            <link_1.default href={urlUtils_1.UrlService.newNotificationChannel()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }), "inline-flex items-center")}>
              <span>Add notification channel</span>
            </link_1.default>
            <c.AccountEmailChannelCreator />
          </div>
        </div>)}
    </LoadingBlocker_1.LoadingBlocker>);
};
exports.NotificationChannelsGuardView = NotificationChannelsGuardView;
var NotificationChannelsGuard = function (_a) {
    var children = _a.children;
    return (<NotificationChannelsListContainer_1.NotificationChannelsListContainer>
      {function (notificationChannelList) { return (<exports.NotificationChannelsGuardView data={notificationChannelList.data} isFetched={notificationChannelList.isFetched}>
          {children(notificationChannelList)}
        </exports.NotificationChannelsGuardView>); }}
    </NotificationChannelsListContainer_1.NotificationChannelsListContainer>);
};
exports.NotificationChannelsGuard = NotificationChannelsGuard;
