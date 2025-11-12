"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var head_1 = require("next/head");
var script_1 = require("next/script");
var GetStartedStepper_1 = require("@src/components/get-started/GetStartedStepper");
var Layout_1 = require("@src/components/layout/Layout");
var CustomNextSeo_1 = require("@src/components/shared/CustomNextSeo");
var urlUtils_1 = require("@src/utils/urlUtils");
var GetStarted = function () {
    return (<Layout_1.default>
      <CustomNextSeo_1.CustomNextSeo title="Get started with Akash Console" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.getStarted())} description="Follow the steps to get started with Akash Console!"/>

      <components_1.Card>
        <components_1.CardHeader>
          <components_1.CardTitle>Get started with Akash Console!</components_1.CardTitle>
        </components_1.CardHeader>
        <components_1.CardContent>
          <GetStartedStepper_1.GetStartedStepper />
        </components_1.CardContent>
      </components_1.Card>

      <head_1.default>
        <link rel="stylesheet" href="https://unpkg.com/@leapwallet/elements@1/dist/style.css"/>
      </head_1.default>
      <script_1.default defer async src="https://unpkg.com/@leapwallet/elements@1/dist/umd/main.js"/>
    </Layout_1.default>);
};
exports.default = GetStarted;
