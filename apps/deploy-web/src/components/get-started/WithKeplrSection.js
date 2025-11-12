"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithKeplrSection = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var ExternalLink_1 = require("../shared/ExternalLink");
var WithKeplrSection = function () {
    return (<div>
      <link_1.default href={urlUtils_1.UrlService.getStartedWallet()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text" }))}>
        <iconoir_react_1.NavArrowLeft className="mr-2 text-sm"/>
        Back
      </link_1.default>
      <ul className="list-decimal space-y-2 py-4 pl-8">
        <li>
          Swap <ExternalLink_1.ExternalLink href="https://app.osmosis.zone/?from=USDC&to=AKT" text="some tokens to AKT"/>
        </li>

        <li>
          <ExternalLink_1.ExternalLink href="https://app.osmosis.zone/assets" text="Withdraw"/> AKT to Keplr
        </li>
        <li>Done!</li>
      </ul>
    </div>);
};
exports.WithKeplrSection = WithKeplrSection;
