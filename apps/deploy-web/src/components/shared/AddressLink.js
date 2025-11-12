"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressLink = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var link_1 = require("next/link");
var AddressLink = function (_a) {
    var address = _a.address;
    var href = null;
    var target = "_self";
    if (address.startsWith("akashvaloper")) {
        href = "https://stats.akash.network/validators/".concat(address);
        target = "_blank";
    }
    else if (address.startsWith("akash")) {
        href = "https://stats.akash.network/addresses/".concat(address);
        target = "_blank";
    }
    if (href) {
        return (<link_1.default href={href} target={target}>
        <components_1.Address address={address} disableTruncate/>
      </link_1.default>);
    }
    else {
        return <components_1.Address address={address} disableTruncate isCopyable/>;
    }
};
exports.AddressLink = AddressLink;
