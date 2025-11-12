"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsagePage = void 0;
var react_1 = require("react");
var next_seo_1 = require("next-seo");
var BillingUsageLayout_1 = require("@src/components/billing-usage/BillingUsageLayout");
var UsageContainer_1 = require("@src/components/billing-usage/UsageContainer/UsageContainer");
var UsageView_1 = require("@src/components/billing-usage/UsageView/UsageView");
var Layout_1 = require("@src/components/layout/Layout");
var UsagePage = function () {
    return (<Layout_1.default containerClassName="flex h-full flex-col justify-between">
      <next_seo_1.NextSeo title="Usage"/>
      <BillingUsageLayout_1.BillingUsageLayout page={BillingUsageLayout_1.BillingUsageTabs.USAGE}>
        <UsageContainer_1.UsageContainer>{function (props) { return <UsageView_1.UsageView {...props}/>; }}</UsageContainer_1.UsageContainer>
      </BillingUsageLayout_1.BillingUsageLayout>
    </Layout_1.default>);
};
exports.UsagePage = UsagePage;
