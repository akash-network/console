"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingPage = void 0;
var react_1 = require("react");
var next_seo_1 = require("next-seo");
var BillingContainer_1 = require("@src/components/billing-usage/BillingContainer/BillingContainer");
var BillingUsageLayout_1 = require("@src/components/billing-usage/BillingUsageLayout");
var BillingView_1 = require("@src/components/billing-usage/BillingView/BillingView");
var Layout_1 = require("@src/components/layout/Layout");
var BillingPage = function () {
    return (<Layout_1.default containerClassName="flex h-full flex-col justify-between">
      <next_seo_1.NextSeo title="Billing"/>
      <BillingUsageLayout_1.BillingUsageLayout page={BillingUsageLayout_1.BillingUsageTabs.BILLING}>
        <BillingContainer_1.BillingContainer>{function (props) { return <BillingView_1.BillingView {...props}/>; }}</BillingContainer_1.BillingContainer>
      </BillingUsageLayout_1.BillingUsageLayout>
    </Layout_1.default>);
};
exports.BillingPage = BillingPage;
