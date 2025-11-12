"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoWalletSection = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var ExternalLink_1 = require("../shared/ExternalLink");
var LinkTo_1 = require("../shared/LinkTo");
var CreateWalletSection_1 = require("./CreateWalletSection");
var NoWalletSection = function () {
    var _a = (0, react_1.useState)(false), isCreateWalletOpen = _a[0], setIsCreateWalletOpen = _a[1];
    return (<div>
      <link_1.default href={urlUtils_1.UrlService.getStartedWallet()} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text" }))}>
        <iconoir_react_1.NavArrowLeft className="mr-2 text-sm"/>
        Back
      </link_1.default>
      <ul className="list-decimal space-y-2 py-4 pl-8">
        <li>
          Install <ExternalLink_1.ExternalLink href="https://chrome.google.com/webstore/detail/keplr/dmkamcknogkgcdfhhbddcghachkejeap" text="Keplr"/>
        </li>
        <components_1.Collapsible open={isCreateWalletOpen} onOpenChange={setIsCreateWalletOpen}>
          <li>
            Create a wallet using{" "}
            <components_1.CollapsibleTrigger asChild>
              <LinkTo_1.LinkTo onClick={function () { return setIsCreateWalletOpen(function (prev) { return !prev; }); }}>Keplr</LinkTo_1.LinkTo>
            </components_1.CollapsibleTrigger>
          </li>

          <components_1.CollapsibleContent>
            <components_1.Alert className="my-4">
              <CreateWalletSection_1.CreateWalletSection />
            </components_1.Alert>
          </components_1.CollapsibleContent>
        </components_1.Collapsible>

        <li>
          Click "Buy tokens" at the bottom left corner of the screen to Purchasing USDC on <ExternalLink_1.ExternalLink href="https://app.osmosis.zone/" text="Osmosis"/> with
          Kado
        </li>

        <li>
          Swap <ExternalLink_1.ExternalLink href="https://app.osmosis.zone/?from=USDC&to=AKT" text="USDC to AKT"/>
        </li>

        <li>
          <ExternalLink_1.ExternalLink href="https://app.osmosis.zone/assets" text="Withdraw"/> AKT to Keplr
        </li>
        <li>Done!</li>
      </ul>
    </div>);
};
exports.NoWalletSection = NoWalletSection;
