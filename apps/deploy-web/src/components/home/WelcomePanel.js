"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomePanel = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var WelcomePanel = function () {
    var _a;
    var _b = (0, react_1.useState)(true), expanded = _b[0], setExpanded = _b[1];
    return (<components_1.Collapsible open={expanded} onOpenChange={setExpanded}>
      <components_1.Card>
        <components_1.CardHeader className="flex flex-row items-center justify-between">
          <components_1.CardTitle className="text-2xl font-bold">Welcome to Akash Console!</components_1.CardTitle>

          <components_1.CollapsibleTrigger asChild>
            <components_1.Button size="icon" variant="ghost" className="!m-0 rounded-full" onClick={function () { return setExpanded(function (prev) { return !prev; }); }}>
              <iconoir_react_1.NavArrowDown fontSize="1rem" className={(0, utils_1.cn)("transition-all duration-100", (_a = {}, _a["rotate-180"] = expanded, _a))}/>
            </components_1.Button>
          </components_1.CollapsibleTrigger>
        </components_1.CardHeader>

        <components_1.CollapsibleContent>
          <components_1.CardContent>
            <ul className="space-y-6">
              <li className="flex items-center space-x-4">
                <components_1.Avatar className="h-12 w-12">
                  <components_1.AvatarFallback>
                    <iconoir_react_1.Rocket className="rotate-45"/>
                  </components_1.AvatarFallback>
                </components_1.Avatar>

                <div className="flex flex-col">
                  <link_1.default href={urlUtils_1.UrlService.getStarted()}>Getting started with Akash Console</link_1.default>
                  <span className="text-sm text-muted-foreground">Learn how to deploy your first docker container on Akash in a few clicks using Console.</span>
                </div>
              </li>

              <li className="flex items-center">
                <components_1.Avatar className="h-12 w-12">
                  <components_1.AvatarFallback>
                    <iconoir_react_1.SearchEngine />
                  </components_1.AvatarFallback>
                </components_1.Avatar>

                <div className="ml-4 flex flex-col">
                  <link_1.default href={urlUtils_1.UrlService.templates()}>Explore the marketplace</link_1.default>
                  <span className="text-sm text-muted-foreground">
                    Browse through the marketplace of pre-made solutions with categories like blogs, blockchain nodes and more!
                  </span>
                </div>
              </li>

              <li className="flex items-center">
                <components_1.Avatar className="h-12 w-12">
                  <components_1.AvatarFallback>
                    <iconoir_react_1.Learning />
                  </components_1.AvatarFallback>
                </components_1.Avatar>

                <div className="ml-4 flex flex-col">
                  <link_1.default href="https://akash.network/docs/" target="_blank">
                    Learn more about Akash
                  </link_1.default>
                  <span className="text-sm text-muted-foreground">Want to know about the advantages of using a decentralized cloud compute marketplace?</span>
                </div>
              </li>
            </ul>
          </components_1.CardContent>
        </components_1.CollapsibleContent>
      </components_1.Card>
    </components_1.Collapsible>);
};
exports.WelcomePanel = WelcomePanel;
