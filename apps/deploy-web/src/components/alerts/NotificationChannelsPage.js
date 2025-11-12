"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationChannelsPage = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var AlertsLayout_1 = require("@src/components/alerts/AlertsLayout");
var NotificationChannelsListContainer_1 = require("@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer");
var NotificationChannelsListView_1 = require("@src/components/alerts/NotificationChannelsListView/NotificationChannelsListView");
var Layout_1 = require("@src/components/layout/Layout");
var NotificationChannelsPage = function () {
    return (<Layout_1.default containerClassName="flex h-full flex-col justify-between">
      <next_seo_1.NextSeo title="Alerts"/>
      <AlertsLayout_1.AlertsLayout page={AlertsLayout_1.AlertTabs.NOTIFICATION_CHANNELS} title="Notification Channels" headerActions={<div className="md:ml-4">
            <link_1.default href="notification-channels/new" color="secondary" type="button" className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }))}>
              <iconoir_react_1.Plus />
              &nbsp;Create
            </link_1.default>
          </div>}>
        <NotificationChannelsListContainer_1.NotificationChannelsListContainer>{function (props) { return <NotificationChannelsListView_1.NotificationChannelsListView {...props}/>; }}</NotificationChannelsListContainer_1.NotificationChannelsListContainer>
      </AlertsLayout_1.AlertsLayout>
    </Layout_1.default>);
};
exports.NotificationChannelsPage = NotificationChannelsPage;
