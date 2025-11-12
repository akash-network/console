"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MustConnect = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var SignUpButton_1 = require("../auth/SignUpButton/SignUpButton");
var MustConnect = function (_a) {
    var message = _a.message;
    return (<components_1.Alert>
      {message}, please{" "}
      <link_1.default href={urlUtils_1.UrlService.login()} passHref>
        login
      </link_1.default>{" "}
      or <SignUpButton_1.SignUpButton>register</SignUpButton_1.SignUpButton>.
    </components_1.Alert>);
};
exports.MustConnect = MustConnect;
