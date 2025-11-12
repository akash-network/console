"use strict";
"use client";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectWalletButton = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var CustomChainProvider_1 = require("@src/context/CustomChainProvider");
var ConnectWalletButton = function (_a) {
    var _b = _a.className, className = _b === void 0 ? "" : _b, rest = __rest(_a, ["className"]);
    var connect = (0, CustomChainProvider_1.useSelectedChain)().connect;
    return (<components_1.Button variant="outline" onClick={function () { return connect(); }} className={className} {...rest} data-testid="connect-wallet-btn">
      <iconoir_react_1.Wallet className="text-xs"/>
      <span className="ml-2 whitespace-nowrap">Connect Wallet</span>
    </components_1.Button>);
};
exports.ConnectWalletButton = ConnectWalletButton;
