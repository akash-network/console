"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeStatusBar = void 0;
var components_1 = require("@akashnetwork/ui/components");
var navigation_1 = require("next/navigation");
var SettingsProvider_1 = require("@src/context/SettingsProvider");
var useShortText_1 = require("@src/hooks/useShortText");
var networkStore_1 = require("@src/store/networkStore");
var urlUtils_1 = require("@src/utils/urlUtils");
var LinearLoadingSkeleton_1 = require("../shared/LinearLoadingSkeleton");
var NodeStatus_1 = require("../shared/NodeStatus");
var NodeStatusBar = function () {
    var _a;
    var _b = (0, SettingsProvider_1.useSettings)(), settings = _b.settings, isRefreshingNodeStatus = _b.isRefreshingNodeStatus;
    var selectedNode = settings.selectedNode, isCustomNode = settings.isCustomNode, customNode = settings.customNode;
    var router = (0, navigation_1.useRouter)();
    var shownNode = isCustomNode ? customNode : selectedNode;
    var selectedNetwork = networkStore_1.default.useSelectedNetwork();
    return (<div>
      <div className="flex items-center px-2 py-2">
        <span className="text-sm font-bold">{selectedNetwork.title}</span>
      </div>

      <LinearLoadingSkeleton_1.LinearLoadingSkeleton isLoading={isRefreshingNodeStatus}/>
      <div className="flex items-center">
        {shownNode && (<components_1.Button size="sm" className="flex w-full items-center justify-between text-xs" variant="secondary" onClick={function () { return router.push(urlUtils_1.UrlService.settings()); }}>
            <div className="ml-2">{((_a = shownNode === null || shownNode === void 0 ? void 0 : shownNode.id) === null || _a === void 0 ? void 0 : _a.length) > 15 ? (0, useShortText_1.getSplitText)(shownNode === null || shownNode === void 0 ? void 0 : shownNode.id, 0, 15) : shownNode === null || shownNode === void 0 ? void 0 : shownNode.id}</div>

            <div className="ml-2 text-xs">
              <NodeStatus_1.NodeStatus latency={Math.floor(shownNode === null || shownNode === void 0 ? void 0 : shownNode.latency)} status={shownNode === null || shownNode === void 0 ? void 0 : shownNode.status} variant="dense"/>
            </div>
          </components_1.Button>)}

        {!shownNode && isCustomNode && (<components_1.Button size="sm" className="w-full" onClick={function () { return router.push(urlUtils_1.UrlService.settings()); }}>
            Custom node...
          </components_1.Button>)}
      </div>

      <components_1.Separator className="my-2"/>
    </div>);
};
exports.NodeStatusBar = NodeStatusBar;
