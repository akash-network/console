"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditNotificationChannelPage = void 0;
var react_1 = require("react");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var NotificationChannelEditContainer_1 = require("@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer");
var NotificationChannelForm_1 = require("@src/components/alerts/NotificationChannelForm/NotificationChannelForm");
var Layout_1 = require("@src/components/layout/Layout");
var Title_1 = require("@src/components/shared/Title");
var useBackNav_1 = require("@src/hooks/useBackNav");
var useNavigationGuard_1 = require("@src/hooks/useNavigationGuard/useNavigationGuard");
var urlUtils_1 = require("@src/utils/urlUtils");
var EditNotificationChannelPage = function (_a) {
    var notificationChannel = _a.notificationChannel;
    var goBack = (0, useBackNav_1.useBackNav)(urlUtils_1.UrlService.notificationChannels());
    var navGuard = (0, useNavigationGuard_1.useNavigationGuard)();
    return (<Layout_1.default containerClassName="flex h-full flex-col">
      <next_seo_1.NextSeo title="Edit Notification Channel"/>
      <div className="mt-4 flex flex-wrap items-center py-4">
        <link_1.default href="." type="button" className="p-2">
          <iconoir_react_1.NavArrowLeft />
        </link_1.default>
        <Title_1.Title>Edit Notification Channel</Title_1.Title>
      </div>
      <NotificationChannelEditContainer_1.NotificationChannelEditContainer id={notificationChannel.id} onEditSuccess={function () {
            navGuard.toggle({ hasChanges: false });
            goBack();
        }}>
        {function (props) { return (<NotificationChannelForm_1.NotificationChannelForm initialValues={{
                name: notificationChannel.name,
                emails: notificationChannel.config.addresses
            }} isLoading={props.isLoading} onSubmit={props.onEdit} onCancel={goBack} onStateChange={navGuard.toggle}/>); }}
      </NotificationChannelEditContainer_1.NotificationChannelEditContainer>
    </Layout_1.default>);
};
exports.EditNotificationChannelPage = EditNotificationChannelPage;
