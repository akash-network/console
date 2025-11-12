"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectNetworkModal = void 0;
var react_1 = require("react");
var web_1 = require("@akashnetwork/chain-sdk/web");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var networkStore_1 = require("@src/store/networkStore");
var SelectNetworkModal = function (_a) {
    var onClose = _a.onClose;
    var _b = networkStore_1.default.useSelectedNetworkIdStore({ reloadOnChange: true }), selectedNetworkId = _b[0], setSelectedNetworkId = _b[1];
    var _c = (0, react_1.useState)(selectedNetworkId), formSelectedNetworkId = _c[0], setFormSelectedNetworkId = _c[1];
    var save = function () {
        if (selectedNetworkId !== formSelectedNetworkId) {
            setSelectedNetworkId(formSelectedNetworkId);
        }
        onClose();
    };
    return (<components_1.Popup fullWidth open variant="custom" title="Select Network" actions={[
            {
                label: "Close",
                variant: "text",
                side: "left",
                onClick: onClose
            },
            {
                label: "Save",
                variant: "default",
                side: "right",
                onClick: save
            }
        ]} onClose={onClose} maxWidth="sm" enableCloseOnBackdropClick>
      <components_1.RadioGroup>
        <ul>
          {networkStore_1.default.networks.map(function (network) {
            var _a, _b;
            return (<li key={network.id} onClick={function () { return setFormSelectedNetworkId(network.id); }} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text" }), (_a = {}, _a["pointer-events-none text-muted-foreground"] = !network.enabled, _a), "flex h-auto cursor-pointer items-center justify-start")}>
                <div className="basis-[40px]">
                  <components_1.RadioGroupItem value={network.id} id={network.id} checked={formSelectedNetworkId === network.id} disabled={!network.enabled} aria-labelledby={"network-".concat(network.id, "-label")}/>
                </div>
                <div>
                  <div className="flex items-center justify-between text-lg">
                    <span id={"network-".concat(network.id, "-label")}>
                      <strong>{network.title}</strong>
                      {" - "}
                      <span className="text-xs text-muted-foreground">{network.version}</span>
                    </span>
                    {network.id !== web_1.MAINNET_ID && (<components_1.Badge className={(0, utils_1.cn)("ml-4 h-4 text-xs font-bold", (_b = {}, _b["bg-primary/30"] = !network.enabled, _b))}>Experimental</components_1.Badge>)}
                  </div>
                  <div>{network.description}</div>
                </div>
              </li>);
        })}
        </ul>
      </components_1.RadioGroup>

      {formSelectedNetworkId !== web_1.MAINNET_ID && (<components_1.Alert variant="warning" className="mb-2 mt-4">
          <components_1.AlertTitle className="font-bold">Warning</components_1.AlertTitle>

          <components_1.AlertDescription>Some features are experimental and may not work as intended on the testnet or sandbox.</components_1.AlertDescription>
        </components_1.Alert>)}
    </components_1.Popup>);
};
exports.SelectNetworkModal = SelectNetworkModal;
