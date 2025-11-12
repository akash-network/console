"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertsPage = void 0;
var react_1 = require("react");
var next_seo_1 = require("next-seo");
var AlertsLayout_1 = require("@src/components/alerts/AlertsLayout");
var AlertsListContainer_1 = require("@src/components/alerts/AlertsListContainer/AlertsListContainer");
var AlertsListView_1 = require("@src/components/alerts/AlertsListView/AlertsListView");
var Layout_1 = require("@src/components/layout/Layout");
var AlertsPage = function () {
    return (<Layout_1.default containerClassName="flex h-full flex-col justify-between">
      <next_seo_1.NextSeo title="Configured Alerts"/>
      <AlertsLayout_1.AlertsLayout page={AlertsLayout_1.AlertTabs.ALERTS} title="Configured Alerts">
        <AlertsListContainer_1.AlertsListContainer>{function (props) { return <AlertsListView_1.AlertsListView {...props}/>; }}</AlertsListContainer_1.AlertsListContainer>
      </AlertsLayout_1.AlertsLayout>
    </Layout_1.default>);
};
exports.AlertsPage = AlertsPage;
