"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalLink = void 0;
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var ExternalLink = function (_a) {
    var href = _a.href, text = _a.text;
    return (<link_1.default href={href} passHref target="_blank" rel="noreferrer">
      <span className="inline-flex items-center space-x-2 whitespace-nowrap">
        <span>{text}</span>
        <iconoir_react_1.OpenNewWindow className="text-xs"/>
      </span>
    </link_1.default>);
};
exports.ExternalLink = ExternalLink;
