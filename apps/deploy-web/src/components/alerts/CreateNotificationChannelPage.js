"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNotificationChannelPage = void 0;
var react_1 = require("react");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var NotificationChannelCreateContainer_1 = require("@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer");
var NotificationChannelForm_1 = require("@src/components/alerts/NotificationChannelForm/NotificationChannelForm");
var Layout_1 = require("@src/components/layout/Layout");
var Title_1 = require("@src/components/shared/Title");
var useBackNav_1 = require("@src/hooks/useBackNav");
var useNavigationGuard_1 = require("@src/hooks/useNavigationGuard/useNavigationGuard");
var urlUtils_1 = require("@src/utils/urlUtils");
var CreateNotificationChannelPage = function () {
    var goBack = (0, useBackNav_1.useBackNav)(urlUtils_1.UrlService.notificationChannels());
    var navGuard = (0, useNavigationGuard_1.useNavigationGuard)();
    return (<Layout_1.default containerClassName="flex h-full flex-col">
      <next_seo_1.NextSeo title="Create Notification Channel"/>
      <div className="mt-4 flex flex-wrap items-center py-4">
        <link_1.default href="." type="button" className="p-2">
          <iconoir_react_1.NavArrowLeft />
        </link_1.default>
        <Title_1.Title>Create Notification Channel</Title_1.Title>
      </div>
      <NotificationChannelCreateContainer_1.NotificationChannelCreateContainer onCreate={function () {
            navGuard.toggle({ hasChanges: false });
            goBack();
        }}>
        {function (props) { return <NotificationChannelForm_1.NotificationChannelForm isLoading={props.isLoading} onSubmit={props.create} onCancel={goBack} onStateChange={navGuard.toggle}/>; }}
      </NotificationChannelCreateContainer_1.NotificationChannelCreateContainer>
    </Layout_1.default>);
};
exports.CreateNotificationChannelPage = CreateNotificationChannelPage;
