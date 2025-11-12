"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFundsLink = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var link_1 = require("next/link");
var useAddFundsVerifiedLoginRequiredEventHandler_1 = require("@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var AddFundsLink = function (props) {
    var whenLoggedInAndVerified = (0, useAddFundsVerifiedLoginRequiredEventHandler_1.useAddFundsVerifiedLoginRequiredEventHandler)();
    return props.disabled ? (<components_1.Button className={props.className} disabled>
      {props.children}
    </components_1.Button>) : (<link_1.default {...props} onClick={function (event) {
            analytics_service_1.analyticsService.track("add_funds_btn_clk");
            whenLoggedInAndVerified(props.onClick || (function () { }))(event);
        }}/>);
};
exports.AddFundsLink = AddFundsLink;
