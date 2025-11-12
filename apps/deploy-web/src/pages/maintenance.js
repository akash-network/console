"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var iconoir_react_1 = require("iconoir-react");
var next_seo_1 = require("next-seo");
var Title_1 = require("@src/components/shared/Title");
var Maintenance = function () {
    return (<div>
      <next_seo_1.NextSeo title="Maintenance"/>

      <div className="container pb-8 pt-4 sm:pt-8">
        <div className="py-12 text-center">
          <Title_1.Title className="mb-2 text-2xl sm:text-5xl">Maintenance</Title_1.Title>

          <Title_1.Title subTitle className="!font-normal">
            We'll be right back!
          </Title_1.Title>

          <div className="flex items-center justify-center pt-8">
            <iconoir_react_1.Tools className="text-4xl text-primary"/>
          </div>
        </div>
      </div>
    </div>);
};
exports.default = Maintenance;
