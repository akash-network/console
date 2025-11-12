"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentName = exports.COMPONENTS = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var LabelValueOld_1 = require("@src/components/shared/LabelValueOld");
var stringUtils_1 = require("@src/utils/stringUtils");
exports.COMPONENTS = {
    CustomTooltip: components_1.CustomTooltip,
    LabelValue: LabelValueOld_1.LabelValueOld,
    Link: link_1.default,
    OpenInWindow: iconoir_react_1.OpenInWindow
};
var DeploymentName = function (_a) {
    var deployment = _a.deployment, deploymentServices = _a.deploymentServices, providerHostUri = _a.providerHostUri, _b = _a.components, c = _b === void 0 ? exports.COMPONENTS : _b;
    var deploymentName = (0, react_1.useMemo)(function () {
        var _a;
        var name = ((_a = deployment.name) === null || _a === void 0 ? void 0 : _a.trim()) || "";
        var services = deploymentServices ? Object.values(deploymentServices) : [];
        var firstServiceWithUris = name ? null : services.find(function (service) { return service && service.uris && service.uris.length > 0; });
        if (firstServiceWithUris) {
            var providerHost_1 = providerHostUri ? new URL(providerHostUri).hostname.replace(/^provider\./, "") : "";
            name = firstServiceWithUris.uris.find(function (uri) { return providerHost_1 && uri && !uri.endsWith(providerHost_1); }) || firstServiceWithUris.uris[0];
        }
        name = name || "Unknown";
        return {
            short: name.length > 20 ? (0, stringUtils_1.getShortText)(name, 15) : name,
            full: name,
            services: Object.entries(deploymentServices || {})
        };
    }, [deployment.name, deploymentServices, providerHostUri]);
    return (<c.CustomTooltip disabled={!deploymentName.services.length && !deployment.name} title={<div className="space-y-1 text-left">
          {deployment.name && (<>
              <c.LabelValue label="Name:"/>
              <div>{deployment.name.trim()}</div>
            </>)}
          {deploymentName.services.length > 0 && <c.LabelValue label="Services:"/>}
          {deploymentName.services.map(function (_a) {
                var service = _a[1];
                return (service.uris || []).map(function (uri) { return (<c.Link key={uri} href={"http://".concat(uri)} target="_blank" className="inline-flex items-center space-x-2 space-y-1 truncate text-sm">
                <span>{uri}</span>
                <c.OpenInWindow className="text-xs"/>
              </c.Link>); });
            })}
        </div>}>
      <div className="truncate text-sm">{deploymentName.short && <strong>{deploymentName.short}</strong>}</div>
    </c.CustomTooltip>);
};
exports.DeploymentName = DeploymentName;
