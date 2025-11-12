"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var next_seo_1 = require("next-seo");
var Title_1 = require("@src/components/shared/Title");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../components/layout/Layout");
var FourOhFour = function () {
    return (<Layout_1.default>
      <next_seo_1.NextSeo title="Page not found"/>

      <div className="mt-10 text-center">
        <Title_1.Title className="mb-2">404</Title_1.Title>
        <h3 className="text-2xl">Page not found.</h3>

        <div className="pt-6">
          <link_1.default href={urlUtils_1.UrlService.home()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }), "inline-flex items-center")}>
            <iconoir_react_1.ArrowLeft className="mr-4"/>
            Go to homepage
          </link_1.default>
        </div>
      </div>
    </Layout_1.default>);
};
exports.default = FourOhFour;
